import { GameState, GameAction, Player, HouseType, AuctionState, GameEvent, TakeoverCandidate } from './types';
import { HOGWARTS_TILES, HOUSE_INFO, CHARMS_CARDS, POTIONS_CARDS } from './boardData';
import { calculateRent, canBuildHouse, canBuildHotel, determineLeaderboard, calculateTakeoverCost } from './rulesEngine';
import { createEvent, refreshAllNetWorth, executeCardEffect, handleBankruptcy, resolveDebtOrLiquidate } from './reducerHelpers';
import { getBotAction } from './botAI';

export function createInitialState(
  playerConfigs: Array<{ name: string; house: HouseType; isAI: boolean }>
): GameState {
  const players: Player[] = playerConfigs.map((cfg, idx) => {
    const houseData = HOUSE_INFO[cfg.house] || HOUSE_INFO.Gryffindor;
    return {
      id: `p-${idx}`,
      name: cfg.name,
      house: cfg.house,
      color: houseData.color,
      tokenIcon: houseData.token,
      balance: 5000, // Starting balance in Galleons
      position: 0,
      properties: [],
      inJail: false,
      jailTurnsRemaining: 0,
      getOutOfJailCards: 0,
      isBankrupt: false,
      isAI: cfg.isAI,
      houses: {},
      hotels: {},
      netWorth: 5000,
    };
  });

  return {
    players,
    currentPlayerIndex: 0,
    turnPhase: 'ROLL',
    turnNumber: 1,
    dice: null,
    consecutiveDoubles: 0,
    propertyOwnership: {},
    mortgagedProperties: {},
    auction: null,
    activeTrade: null,
    timer: {
      durationSeconds: 1800, // 30 minutes
      remainingSeconds: 1800,
      isExpired: false,
      isPaused: false,
    },
    charmsDeck: [...CHARMS_CARDS].sort(() => Math.random() - 0.5),
    potionsDeck: [...POTIONS_CARDS].sort(() => Math.random() - 0.5),
    activeCard: null,
    events: [createEvent('Trận đấu Hogwarts Monopoly chính thức bắt đầu! Chúc các phù thủy may mắn!', 'success')],
    winner: null,
    freeParkingPot: 0,
    lastRentPayment: null,
    turnSecondsRemaining: 60,
    maxTurnSeconds: 60,
    turboMode: false,
    rentMultiplier: 1,
    nextEscalationRound: Math.floor(Math.random() * 4) + 4,
    maxRentMultiplier: 2,
    activeEscalationEvent: null,
    takeoverCandidate: null,
    upgradeCandidate: null,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.turnPhase === 'GAME_OVER' && action.type !== 'START_GAME') {
    return state;
  }

  switch (action.type) {
    case 'START_GAME': {
      return createInitialState(action.players);
    }

    case 'TIMER_TICK': {
      if (state.timer.isPaused || state.timer.isExpired) return state;

      const nextRemaining = state.timer.remainingSeconds - 1;
      if (nextRemaining <= 0) {
        const refreshed = refreshAllNetWorth(state);
        const ranked = determineLeaderboard(refreshed);
        const winner = ranked[0] || null;
        return {
          ...refreshed,
          timer: { ...state.timer, remainingSeconds: 0, isExpired: true },
          turnPhase: 'GAME_OVER',
          winner,
          events: [
            createEvent(`⌛ HẾT THỜI GIAN 30 PHÚT! Trận đấu kết thúc!`, 'warning'),
            createEvent(`🏆 ${winner?.name} giành chức VÔ ĐỊCH với Tổng tài sản ${winner?.netWorth} Galleons!`, 'success'),
            ...state.events,
          ],
        };
      }

      // Check Turn Timer (1 minute = 60s limit per turn)
      // When in AUCTION, auction has its own 10s countdown
      if (state.turnPhase === 'AUCTION') {
        return {
          ...state,
          timer: { ...state.timer, remainingSeconds: nextRemaining },
        };
      }

      const nextTurnSec = (state.turnSecondsRemaining ?? 60) - 1;
      if (nextTurnSec <= 0) {
        // Auto-handle turn timeout!
        return handleTurnTimeout({
          ...state,
          timer: { ...state.timer, remainingSeconds: nextRemaining },
          turnSecondsRemaining: state.maxTurnSeconds || 60,
        });
      }

      return {
        ...state,
        timer: { ...state.timer, remainingSeconds: nextRemaining },
        turnSecondsRemaining: nextTurnSec,
      };
    }

    case 'TURN_TIMEOUT': {
      return handleTurnTimeout(state);
    }

    case 'ROLL_DICE': {
      if (state.turnPhase !== 'ROLL') return state;
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (currentPlayer.isBankrupt) return advanceTurn(state);

      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const isDouble = d1 === d2;

      let doublesCount = isDouble ? state.consecutiveDoubles + 1 : 0;

      // Check 3 consecutive doubles -> sent to Azkaban
      if (doublesCount >= 3) {
        const jailedPlayer: Player = {
          ...currentPlayer,
          position: 10,
          inJail: true,
          jailTurnsRemaining: 3,
        };
        const updatedPlayers = state.players.map((p) => (p.id === currentPlayer.id ? jailedPlayer : p));
        return refreshAllNetWorth({
          ...state,
          players: updatedPlayers,
          dice: { die1: d1, die2: d2, total, isDouble: true },
          consecutiveDoubles: 0,
          turnPhase: 'END_TURN',
          events: [
            createEvent(`⚡ ${currentPlayer.name} tung đôi 3 lần liên tiếp! Bị đưa vào Ngục Azkaban!`, 'error', currentPlayer.id),
            ...state.events,
          ],
        });
      }

      // If in jail
      if (currentPlayer.inJail) {
        if (isDouble) {
          const freedPlayer: Player = {
            ...currentPlayer,
            inJail: false,
            jailTurnsRemaining: 0,
            position: (currentPlayer.position + total) % 40,
          };
          return resolveLanding({
            ...state,
            players: state.players.map((p) => (p.id === currentPlayer.id ? freedPlayer : p)),
            dice: { die1: d1, die2: d2, total, isDouble },
            consecutiveDoubles: 0,
            events: [
              createEvent(`✨ ${currentPlayer.name} tung số đôi (${d1}-${d2})! Thoát khỏi Azkaban và di chuyển!`, 'success', currentPlayer.id),
              ...state.events,
            ],
          }, freedPlayer, total);
        } else {
          const turnsLeft = currentPlayer.jailTurnsRemaining - 1;
          if (turnsLeft <= 0) {
            // Must pay 150G fine on turn 3
            const pFreed: Player = {
              ...currentPlayer,
              inJail: false,
              jailTurnsRemaining: 0,
            };
            const sFreed: GameState = {
              ...state,
              players: state.players.map((p) => (p.id === currentPlayer.id ? pFreed : p)),
            };
            const debtRes = resolveDebtOrLiquidate(sFreed, pFreed, 150, undefined, 'tiền phạt mãn hạn Azkaban');
            if (debtRes.isBankrupt) {
              return {
                ...debtRes.state,
                dice: { die1: d1, die2: d2, total, isDouble },
                freeParkingPot: debtRes.state.freeParkingPot + Math.min(150, currentPlayer.balance),
                turnPhase: 'END_TURN',
              };
            }
            const afterP = debtRes.state.players.find((p) => p.id === currentPlayer.id) || pFreed;
            const movedPlayer: Player = {
              ...afterP,
              position: (afterP.position + total) % 40,
            };
            return resolveLanding({
              ...debtRes.state,
              players: debtRes.state.players.map((p) => (p.id === currentPlayer.id ? movedPlayer : p)),
              dice: { die1: d1, die2: d2, total, isDouble },
              freeParkingPot: debtRes.state.freeParkingPot + 150,
              events: [
                createEvent(`${currentPlayer.name} hết hạn giam, nộp 150G tiền phạt và di chuyển ${total} ô.`, 'info', currentPlayer.id),
                ...debtRes.state.events,
              ],
            }, movedPlayer, total);
          } else {
            const pStay: Player = { ...currentPlayer, jailTurnsRemaining: turnsLeft };
            return refreshAllNetWorth({
              ...state,
              players: state.players.map((p) => (p.id === currentPlayer.id ? pStay : p)),
              dice: { die1: d1, die2: d2, total, isDouble },
              turnPhase: 'END_TURN',
              events: [
                createEvent(`${currentPlayer.name} tung ${d1}-${d2} (không đôi), tiếp tục ở lại Azkaban (${turnsLeft} lượt nữa).`, 'info', currentPlayer.id),
                ...state.events,
              ],
            });
          }
        }
      }

      // Normal movement
      const oldPos = currentPlayer.position;
      const newPos = (oldPos + total) % 40;
      let balance = currentPlayer.balance;
      let passGoEvent: GameEvent | null = null;

      if (newPos < oldPos) {
        // Passed GO
        balance += 500;
        passGoEvent = createEvent(`${currentPlayer.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', currentPlayer.id);
      }

      const movedPlayer: Player = { ...currentPlayer, position: newPos, balance };
      const updatedPlayers = state.players.map((p) => (p.id === currentPlayer.id ? movedPlayer : p));
      const sWithMove: GameState = {
        ...state,
        players: updatedPlayers,
        dice: { die1: d1, die2: d2, total, isDouble },
        consecutiveDoubles: doublesCount,
        lastRentPayment: null,
        events: passGoEvent ? [passGoEvent, ...state.events] : state.events,
      };

      return resolveLanding(sWithMove, movedPlayer, total);
    }

    case 'BUY_PROPERTY': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!tile || !tile.price || currentPlayer.balance < tile.price) return state;

      const updatedPlayer: Player = {
        ...currentPlayer,
        balance: currentPlayer.balance - tile.price,
        properties: [...currentPlayer.properties, tile.id],
      };

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === currentPlayer.id ? updatedPlayer : p)),
        propertyOwnership: { ...state.propertyOwnership, [tile.id]: currentPlayer.id },
        turnPhase: 'END_TURN',
        events: [
          createEvent(`🏰 ${currentPlayer.name} đã mua "${tile.name}" với giá ${tile.price} Galleons!`, 'success', currentPlayer.id),
          ...state.events,
        ],
      });
    }

    case 'PASS_PROPERTY': {
      if (state.upgradeCandidate) {
        // Player declined building or upgrading owned property -> advance to END_TURN
        return {
          ...state,
          upgradeCandidate: null,
          turnPhase: 'END_TURN',
        };
      }

      if (state.takeoverCandidate) {
        // Player declined hostile takeover -> advance to END_TURN
        return {
          ...state,
          takeoverCandidate: null,
          turnPhase: 'END_TURN',
        };
      }

      // Player lands on unowned property and exercises the right NOT to buy (Không mua đất)
      const currentPlayer = state.players[state.currentPlayerIndex];
      const tile = HOGWARTS_TILES[currentPlayer.position];
      if (!tile || state.propertyOwnership[tile.id]) return state;

      return {
        ...state,
        turnPhase: 'END_TURN',
        events: [
          createEvent(`🚫 ${currentPlayer.name} quyết định KHÔNG MUA "${tile.name}". Ô đất vẫn giữ nguyên chưa ai sở hữu!`, 'info', currentPlayer.id),
          ...state.events,
        ],
      };
    }

    case 'AUCTION_PROPERTY': {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const tile = (action.propertyId ? HOGWARTS_TILES.find((t) => t.id === action.propertyId) : null) || HOGWARTS_TILES[currentPlayer.position];
      if (!tile || state.propertyOwnership[tile.id]) return state;

      const activeBidders = state.players.filter((p) => !p.isBankrupt).map((p) => p.id);

      const auction: AuctionState = {
        active: true,
        propertyId: tile.id,
        currentBid: 25,
        highBidderId: null,
        activeBidders,
        currentBidderIndex: 0,
        timerSeconds: state.turboMode ? 4 : 6,
      };

      return {
        ...state,
        auction,
        turnPhase: 'AUCTION',
        events: [
          createEvent(`📢 ${currentPlayer.name} mở phiên ĐẤU GIÁ CÔNG KHAI cho ô đất "${tile.name}"!`, 'warning'),
          ...state.events,
        ],
      };
    }

    case 'TAKEOVER_PROPERTY': {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const candidate = state.takeoverCandidate;
      if (!candidate || candidate.propertyId !== action.propertyId) return state;

      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      const previousOwner = state.players.find((p) => p.id === candidate.ownerId);
      if (!tile || !previousOwner || currentPlayer.balance < candidate.cost) return state;

      const cost = candidate.cost;
      const buyerId = currentPlayer.id;
      const ownerId = previousOwner.id;

      // Transfer existing buildings intact
      const houses = previousOwner.houses[tile.id] || 0;
      const hotels = previousOwner.hotels[tile.id] || 0;

      const updatedBuyer: Player = {
        ...currentPlayer,
        balance: currentPlayer.balance - cost,
        properties: [...currentPlayer.properties, tile.id],
        houses: { ...currentPlayer.houses, [tile.id]: houses },
        hotels: { ...currentPlayer.hotels, [tile.id]: hotels },
      };

      const updatedPrevOwner: Player = {
        ...previousOwner,
        balance: previousOwner.balance + cost,
        properties: previousOwner.properties.filter((id) => id !== tile.id),
        houses: { ...previousOwner.houses, [tile.id]: 0 },
        hotels: { ...previousOwner.hotels, [tile.id]: 0 },
      };

      const newPropertyOwnership = {
        ...state.propertyOwnership,
        [tile.id]: buyerId,
      };

      const updatedPlayers = state.players.map((p) => {
        if (p.id === buyerId) return updatedBuyer;
        if (p.id === ownerId) return updatedPrevOwner;
        return p;
      });

      return refreshAllNetWorth({
        ...state,
        players: updatedPlayers,
        propertyOwnership: newPropertyOwnership,
        takeoverCandidate: null,
        turnPhase: 'END_TURN',
        events: [
          createEvent(
            `⚡ THÂU TÓM CƯỠNG CHẾ! ${currentPlayer.name} đã chi ${cost} Galleons (x2 giá trị) mua đứt "${tile.name}" từ tay ${previousOwner.name}!`,
            'success',
            currentPlayer.id
          ),
          ...state.events,
        ],
      });
    }

    case 'PLACE_BID': {
      if (!state.auction || !state.auction.active) return state;
      const currentBidderId = state.auction.activeBidders[state.auction.currentBidderIndex];
      if (action.playerId !== currentBidderId) return state;

      const bidder = state.players.find((p) => p.id === action.playerId);
      if (!bidder || bidder.balance < action.amount || action.amount <= state.auction.currentBid) {
        return state;
      }

      const nextBidders = state.auction.activeBidders;
      const nextIndex = (state.auction.currentBidderIndex + 1) % nextBidders.length;

      return {
        ...state,
        auction: {
          ...state.auction,
          currentBid: action.amount,
          highBidderId: action.playerId,
          currentBidderIndex: nextIndex,
          timerSeconds: state.turboMode ? 4 : 5,
        },
        events: [
          createEvent(`💰 ${bidder.name} nâng giá lên ${action.amount} Galleons!`, 'info', bidder.id),
          ...state.events,
        ],
      };
    }

    case 'FOLD_AUCTION': {
      if (!state.auction || !state.auction.active) return state;
      const currentBidderId = state.auction.activeBidders[state.auction.currentBidderIndex];
      if (action.playerId !== currentBidderId) return state;

      const remainingBidders = state.auction.activeBidders.filter((id) => id !== action.playerId);
      const folder = state.players.find((p) => p.id === action.playerId);

      // If 1 or 0 bidders left, auction concludes
      if (remainingBidders.length <= 1) {
        const winnerId = state.auction.highBidderId || null;
        return concludeAuction(state, winnerId);
      }

      const nextIndex = state.auction.currentBidderIndex % remainingBidders.length;
      return {
        ...state,
        auction: {
          ...state.auction,
          activeBidders: remainingBidders,
          currentBidderIndex: nextIndex,
          timerSeconds: state.turboMode ? 4 : 5,
        },
        events: [
          createEvent(`👋 ${folder?.name || 'Người chơi'} đã rút lui khỏi cuộc đấu giá.`, 'info'),
          ...state.events,
        ],
      };
    }

    case 'AUCTION_TICK': {
      if (!state.auction || !state.auction.active) return state;
      const nextTimer = state.auction.timerSeconds - 1;
      if (nextTimer <= 0) {
        // Auto-fold current bidder or conclude if high bidder exists
        if (state.auction.highBidderId) {
          return concludeAuction(state, state.auction.highBidderId);
        } else {
          // No one bid at all
          return concludeAuction(state, null);
        }
      }
      return {
        ...state,
        auction: { ...state.auction, timerSeconds: nextTimer },
      };
    }

    case 'BUILD_HOUSE': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      const ownerId = action.playerId || (tile ? state.propertyOwnership[tile.id] : undefined) || state.players[state.currentPlayerIndex].id;
      const player = state.players.find((p) => p.id === ownerId);
      if (!tile || !tile.houseCost || !player) return state;

      const check = canBuildHouse(player, tile.id, state);
      if (!check.allowed) return state;

      const currentCount = player.houses[tile.id] || 0;
      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - tile.houseCost,
        houses: { ...player.houses, [tile.id]: currentCount + 1 },
      };

      const isLandedUpgrade = state.turnPhase === 'ACTION' && state.upgradeCandidate?.propertyId === tile.id;

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        turnPhase: isLandedUpgrade ? 'END_TURN' : state.turnPhase,
        upgradeCandidate: isLandedUpgrade ? null : state.upgradeCandidate,
        events: [
          createEvent(`🛖 ${player.name} xây thêm 1 Túp Lều tại "${tile.name}" (-${tile.houseCost}G)`, 'success', player.id),
          ...state.events,
        ],
      });
    }

    case 'BUILD_HOTEL': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      const ownerId = action.playerId || (tile ? state.propertyOwnership[tile.id] : undefined) || state.players[state.currentPlayerIndex].id;
      const player = state.players.find((p) => p.id === ownerId);
      if (!tile || !tile.houseCost || !player) return state;

      const check = canBuildHotel(player, tile.id, state);
      if (!check.allowed) return state;

      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - tile.houseCost,
        houses: { ...player.houses, [tile.id]: 0 },
        hotels: { ...player.hotels, [tile.id]: 1 },
      };

      const isLandedUpgrade = state.turnPhase === 'ACTION' && state.upgradeCandidate?.propertyId === tile.id;

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        turnPhase: isLandedUpgrade ? 'END_TURN' : state.turnPhase,
        upgradeCandidate: isLandedUpgrade ? null : state.upgradeCandidate,
        events: [
          createEvent(`🏰 ${player.name} nâng cấp lên Lâu Đài Hogwarts tại "${tile.name}" (-${tile.houseCost}G)`, 'success', player.id),
          ...state.events,
        ],
      });
    }

    case 'SELL_HOUSE': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      if (!tile || !tile.houseCost) return state;
      const ownerId = action.playerId || state.propertyOwnership[tile.id] || state.players[state.currentPlayerIndex].id;
      const player = state.players.find((p) => p.id === ownerId);
      if (!player) return state;

      const hasHotel = (player.hotels[tile.id] || 0) > 0;
      const currentHouses = player.houses[tile.id] || 0;

      if (hasHotel) {
        // Downgrade castle to 4 cottages
        const refund = Math.floor(tile.houseCost / 2);
        const updatedPlayer: Player = {
          ...player,
          balance: player.balance + refund,
          hotels: { ...player.hotels, [tile.id]: 0 },
          houses: { ...player.houses, [tile.id]: 4 },
        };
        return refreshAllNetWorth({
          ...state,
          players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
          events: [
            createEvent(`🏚️ ${player.name} hạ cấp Lâu Đài xuống 4 Túp Lều tại "${tile.name}" (+${refund}G)`, 'info', player.id),
            ...state.events,
          ],
        });
      }

      if (currentHouses <= 0) return state;

      const refund = Math.floor(tile.houseCost / 2);
      const updatedPlayer: Player = {
        ...player,
        balance: player.balance + refund,
        houses: { ...player.houses, [tile.id]: currentHouses - 1 },
      };

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        events: [
          createEvent(`🏚️ ${player.name} dỡ bớt 1 Túp Lều tại "${tile.name}" (+${refund}G)`, 'info', player.id),
          ...state.events,
        ],
      });
    }

    case 'MORTGAGE_PROPERTY': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      if (!tile || !tile.mortgageValue || state.mortgagedProperties[tile.id]) return state;

      const ownerId = state.propertyOwnership[tile.id];
      const player = state.players.find((p) => p.id === ownerId);
      if (!player) return state;

      // Check if any property in color group has houses or hotels
      if (tile.colorGroup) {
        const groupTiles = HOGWARTS_TILES.filter((t) => t.colorGroup === tile.colorGroup);
        const hasBuildings = groupTiles.some(
          (t) => (player.houses[t.id] || 0) > 0 || (player.hotels[t.id] || 0) > 0
        );
        if (hasBuildings) return state;
      }

      const updatedPlayer: Player = {
        ...player,
        balance: player.balance + tile.mortgageValue,
      };

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        mortgagedProperties: { ...state.mortgagedProperties, [tile.id]: true },
        events: [
          createEvent(`📜 ${player.name} thế chấp "${tile.name}" nhận ${tile.mortgageValue} Galleons.`, 'warning', player.id),
          ...state.events,
        ],
      });
    }

    case 'UNMORTGAGE_PROPERTY': {
      const tile = HOGWARTS_TILES.find((t) => t.id === action.propertyId);
      if (!tile || !tile.mortgageValue || !state.mortgagedProperties[tile.id]) return state;

      const ownerId = state.propertyOwnership[tile.id];
      const player = state.players.find((p) => p.id === ownerId);
      if (!player) return state;

      const cost = Math.floor(tile.mortgageValue * 1.1); // 10% interest
      if (player.balance < cost) return state;

      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - cost,
      };

      const newMortgages = { ...state.mortgagedProperties };
      delete newMortgages[tile.id];

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        mortgagedProperties: newMortgages,
        events: [
          createEvent(`✨ ${player.name} chuộc lại "${tile.name}" với ${cost} Galleons.`, 'success', player.id),
          ...state.events,
        ],
      });
    }

    case 'PAY_JAIL_FINE': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.balance < 150) return state;

      const updatedPlayer: Player = {
        ...player,
        inJail: false,
        jailTurnsRemaining: 0,
        balance: player.balance - 150,
      };

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        freeParkingPot: state.freeParkingPot + 150,
        events: [
          createEvent(`${player.name} nộp 150G tiền bảo lãnh rời khỏi Ngục Azkaban!`, 'success', player.id),
          ...state.events,
        ],
      });
    }

    case 'USE_JAIL_CARD': {
      const player = state.players[state.currentPlayerIndex];
      if (!player.inJail || player.getOutOfJailCards <= 0) return state;

      const updatedPlayer: Player = {
        ...player,
        inJail: false,
        jailTurnsRemaining: 0,
        getOutOfJailCards: player.getOutOfJailCards - 1,
      };

      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        events: [
          createEvent(`✨ ${player.name} sử dụng Thẻ Miễn Giam và rời khỏi Azkaban!`, 'success', player.id),
          ...state.events,
        ],
      });
    }

    case 'DISMISS_CARD': {
      return { ...state, activeCard: null };
    }

    case 'END_TURN': {
      return advanceTurn(state);
    }

    case 'TOGGLE_TURBO': {
      const isNowTurbo = !state.turboMode;
      return {
        ...state,
        turboMode: isNowTurbo,
        events: [
          createEvent(
            isNowTurbo
              ? '⚡ ĐÃ BẬT CHẾ ĐỘ SIÊU TỐC (2X SPEED)! Quân cờ lướt nhanh, bot đi chớp nhoáng, đấu giá 4s.'
              : '⏱️ Đã chuyển về Tốc độ Chuẩn (1X).',
            'info'
          ),
          ...state.events,
        ],
      };
    }

    case 'SET_TURBO': {
      return { ...state, turboMode: action.enabled };
    }

    case 'DISMISS_ESCALATION': {
      return { ...state, activeEscalationEvent: null };
    }

    default:
      return state;
  }
}

function resolveLanding(state: GameState, player: Player, diceTotal: number): GameState {
  const tile = HOGWARTS_TILES[player.position];
  if (!tile) return { ...state, turnPhase: 'END_TURN' };

  switch (tile.type) {
    case 'GO':
    case 'JAIL':
      return { ...state, turnPhase: 'END_TURN' };

    case 'FREE_PARKING': {
      const pot = state.freeParkingPot;
      if (pot > 0) {
        const luckyPlayer: Player = { ...player, balance: player.balance + pot };
        return refreshAllNetWorth({
          ...state,
          players: state.players.map((p) => (p.id === player.id ? luckyPlayer : p)),
          freeParkingPot: 0,
          turnPhase: 'END_TURN',
          events: [
            createEvent(`🎉 ${player.name} bước vào Phòng Yêu Cầu và nhặt được kho báu ${pot} Galleons!`, 'success', player.id),
            ...state.events,
          ],
        });
      }
      return { ...state, turnPhase: 'END_TURN' };
    }

    case 'TAX': {
      const baseTax = tile.price || 100;
      const taxAmt = baseTax * (state.rentMultiplier || 1);
      const res = resolveDebtOrLiquidate(state, player, taxAmt, undefined, `thuế tại "${tile.name}"`);
      return {
        ...res.state,
        freeParkingPot: res.state.freeParkingPot + taxAmt,
        turnPhase: 'END_TURN',
        lastRentPayment: {
          debtorId: player.id,
          amount: taxAmt,
          tileId: tile.id,
          timestamp: Date.now(),
          isTax: true,
        },
      };
    }

    case 'GO_TO_JAIL': {
      const jailedPlayer: Player = {
        ...player,
        position: 10,
        inJail: true,
        jailTurnsRemaining: 3,
      };
      return refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? jailedPlayer : p)),
        consecutiveDoubles: 0,
        turnPhase: 'END_TURN',
        events: [
          createEvent(`👮‍♂️ ${player.name} bị áp giải vào Ngục Azkaban!`, 'error', player.id),
          ...state.events,
        ],
      });
    }

    case 'CHARMS':
    case 'POTIONS': {
      const deck = tile.type === 'CHARMS' ? [...state.charmsDeck] : [...state.potionsDeck];
      const card = deck.shift();
      if (!card) return { ...state, turnPhase: 'END_TURN' };
      deck.push(card); // Recycle card to bottom

      const cardState: GameState = {
        ...state,
        charmsDeck: tile.type === 'CHARMS' ? deck : state.charmsDeck,
        potionsDeck: tile.type === 'POTIONS' ? deck : state.potionsDeck,
        activeCard: card,
        turnPhase: 'END_TURN',
        events: [
          createEvent(`📜 ${player.name} rút thẻ: ${card.title} - ${card.description}`, 'info', player.id),
          ...state.events,
        ],
      };

      const result = executeCardEffect(cardState, player, card);
      const afterCardState = refreshAllNetWorth(result.nextState);

      // If the card moved the player, resolve landing on destination tile!
      if (card.action === 'MOVE' || card.action === 'MOVE_TO') {
        const movedPlayer = afterCardState.players.find((p) => p.id === player.id) || player;
        const landingResolved = resolveLanding(afterCardState, movedPlayer, 0);
        // Preserve activeCard so modal displays the drawn card
        return {
          ...landingResolved,
          activeCard: card,
        };
      }

      return afterCardState;
    }

    case 'PROPERTY':
    case 'STATION':
    case 'UTILITY': {
      const ownerId = state.propertyOwnership[tile.id];
      if (!ownerId) {
        // Unowned: player can buy or pass (triggering auction)
        return refreshAllNetWorth({
          ...state,
          turnPhase: 'ACTION',
          takeoverCandidate: null,
          upgradeCandidate: null,
        });
      }

      if (ownerId === player.id) {
        // Check if property can be upgraded (houses or castle)
        if (tile.type === 'PROPERTY' && tile.houseCost && !state.mortgagedProperties[tile.id]) {
          const currentHouses = player.houses[tile.id] || 0;
          const currentHotels = player.hotels[tile.id] || 0;
          if (currentHotels === 0) {
            const isHotelUpgrade = currentHouses >= 4;
            return refreshAllNetWorth({
              ...state,
              turnPhase: 'ACTION',
              takeoverCandidate: null,
              upgradeCandidate: {
                propertyId: tile.id,
                cost: tile.houseCost,
                currentHouses,
                hasHotel: false,
                isHotelUpgrade,
              },
              events: [
                createEvent(
                  `🏡 ${player.name} trở về dinh thự của mình: "${tile.name}". Bạn có thể nâng cấp thêm ${
                    isHotelUpgrade ? 'Lâu Đài Hogwarts (Cấp tối đa)' : 'Túp Lều'
                  } với giá ${tile.houseCost}G!`,
                  'info',
                  player.id
                ),
                ...state.events,
              ],
            });
          }
        }

        return refreshAllNetWorth({
          ...state,
          turnPhase: 'END_TURN',
          upgradeCandidate: null,
          takeoverCandidate: null,
        });
      }

      // Rent owed to another player!
      const owner = state.players.find((p) => p.id === ownerId);
      if (!owner || owner.isBankrupt) {
        return refreshAllNetWorth({ ...state, turnPhase: 'END_TURN', upgradeCandidate: null, takeoverCandidate: null });
      }

      const rent = calculateRent(tile, owner, diceTotal, state);
      if (rent === 0) {
        return refreshAllNetWorth({
          ...state,
          turnPhase: 'END_TURN',
          upgradeCandidate: null,
          takeoverCandidate: null,
          events: [
            createEvent(`"${tile.name}" đang bị thế chấp. ${player.name} được miễn tiền thuê!`, 'info', player.id),
            ...state.events,
          ],
        });
      }

      const debtRes = resolveDebtOrLiquidate(state, player, rent, owner.id, `tiền thuê "${tile.name}"`);
      const afterDebtPlayer = debtRes.state.players.find((p) => p.id === player.id);

      // Check Hostile Takeover: If debtor survived and property is not mortgaged
      const takeoverCost = calculateTakeoverCost(tile, owner);
      const canTakeover =
        afterDebtPlayer &&
        !debtRes.isBankrupt &&
        afterDebtPlayer.balance >= takeoverCost &&
        !state.mortgagedProperties[tile.id];

      const nextTurnPhase = canTakeover ? 'ACTION' : 'END_TURN';
      const takeoverCandidate: TakeoverCandidate | null = canTakeover
        ? {
            propertyId: tile.id,
            cost: takeoverCost,
            ownerId: owner.id,
            ownerName: owner.name,
          }
        : null;

      return {
        ...debtRes.state,
        turnPhase: nextTurnPhase,
        takeoverCandidate,
        upgradeCandidate: null,
        lastRentPayment: {
          debtorId: player.id,
          creditorId: owner.id,
          amount: rent,
          tileId: tile.id,
          timestamp: Date.now(),
          isTax: false,
        },
      };
    }

    default:
      return { ...state, turnPhase: 'END_TURN' };
  }
}

function concludeAuction(state: GameState, winnerId: string | null): GameState {
  if (!state.auction) return { ...state, turnPhase: 'END_TURN' };
  const tile = HOGWARTS_TILES.find((t) => t.id === state.auction!.propertyId);
  if (!tile) return { ...state, auction: null, turnPhase: 'END_TURN' };

  if (!winnerId) {
    return {
      ...state,
      auction: null,
      turnPhase: 'END_TURN',
      events: [
        createEvent(`🔨 Không ai trả giá cho "${tile.name}". Ô đất vẫn thuộc về ngân hàng.`, 'info'),
        ...state.events,
      ],
    };
  }

  const winner = state.players.find((p) => p.id === winnerId);
  if (!winner || winner.balance < state.auction.currentBid) {
    return { ...state, auction: null, turnPhase: 'END_TURN' };
  }

  const cost = state.auction.currentBid;
  const updatedWinner: Player = {
    ...winner,
    balance: winner.balance - cost,
    properties: [...winner.properties, tile.id],
  };

  return refreshAllNetWorth({
    ...state,
    players: state.players.map((p) => (p.id === winner.id ? updatedWinner : p)),
    propertyOwnership: { ...state.propertyOwnership, [tile.id]: winner.id },
    auction: null,
    turnPhase: 'END_TURN',
    events: [
      createEvent(`🎉 ĐẤU GIÁ THÀNH CÔNG! ${winner.name} sở hữu "${tile.name}" với giá ${cost} Galleons!`, 'success', winner.id),
      ...state.events,
    ],
  });
}

function advanceTurn(state: GameState): GameState {
  const activePlayers = state.players.filter((p) => !p.isBankrupt);
  if (activePlayers.length <= 1) {
    return {
      ...state,
      turnPhase: 'GAME_OVER',
      winner: activePlayers[0] || null,
    };
  }

  // If the player rolled a double and is not in jail, they get another turn!
  const currentPlayer = state.players[state.currentPlayerIndex];
  if (state.consecutiveDoubles > 0 && !currentPlayer.inJail && !currentPlayer.isBankrupt) {
    return refreshAllNetWorth({
      ...state,
      turnPhase: 'ROLL',
      dice: null,
      auction: null,
      activeCard: null,
      takeoverCandidate: null,
      upgradeCandidate: null,
      lastRentPayment: null,
      turnSecondsRemaining: state.maxTurnSeconds || 60,
      events: [
        createEvent(`🎲 ${currentPlayer.name} được gieo tiếp vì tung số đôi! (Lần ${state.consecutiveDoubles})`, 'info', currentPlayer.id),
        ...state.events,
      ],
    });
  }

  let nextIndex = (state.currentPlayerIndex + 1) % state.players.length;
  while (state.players[nextIndex].isBankrupt) {
    nextIndex = (nextIndex + 1) % state.players.length;
  }

  const nextTurnNumber = nextIndex === 0 ? state.turnNumber + 1 : state.turnNumber;

  let rentMultiplier = state.rentMultiplier || 1;
  const maxRentMultiplier = state.maxRentMultiplier || 2;
  let nextEscalationRound = state.nextEscalationRound || (Math.floor(Math.random() * 4) + 4);
  let activeEscalationEvent = state.activeEscalationEvent || null;
  let newEvents = state.events;

  // When crossing into a new round, check if randomized escalation milestone is met
  if (nextIndex === 0 && nextTurnNumber > state.turnNumber) {
    if (nextTurnNumber >= nextEscalationRound && rentMultiplier < maxRentMultiplier) {
      rentMultiplier = Math.min(maxRentMultiplier, rentMultiplier * 2);
      const escalationMsg = `☠️ BÃO LỜI NGUYỄN HẮC ÁM (VÒNG ${nextTurnNumber})! Voldemort và Tử Thần Thực Tử trỗi dậy — TOÀN BỘ TIỀN THUÊ ĐẤT VÀ THUẾ NHÂN ĐÔI (X${rentMultiplier})!`;
      activeEscalationEvent = {
        multiplier: rentMultiplier,
        round: nextTurnNumber,
        timestamp: Date.now(),
        message: escalationMsg,
      };
      newEvents = [
        createEvent(escalationMsg, 'error'),
        ...state.events,
      ];
    }
  }

  return refreshAllNetWorth({
    ...state,
    currentPlayerIndex: nextIndex,
    turnPhase: 'ROLL',
    turnNumber: nextTurnNumber,
    dice: null,
    consecutiveDoubles: 0,
    auction: null,
    activeCard: null,
    takeoverCandidate: null,
    upgradeCandidate: null,
    lastRentPayment: null,
    turnSecondsRemaining: state.maxTurnSeconds || 60,
    rentMultiplier,
    nextEscalationRound,
    maxRentMultiplier,
    activeEscalationEvent,
    events: newEvents,
  });
}

/**
 * Automatically resolves a turn when the player's 1-minute time expires.
 * Auto-rolls dice, auto-decides properties, auto-dismisses cards, and ends turns
 * to guarantee the game never hangs or stalls.
 */
export function handleTurnTimeout(state: GameState): GameState {
  if (state.turnPhase === 'GAME_OVER') return state;

  const currentPlayer = state.players[state.currentPlayerIndex];
  if (!currentPlayer || currentPlayer.isBankrupt) {
    return advanceTurn(state);
  }

  // 1. If active card modal is open, dismiss it
  if (state.activeCard) {
    const afterDismiss = gameReducer(
      {
        ...state,
        turnSecondsRemaining: state.maxTurnSeconds || 60,
        events: [
          createEvent(
            `⏱️ ${currentPlayer.name} đã hết 1 phút lượt đi! Tự động thu cất Thẻ Phép.`,
            'warning',
            currentPlayer.id
          ),
          ...state.events,
        ],
      },
      { type: 'DISMISS_CARD' }
    );
    if (afterDismiss.turnPhase === 'END_TURN') {
      return gameReducer(afterDismiss, { type: 'END_TURN' });
    }
    return afterDismiss;
  }

  // 2. If in ROLL phase: auto-roll the dice
  if (state.turnPhase === 'ROLL') {
    const stateWithNotice: GameState = {
      ...state,
      turnSecondsRemaining: state.maxTurnSeconds || 60,
      events: [
        createEvent(
          `⏱️ ${currentPlayer.name} đã quá thời gian 1 phút! Game tự động gieo xúc xắc và xử lý lượt.`,
          'warning',
          currentPlayer.id
        ),
        ...state.events,
      ],
    };
    const afterRoll = gameReducer(stateWithNotice, { type: 'ROLL_DICE' });

    // After rolling, if landed on unowned property, auto-decide immediately:
    if (afterRoll.turnPhase === 'ACTION') {
      const autoAction = getBotAction(afterRoll, currentPlayer) || { type: 'PASS_PROPERTY' };
      const afterAction = gameReducer(afterRoll, autoAction);
      if (afterAction.turnPhase === 'END_TURN') {
        return gameReducer(afterAction, { type: 'END_TURN' });
      }
      return afterAction;
    }

    if (afterRoll.turnPhase === 'END_TURN') {
      return gameReducer(afterRoll, { type: 'END_TURN' });
    }

    return afterRoll;
  }

  // 3. If in ACTION phase: auto-buy or pass property, or skip hostile takeover
  if (state.turnPhase === 'ACTION') {
    if (state.takeoverCandidate) {
      const afterAction = gameReducer(
        {
          ...state,
          turnSecondsRemaining: state.maxTurnSeconds || 60,
          events: [
            createEvent(
              `⏱️ ${currentPlayer.name} đã quá 1 phút suy nghĩ! Tự động bỏ qua thâu tóm cưỡng chế.`,
              'info',
              currentPlayer.id
            ),
            ...state.events,
          ],
        },
        { type: 'PASS_PROPERTY' }
      );
      if (afterAction.turnPhase === 'END_TURN') {
        return gameReducer(afterAction, { type: 'END_TURN' });
      }
      return afterAction;
    }

    const autoAction = getBotAction(state, currentPlayer) || { type: 'PASS_PROPERTY' };
    const afterAction = gameReducer(
      {
        ...state,
        turnSecondsRemaining: state.maxTurnSeconds || 60,
        events: [
          createEvent(
            `⏱️ ${currentPlayer.name} đã quá 1 phút suy nghĩ! Trợ lý ma thuật tự động ra quyết định.`,
            'warning',
            currentPlayer.id
          ),
          ...state.events,
        ],
      },
      autoAction
    );
    if (afterAction.turnPhase === 'END_TURN') {
      return gameReducer(afterAction, { type: 'END_TURN' });
    }
    return afterAction;
  }

  // 4. If in END_TURN phase: auto-end turn
  if (state.turnPhase === 'END_TURN') {
    return gameReducer(
      {
        ...state,
        turnSecondsRemaining: state.maxTurnSeconds || 60,
        events: [
          createEvent(
            `⏱️ ${currentPlayer.name} đã quá thời gian 1 phút! Game tự động kết thúc lượt.`,
            'info',
            currentPlayer.id
          ),
          ...state.events,
        ],
      },
      { type: 'END_TURN' }
    );
  }

  return advanceTurn(state);
}
