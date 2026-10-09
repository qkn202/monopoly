import { GameState, Player, GameAction } from './types';
import { HOGWARTS_TILES } from './boardData';
import { canBuildHouse, canBuildHotel, ownsFullColorSet } from './rulesEngine';

/**
 * Computes the optimal bot action given current game state.
 */
export function getBotAction(state: GameState, bot: Player): GameAction | null {
  if (bot.isBankrupt) {
    return { type: 'END_TURN' };
  }

  // Dismiss any active card popup
  if (state.activeCard) {
    return { type: 'DISMISS_CARD' };
  }

  // 1. If in Auction phase and bot is the active bidder:
  if (state.turnPhase === 'AUCTION' && state.auction && state.auction.active) {
    const activeBidders = state.auction.activeBidders;
    const currentBidderId = activeBidders[state.auction.currentBidderIndex];
    if (currentBidderId === bot.id) {
      const tile = HOGWARTS_TILES.find((t) => t.id === state.auction!.propertyId);
      const facePrice = tile?.price || 100;
      const completesSet = tile?.colorGroup ? ownsFullColorSet(bot, tile.colorGroup, state) : false;

      const maxValuation = completesSet ? Math.floor(facePrice * 1.4) : Math.floor(facePrice * 0.95);
      const nextMinBid = state.auction.currentBid + 25;

      if (nextMinBid <= maxValuation && bot.balance >= nextMinBid + 200) {
        return { type: 'PLACE_BID', playerId: bot.id, amount: nextMinBid };
      } else {
        return { type: 'FOLD_AUCTION', playerId: bot.id };
      }
    }
    return null;
  }

  // 2. If it's not the bot's turn, do nothing
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (currentPlayer.id !== bot.id) return null;

  // 3. Roll phase
  if (state.turnPhase === 'ROLL') {
    // If in jail, check if bot should pay fine or use card
    if (bot.inJail) {
      if (bot.getOutOfJailCards > 0) {
        return { type: 'USE_JAIL_CARD' };
      }
      if (bot.balance >= 750) {
        return { type: 'PAY_JAIL_FINE' };
      }
    }
    return { type: 'ROLL_DICE' };
  }

  // 4. Action phase (Landed on property)
  if (state.turnPhase === 'ACTION') {
    // 4a. Hostile Takeover opportunity on another player's property
    if (state.takeoverCandidate) {
      const candidate = state.takeoverCandidate;
      const tile = HOGWARTS_TILES.find((t) => t.id === candidate.propertyId);
      if (tile && bot.balance >= candidate.cost) {
        const completesSet = tile.colorGroup
          ? ownsFullColorSet(
              { ...bot, properties: [...bot.properties, tile.id] },
              tile.colorGroup,
              state
            )
          : false;

        const prevOwner = state.players.find((p) => p.id === candidate.ownerId);
        const brokeOpponentSet =
          prevOwner && tile.colorGroup ? ownsFullColorSet(prevOwner, tile.colorGroup, state) : false;

        const reserveAfter = bot.balance - candidate.cost;
        if (completesSet && reserveAfter >= 180) {
          return { type: 'TAKEOVER_PROPERTY', propertyId: tile.id };
        }
        if (brokeOpponentSet && reserveAfter >= 300) {
          return { type: 'TAKEOVER_PROPERTY', propertyId: tile.id };
        }
        if (reserveAfter >= 750) {
          return { type: 'TAKEOVER_PROPERTY', propertyId: tile.id };
        }
      }
      return { type: 'PASS_PROPERTY' };
    }

    // 4b. Upgrade own property opportunity
    if (state.upgradeCandidate) {
      const candidate = state.upgradeCandidate;
      if (bot.balance >= candidate.cost + 250) {
        if (candidate.isHotelUpgrade) {
          return { type: 'BUILD_HOTEL', propertyId: candidate.propertyId, playerId: bot.id };
        } else {
          return { type: 'BUILD_HOUSE', propertyId: candidate.propertyId, playerId: bot.id };
        }
      }
      return { type: 'PASS_PROPERTY' };
    }

    // 4c. Unowned property purchase
    const tile = HOGWARTS_TILES[bot.position];
    if (tile && tile.price && !state.propertyOwnership[tile.id]) {
      // Reserve at least 180G for safety
      if (bot.balance >= tile.price + 180) {
        return { type: 'BUY_PROPERTY', propertyId: tile.id };
      } else {
        // Pass to auction
        return { type: 'PASS_PROPERTY' };
      }
    }
    return { type: 'END_TURN' };
  }

  // 5. End Turn phase: Check if bot can build houses, hotels or unmortgage properties before ending turn
  if (state.turnPhase === 'END_TURN') {
    for (const propId of bot.properties) {
      const checkHotel = canBuildHotel(bot, propId, state);
      if (checkHotel.allowed && bot.balance >= 800) {
        return { type: 'BUILD_HOTEL', propertyId: propId };
      }
      const check = canBuildHouse(bot, propId, state);
      if (check.allowed && bot.balance >= 800) {
        return { type: 'BUILD_HOUSE', propertyId: propId };
      }
    }

    // Unmortgage check if bot has plenty of funds
    for (const propId of bot.properties) {
      if (state.mortgagedProperties[propId]) {
        const tile = HOGWARTS_TILES.find((t) => t.id === propId);
        if (tile && tile.mortgageValue) {
          const cost = Math.floor(tile.mortgageValue * 1.1);
          if (bot.balance >= cost + 600) {
            return { type: 'UNMORTGAGE_PROPERTY', propertyId: propId };
          }
        }
      }
    }

    return { type: 'END_TURN' };
  }

  return null;
}
