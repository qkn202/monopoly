import { GameState, GameAction, Player, HouseType, AuctionState, GameEvent, TakeoverCandidate, TileConfig } from './types';
import { HOGWARTS_TILES, HOUSE_INFO, CHARMS_CARDS, POTIONS_CARDS } from './boardData';
import { getBoardTiles } from './boardVariants';
import { calculateRent, canBuildHouse, canBuildHotel, determineLeaderboard, calculateTakeoverCost, canMortgageProperty, canUnmortgageProperty } from './rulesEngine';
import { createEvent, refreshAllNetWorth, executeCardEffect, handleBankruptcy, resolveDebtOrLiquidate, selectDraftProperty, getBestDraftProperty, recordTransaction, finalizeTurnFinances } from './reducerHelpers';
import { getBotAction } from './botAI';
import { g, galleons } from '../hpvn/money';

export function createInitialState(
  playerConfigs: Array<{ name: string; house: HouseType; isAI: boolean; id?: string }>,
  boardSize: number = 40
): GameState {
  const activeBoardTiles = getBoardTiles(boardSize);
  const players: Player[] = playerConfigs.map((cfg, idx) => {
    const houseData = HOUSE_INFO[cfg.house] || HOUSE_INFO.Gryffindor;
    return {
      id: cfg.id || `p-${idx}`,
      name: cfg.name,
      house: cfg.house,
      color: houseData.color,
      tokenIcon: houseData.token,
      balance: 5000, // Starting balance in Galleons
      position: 0,
      properties: [],
      visitedProperties: [], // Track which properties player has visited for building eligibility
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
    events: [createEvent('Ván Cờ Tỷ Phú Hogwarts bắt đầu! Chúc các phù thủy may mắn!', 'success')],
    winner: null,
    freeParkingPot: 0,
    lastRentPayment: null,
    turnSecondsRemaining: 60,
    maxTurnSeconds: 60,
    turboMode: false,
    rentMultiplier: 1,
    nextEscalationRound: 999,
    maxRentMultiplier: 5,
    lastEscalationMinute: 0,
    activeEscalationEvent: null,
    takeoverCandidate: null,
    upgradeCandidate: null,
    turnFinances: [],
    currentTurnTransactions: [],
    playerFinances: players.reduce<Record<string, import('./types').PlayerFinanceStats>>((acc, p) => {
      acc[p.id] = {
        totalIncome: 0,
        totalExpense: 0,
        rentIncome: 0,
        rentExpense: 0,
        taxExpense: 0,
      };
      return acc;
    }, {}),
    propertyRevenue: {},
    boardSize,
    boardTiles: activeBoardTiles,
  };
}

export function gameReducer(state: GameState, action: GameAction): GameState {
  if (state.turnPhase === 'GAME_OVER' && action.type !== 'START_GAME') {
    return state;
  }

  switch (action.type) {
    case 'START_GAME': {
      return createInitialState(action.players, action.boardSize || 40);
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
          events: limitEvents([
            createEvent(`Hết 30 phút, ván kết thúc.`, 'warning'),
            createEvent(`🏆 ${winner?.name} thắng ván với tổng tài sản ${galleons(winner?.netWorth)}!`, 'success'),
            ...state.events,
          ]),
        };
      }

      // Check dynamic tax & rent escalation:
      // Starting from minute 15, every 5 minutes (minute 15, 20, 25...), random multiplier between x2 and x5 until end of game
      const duration = state.timer.durationSeconds || 1800;
      const elapsedSeconds = duration - nextRemaining;
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);

      let rentMultiplier = state.rentMultiplier || 1;
      let activeEscalationEvent = state.activeEscalationEvent || null;
      let lastEscalationMinute = state.lastEscalationMinute ?? 0;
      let events = state.events;

      if (elapsedMinutes >= 15 && elapsedMinutes % 5 === 0 && lastEscalationMinute !== elapsedMinutes) {
        lastEscalationMinute = elapsedMinutes;
        const possibleMultipliers = [2, 3, 4, 5];
        const candidates = possibleMultipliers.filter((m) => m !== rentMultiplier);
        rentMultiplier = candidates.length > 0
          ? candidates[Math.floor(Math.random() * candidates.length)]
          : possibleMultipliers[Math.floor(Math.random() * possibleMultipliers.length)];

        const escalationMsg = `⚡ Lời nguyền Biến động (Phút thứ ${elapsedMinutes}): Toàn bộ thuế và tiền thuê đổi thành x${rentMultiplier}!`;
        activeEscalationEvent = {
          multiplier: rentMultiplier,
          round: state.turnNumber,
          minute: elapsedMinutes,
          timestamp: Date.now(),
          message: escalationMsg,
        };
        events = limitEvents([
          createEvent(escalationMsg, 'error'),
          ...state.events,
        ]);
      }

      const nextBaseState: GameState = {
        ...state,
        timer: { ...state.timer, remainingSeconds: nextRemaining },
        rentMultiplier,
        maxRentMultiplier: 5,
        lastEscalationMinute,
        activeEscalationEvent,
        events,
      };

      // When in AUCTION, auction has its own countdown - only tick global timer
      if (state.turnPhase === 'AUCTION') {
        return nextBaseState;
      }

      // When in Bankruptcy Draft, draft has its own 15s turn countdown per pick
      if (state.bankruptcyDraft) {
        const draft = state.bankruptcyDraft;
        const nextDraftSec = draft.timerSeconds - 1;
        if (nextDraftSec <= 0) {
          // Current drafter timed out: auto-select the highest-price available property
          const currentDrafterId = draft.draftOrder[draft.currentDraftIndex];
          const bestPropId = getBestDraftProperty(draft.availablePropertyIds);
          return selectDraftProperty(
            nextBaseState,
            currentDrafterId,
            bestPropId
          );
        }
        return {
          ...nextBaseState,
          bankruptcyDraft: {
            ...draft,
            timerSeconds: nextDraftSec,
          },
        };
      }

      const nextTurnSec = (state.turnSecondsRemaining ?? 60) - 1;
      if (nextTurnSec <= 0) {
        // Auto-handle turn timeout! Only reset turn timer, keep global timer intact
        return handleTurnTimeout({
          ...nextBaseState,
          turnSecondsRemaining: state.maxTurnSeconds || 60,
        });
      }

      return {
        ...nextBaseState,
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

      const d1 = action.forceRoll ? action.forceRoll[0] : Math.floor(Math.random() * 6) + 1;
      const d2 = action.forceRoll ? action.forceRoll[1] : Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const isDouble = d1 === d2;

      let doublesCount = isDouble ? state.consecutiveDoubles + 1 : 0;

      // Check 3 consecutive doubles -> sent to Azkaban
      const totalTiles = state.boardSize || 40;
      const jailTilePos = Math.floor(totalTiles / 4);
      if (doublesCount >= 3) {
        const jailedPlayer: Player = {
          ...currentPlayer,
          position: jailTilePos,
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
          // Check if player passes GO (position 0) when escaping jail
          // oldPos is jailTilePos, newPos = (jailTilePos + total) % totalTiles
          // If newPos < oldPos, player passed GO
          const oldPos = currentPlayer.position;
          const newPos = (oldPos + total) % totalTiles;
          const passedGO = newPos < oldPos;
          const freedPlayer: Player = {
            ...currentPlayer,
            inJail: false,
            jailTurnsRemaining: 0,
            position: newPos,
            balance: passedGO ? currentPlayer.balance + 500 : currentPlayer.balance,
          };
          const passGoEvent = passedGO
            ? createEvent(`${currentPlayer.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', currentPlayer.id)
            : null;
          let sFreedMove: GameState = {
            ...state,
            players: state.players.map((p) => (p.id === currentPlayer.id ? freedPlayer : p)),
            dice: { die1: d1, die2: d2, total, isDouble },
            consecutiveDoubles: 0,
            events: passGoEvent
              ? [passGoEvent, createEvent(`✨ ${currentPlayer.name} tung số đôi (${d1}-${d2})! Thoát khỏi Azkaban và di chuyển!`, 'success', currentPlayer.id), ...state.events]
              : [createEvent(`✨ ${currentPlayer.name} tung số đôi (${d1}-${d2})! Thoát khỏi Azkaban và di chuyển!`, 'success', currentPlayer.id), ...state.events],
          };
          if (passedGO) {
            sFreedMove = recordTransaction(sFreedMove, {
              playerId: currentPlayer.id,
              amount: 500,
              type: 'INCOME',
              category: 'GO',
              description: 'Lương qua Ga 9¾ (Khởi Hành)',
            });
          }
          return resolveLanding(sFreedMove, freedPlayer, total);
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
            if (debtRes.isBankrupt || debtRes.state.turnPhase === 'BANKRUPTCY') {
              return {
                ...debtRes.state,
                dice: { die1: d1, die2: d2, total, isDouble: false }, // Not a double for jail timeout
                consecutiveDoubles: 0, // Reset doubles - this was not a regular roll
                freeParkingPot: debtRes.state.freeParkingPot + Math.min(150, currentPlayer.balance),
                // Don't override turnPhase - keep BANKRUPTCY from resolveDebtOrLiquidate
              };
            }
            const afterP = debtRes.state.players.find((p) => p.id === currentPlayer.id) || pFreed;
            // Jail position: check if player passes GO (position 0) when freed
            const oldPos = afterP.position;
            const newPos = (oldPos + total) % totalTiles;
            const passedGO = newPos < oldPos;
            const movedPlayer: Player = {
              ...afterP,
              position: newPos,
              balance: passedGO ? afterP.balance + 500 : afterP.balance,
            };
            const passGoEvent = passedGO
              ? createEvent(`${afterP.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', afterP.id)
              : null;
            let sTurn3Move: GameState = {
              ...debtRes.state,
              players: debtRes.state.players.map((p) => (p.id === currentPlayer.id ? movedPlayer : p)),
              dice: { die1: d1, die2: d2, total, isDouble: false }, // Not a double for jail timeout
              consecutiveDoubles: 0, // Reset doubles - this was not a regular roll
              freeParkingPot: debtRes.state.freeParkingPot + 150,
              events: passGoEvent
                ? [passGoEvent, createEvent(`${afterP.name} hết hạn giam, nộp 150G tiền phạt và di chuyển ${total} ô.`, 'info', afterP.id), ...debtRes.state.events]
                : [createEvent(`${afterP.name} hết hạn giam, nộp 150G tiền phạt và di chuyển ${total} ô.`, 'info', afterP.id), ...debtRes.state.events],
            };
            if (passedGO) {
              sTurn3Move = recordTransaction(sTurn3Move, {
                playerId: afterP.id,
                amount: 500,
                type: 'INCOME',
                category: 'GO',
                description: 'Lương qua Ga 9¾ (Khởi Hành)',
              });
            }
            return resolveLanding(sTurn3Move, movedPlayer, total);
          } else {
            const pStay: Player = { ...currentPlayer, jailTurnsRemaining: turnsLeft };
            return refreshAllNetWorth({
              ...state,
              players: state.players.map((p) => (p.id === currentPlayer.id ? pStay : p)),
              dice: { die1: d1, die2: d2, total, isDouble },
              consecutiveDoubles: 0, // Reset doubles when staying in jail
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
      const newPos = (oldPos + total) % totalTiles;
      let balance = currentPlayer.balance;
      let passGoEvent: GameEvent | null = null;

      if (newPos < oldPos) {
        // Passed GO
        balance += 500;
        passGoEvent = createEvent(`${currentPlayer.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', currentPlayer.id);
      }

      const movedPlayer: Player = { ...currentPlayer, position: newPos, balance };
      const updatedPlayers = state.players.map((p) => (p.id === currentPlayer.id ? movedPlayer : p));
      let sWithMove: GameState = {
        ...state,
        players: updatedPlayers,
        dice: { die1: d1, die2: d2, total, isDouble },
        consecutiveDoubles: doublesCount,
        lastRentPayment: null,
        events: passGoEvent ? [passGoEvent, ...state.events] : state.events,
      };

      if (newPos < oldPos) {
        sWithMove = recordTransaction(sWithMove, {
          playerId: currentPlayer.id,
          amount: 500,
          type: 'INCOME',
          category: 'GO',
          description: 'Lương qua Ga 9¾ (Khởi Hành)',
        });
      }

      return resolveLanding(sWithMove, movedPlayer, total);
    }

    case 'BUY_PROPERTY': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      const currentPlayer = state.players[state.currentPlayerIndex];
      if (!tile || !tile.price || currentPlayer.balance < tile.price) return state;

      // Only buy land; must land on it again in a subsequent turn to build/upgrade house
      const updatedPlayer: Player = {
        ...currentPlayer,
        balance: currentPlayer.balance - tile.price,
        properties: [...currentPlayer.properties, tile.id],
      };

      let nextBuyState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === currentPlayer.id ? updatedPlayer : p)),
        propertyOwnership: { ...state.propertyOwnership, [tile.id]: currentPlayer.id },
        turnPhase: 'END_TURN',
        events: [
          createEvent(`🏰 ${currentPlayer.name} đã mua "${tile.name}" với giá ${galleons(tile.price)}!`, 'success', currentPlayer.id),
          ...state.events,
        ],
      });

      return recordTransaction(nextBuyState, {
        playerId: currentPlayer.id,
        amount: tile.price,
        type: 'EXPENSE',
        category: 'BUY',
        description: `Mua đất "${tile.name}"`,
        tileId: tile.id,
      });
    }

    case 'PASS_PROPERTY': {
      if (state.upgradeCandidate) {
        // Player declined building or upgrading owned property -> clear visit and advance to END_TURN
        const propId = state.upgradeCandidate.propertyId;
        const curPlayer = state.players[state.currentPlayerIndex];
        return {
          ...state,
          players: state.players.map((p) =>
            p.id === curPlayer.id
              ? { ...p, visitedProperties: p.visitedProperties.filter((id) => id !== propId) }
              : p
          ),
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

      // Trigger MANDATORY AUTO-AUCTION for unowned property
      const currentPlayer = state.players[state.currentPlayerIndex];
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles[currentPlayer.position];
      if (!tile || state.propertyOwnership[tile.id]) return state;

      const nonBankrupt = state.players.filter((p) => !p.isBankrupt);
      const starterIdx = nonBankrupt.findIndex((p) => p.id === currentPlayer.id);
      const orderedPlayers = starterIdx >= 0
        ? [...nonBankrupt.slice(starterIdx), ...nonBankrupt.slice(0, starterIdx)]
        : nonBankrupt;
      const activeBidders = orderedPlayers.map((p) => p.id);
      const startingBid = Math.max(25, Math.floor((tile.price || 100) * 0.1)); // Minimum 10% of property price or 25G

      const auction: AuctionState = {
        active: true,
        propertyId: tile.id,
        currentBid: startingBid,
        startingBid,
        starterId: currentPlayer.id,
        starterFolded: false,
        highBidderId: null,
        activeBidders,
        currentBidderIndex: 0,
        timerSeconds: state.turboMode ? 4 : 7,
      };

      if (activeBidders.length <= 1) {
        return concludeAuction({ ...state, auction }, currentPlayer.id);
      }

      return {
        ...state,
        auction,
        turnPhase: 'AUCTION',
        events: [
          createEvent(`📢 ${currentPlayer.name} bỏ qua "${tile.name}", bắt đầu đấu giá (khởi điểm ${galleons(startingBid)}).`, 'warning'),
          ...state.events,
        ],
      };
    }

    case 'TAKEOVER_PROPERTY': {
      const currentPlayer = state.players[state.currentPlayerIndex];
      const candidate = state.takeoverCandidate;
      if (!candidate || candidate.propertyId !== action.propertyId) return state;

      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      const previousOwner = state.players.find((p) => p.id === candidate.ownerId);
      if (!tile || !previousOwner || currentPlayer.balance < candidate.cost) return state;

      // RULE: Land upgraded to Castle (Lâu đài) is an impregnable stronghold and cannot be bought out
      if ((previousOwner.hotels[tile.id] || 0) > 0) return state;

      const cost = candidate.cost;
      const buyerId = currentPlayer.id;
      const ownerId = previousOwner.id;

      // Transfer existing buildings intact
      const houses = previousOwner.houses[tile.id] || 0;
      const hotels = previousOwner.hotels[tile.id] || 0;

      // Eligible for immediate 1-building upgrade right in the takeover turn
      const canUpgradeImmediately =
        tile.type === 'PROPERTY' &&
        !!tile.houseCost &&
        !state.mortgagedProperties[tile.id] &&
        hotels === 0;

      const isHotelUpgrade = canUpgradeImmediately && houses >= 4;

      const updatedBuyer: Player = {
        ...currentPlayer,
        balance: currentPlayer.balance - cost,
        properties: [...currentPlayer.properties, tile.id],
        houses: { ...currentPlayer.houses, [tile.id]: houses },
        hotels: { ...currentPlayer.hotels, [tile.id]: hotels },
        visitedProperties: canUpgradeImmediately
          ? [...new Set([...currentPlayer.visitedProperties, tile.id])]
          : currentPlayer.visitedProperties,
      };

      const updatedPrevOwner: Player = {
        ...previousOwner,
        balance: previousOwner.balance + cost,
        properties: previousOwner.properties.filter((id) => id !== tile.id),
        houses: { ...previousOwner.houses, [tile.id]: 0 },
        hotels: { ...previousOwner.hotels, [tile.id]: 0 },
        visitedProperties: previousOwner.visitedProperties.filter((id) => id !== tile.id),
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

      let nextTakeoverState = refreshAllNetWorth({
        ...state,
        players: updatedPlayers,
        propertyOwnership: newPropertyOwnership,
        takeoverCandidate: null,
        turnPhase: canUpgradeImmediately ? 'ACTION' : 'END_TURN',
        upgradeCandidate: canUpgradeImmediately
          ? {
              propertyId: tile.id,
              cost: tile.houseCost!,
              currentHouses: houses,
              hasHotel: false,
              isHotelUpgrade,
            }
          : null,
        events: [
          createEvent(
            `⚡ ${currentPlayer.name} đã chi ${galleons(cost)} (x2 giá trị) mua đứt "${tile.name}" từ tay ${previousOwner.name}!`,
            'success',
            currentPlayer.id,
            previousOwner.id
          ),
          ...(canUpgradeImmediately
            ? [
                createEvent(
                  `🔨 ${currentPlayer.name} được quyền xây thêm 1 ${
                    isHotelUpgrade ? 'Lâu Đài Hogwarts (Cấp tối đa)' : 'Túp Lều'
                  } ngay trong lượt mua đứt với giá ${g(tile.houseCost!)}!`,
                  'info',
                  currentPlayer.id
                ),
              ]
            : []),
          ...state.events,
        ],
      });

      nextTakeoverState = recordTransaction(nextTakeoverState, {
        playerId: currentPlayer.id,
        amount: cost,
        type: 'EXPENSE',
        category: 'TAKEOVER',
        description: `Mua đứt "${tile.name}" từ ${previousOwner.name}`,
        tileId: tile.id,
        counterpartyPlayerId: previousOwner.id,
      });

      nextTakeoverState = recordTransaction(nextTakeoverState, {
        playerId: previousOwner.id,
        amount: cost,
        type: 'INCOME',
        category: 'TAKEOVER',
        description: `Bị mua đứt "${tile.name}" bởi ${currentPlayer.name}`,
        tileId: tile.id,
        counterpartyPlayerId: currentPlayer.id,
      });

      return nextTakeoverState;
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
          timerSeconds: state.turboMode ? 4 : 7,
        },
        events: [
          createEvent(`💰 ${bidder.name} nâng giá lên ${galleons(action.amount)}!`, 'info', bidder.id),
          ...state.events,
        ],
      };
    }

    case 'PASS_BID_TURN': {
      if (!state.auction || !state.auction.active) return state;
      const currentBidderId = state.auction.activeBidders[state.auction.currentBidderIndex];
      if (action.playerId !== currentBidderId) return state;

      const player = state.players.find((p) => p.id === action.playerId);
      const starterId = state.auction.starterId ?? state.auction.activeBidders[0];
      const starterFolded = state.auction.starterFolded ?? false;

      // If only 1 bidder left (e.g. only starter remaining) and no high bidder:
      if (state.auction.activeBidders.length <= 1) {
        let winnerId = state.auction.highBidderId || null;
        if (!winnerId && !starterFolded && state.auction.activeBidders.includes(starterId)) {
          winnerId = starterId;
        }
        return concludeAuction(state, winnerId);
      }

      const nextIndex = (state.auction.currentBidderIndex + 1) % state.auction.activeBidders.length;

      return {
        ...state,
        auction: {
          ...state.auction,
          currentBidderIndex: nextIndex,
          timerSeconds: state.turboMode ? 4 : 7,
        },
        events: [
          createEvent(`⏭️ ${player?.name || 'Người chơi'} nhường lượt ra giá cho người tiếp theo.`, 'info'),
          ...state.events,
        ],
      };
    }

    case 'FOLD_AUCTION': {
      if (!state.auction || !state.auction.active) return state;
      const currentBidderId = state.auction.activeBidders[state.auction.currentBidderIndex];
      if (action.playerId !== currentBidderId) return state;

      const folder = state.players.find((p) => p.id === action.playerId);
      const foldedIndex = state.auction.currentBidderIndex;
      const starterId = state.auction.starterId ?? state.auction.activeBidders[0];
      const isStarterFolding = action.playerId === starterId;
      const starterFolded = (state.auction.starterFolded ?? false) || isStarterFolding;

      // Build new bidders array, preserving order
      const remainingBidders: string[] = [];
      for (let i = 0; i < state.auction.activeBidders.length; i++) {
        if (state.auction.activeBidders[i] !== action.playerId) {
          remainingBidders.push(state.auction.activeBidders[i]);
        }
      }

      // If 1 or 0 bidders left, auction concludes
      if (remainingBidders.length <= 1) {
        let winnerId = state.auction.highBidderId || null;
        if (!winnerId && !starterFolded && remainingBidders.includes(starterId)) {
          winnerId = starterId;
        }
        return concludeAuction(state, winnerId);
      }

      // Adjust currentBidderIndex: if foldedIndex is before the removed slot, keep same index
      // If foldedIndex is at or after the removed slot, subtract 1
      let nextIndex = foldedIndex;
      if (nextIndex >= remainingBidders.length) {
        nextIndex = 0; // Wrap to start if needed
      }

      return {
        ...state,
        auction: {
          ...state.auction,
          starterFolded,
          activeBidders: remainingBidders,
          currentBidderIndex: nextIndex,
          timerSeconds: state.turboMode ? 4 : 7,
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
        const currentBidderId = state.auction.activeBidders[state.auction.currentBidderIndex];
        const currentBidder = state.players.find((p) => p.id === currentBidderId);
        const starterId = state.auction.starterId ?? state.auction.activeBidders[0];
        const starterFolded = state.auction.starterFolded ?? false;

        // If someone has bid before - current bidder times out, auto-fold
        if (state.auction.highBidderId) {
          const isStarter = currentBidderId === starterId;
          const nextStarterFolded = starterFolded || isStarter;
          const remainingBidders = state.auction.activeBidders.filter((id) => id !== currentBidderId);

          if (remainingBidders.length <= 1) {
            // Only high bidder left (or winner) - they win
            return concludeAuction(state, state.auction.highBidderId);
          }

          // Move to next bidder
          const foldedIndex = state.auction.currentBidderIndex;
          let nextIndex = foldedIndex;
          if (nextIndex >= remainingBidders.length) {
            nextIndex = 0;
          }

          return {
            ...state,
            auction: {
              ...state.auction,
              starterFolded: nextStarterFolded,
              activeBidders: remainingBidders,
              currentBidderIndex: nextIndex,
              timerSeconds: state.turboMode ? 4 : 7,
            },
            events: [
              createEvent(`⏰ ${currentBidder?.name || 'Người chơi'} hết giờ và tự động rút lui.`, 'info'),
              ...state.events,
            ],
          };
        } else {
          // No one has bid yet (highBidderId === null)
          // SPECIAL RULE: The auction starter MUST explicitly click "Rút lui" (FOLD_AUCTION) to fold.
          // Timing out does NOT fold the starter!
          if (currentBidderId === starterId) {
            if (state.auction.activeBidders.length <= 1) {
              return concludeAuction(state, !starterFolded ? starterId : null);
            }

            // Move to next bidder without removing the starter from activeBidders
            const nextIndex = (state.auction.currentBidderIndex + 1) % state.auction.activeBidders.length;

            return {
              ...state,
              auction: {
                ...state.auction,
                currentBidderIndex: nextIndex,
                timerSeconds: state.turboMode ? 4 : 7,
              },
              events: [
                createEvent(`⏰ Hết giờ lượt đầu của ${currentBidder?.name || 'người bắt đầu'}, chuyển lượt cho người tiếp theo.`, 'info'),
                ...state.events,
              ],
            };
          } else {
            // Subsequent bidder timed out without bidding -> auto-folds!
            const remainingBidders = state.auction.activeBidders.filter((id) => id !== currentBidderId);

            if (remainingBidders.length <= 1) {
              let winnerId: string | null = null;
              if (!starterFolded && remainingBidders.includes(starterId)) {
                winnerId = starterId;
              } else if (remainingBidders.length === 1 && state.auction.highBidderId) {
                winnerId = remainingBidders[0];
              }
              return concludeAuction(state, winnerId);
            }

            // Move to next bidder (auction continues)
            const foldedIndex = state.auction.currentBidderIndex;
            let nextIndex = foldedIndex;
            if (nextIndex >= remainingBidders.length) {
              nextIndex = 0;
            }

            return {
              ...state,
              auction: {
                ...state.auction,
                activeBidders: remainingBidders,
                currentBidderIndex: nextIndex,
                timerSeconds: state.turboMode ? 4 : 7,
              },
              events: [
                createEvent(`⏰ ${currentBidder?.name || 'Người chơi'} hết giờ và tự động rút lui.`, 'info'),
                ...state.events,
              ],
            };
          }
        }
      }
      return {
        ...state,
        auction: { ...state.auction, timerSeconds: nextTimer },
      };
    }

    case 'BUILD_HOUSE': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      const player = actingOwner(state, tile, action.playerId);
      if (!tile || !tile.houseCost || !player) return state;

      const check = canBuildHouse(player, tile.id, state);
      if (!check.allowed) return state;

      const currentCount = player.houses[tile.id] || 0;
      // Clear visitedProperties after building - must visit again before next build
      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - tile.houseCost,
        houses: { ...player.houses, [tile.id]: currentCount + 1 },
        visitedProperties: player.visitedProperties.filter((id) => id !== tile.id),
      };

      const isLandedUpgrade = state.turnPhase === 'ACTION' && state.upgradeCandidate?.propertyId === tile.id;

      let nextBuildState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        turnPhase: isLandedUpgrade ? 'END_TURN' : state.turnPhase,
        upgradeCandidate: isLandedUpgrade ? null : state.upgradeCandidate,
        events: [
          createEvent(`🛖 ${player.name} xây thêm 1 Túp Lều tại "${tile.name}" (−${g(tile.houseCost)})`, 'success', player.id),
          ...state.events,
        ],
      });

      return recordTransaction(nextBuildState, {
        playerId: player.id,
        amount: tile.houseCost,
        type: 'EXPENSE',
        category: 'BUILD',
        description: `Xây túp lều tại "${tile.name}"`,
        tileId: tile.id,
      });
    }

    case 'BUILD_HOTEL': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      const player = actingOwner(state, tile, action.playerId);
      if (!tile || !tile.houseCost || !player) return state;

      const check = canBuildHotel(player, tile.id, state);
      if (!check.allowed) return state;

      // Clear visitedProperties after building - must visit again before next build
      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - tile.houseCost,
        houses: { ...player.houses, [tile.id]: 0 },
        hotels: { ...player.hotels, [tile.id]: 1 },
        visitedProperties: player.visitedProperties.filter((id) => id !== tile.id),
      };

      const isLandedUpgrade = state.turnPhase === 'ACTION' && state.upgradeCandidate?.propertyId === tile.id;

      let nextHotelState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        turnPhase: isLandedUpgrade ? 'END_TURN' : state.turnPhase,
        upgradeCandidate: isLandedUpgrade ? null : state.upgradeCandidate,
        events: [
          createEvent(`🏰 ${player.name} nâng cấp lên Lâu Đài Hogwarts tại "${tile.name}" (−${g(tile.houseCost)})`, 'success', player.id),
          ...state.events,
        ],
      });

      return recordTransaction(nextHotelState, {
        playerId: player.id,
        amount: tile.houseCost,
        type: 'EXPENSE',
        category: 'BUILD',
        description: `Nâng cấp Lâu Đài Hogwarts tại "${tile.name}"`,
        tileId: tile.id,
      });
    }

    case 'SELL_HOUSE': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      if (!tile || !tile.houseCost) return state;
      const player = actingOwner(state, tile, action.playerId);
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
        let nextState = refreshAllNetWorth({
          ...state,
          players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
          events: [
            createEvent(`🏚️ ${player.name} hạ cấp Lâu Đài xuống 4 Túp Lều tại "${tile.name}" (+${g(refund)})`, 'info', player.id),
            ...state.events,
          ],
        });
        nextState = recordTransaction(nextState, {
          playerId: player.id,
          amount: refund,
          type: 'INCOME',
          category: 'MORTGAGE',
          description: `Hạ cấp Lâu Đài tại "${tile.name}"`,
          tileId: tile.id,
        });
        // Auto-check if player can now pay debt after selling
        return checkAndPayDebt(nextState);
      }

      if (currentHouses <= 0) return state;

      const refund = Math.floor(tile.houseCost / 2);
      const updatedPlayer: Player = {
        ...player,
        balance: player.balance + refund,
        houses: { ...player.houses, [tile.id]: currentHouses - 1 },
      };

      let nextState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        events: [
          createEvent(`🏚️ ${player.name} dỡ bớt 1 Túp Lều tại "${tile.name}" (+${g(refund)})`, 'info', player.id),
          ...state.events,
        ],
      });
      nextState = recordTransaction(nextState, {
        playerId: player.id,
        amount: refund,
        type: 'INCOME',
        category: 'MORTGAGE',
        description: `Dỡ 1 Túp Lều tại "${tile.name}"`,
        tileId: tile.id,
      });
      // Auto-check if player can now pay debt after selling
      return checkAndPayDebt(nextState);
    }

    case 'MORTGAGE_PROPERTY': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      if (!tile || !tile.mortgageValue) return state;

      const player = actingOwner(state, tile, action.playerId);
      if (!player) return state;

      const check = canMortgageProperty(player, tile.id, state);
      if (!check.allowed) {
        if (check.reason && !player.isAI) {
          return {
            ...state,
            events: [
              createEvent(`⚠️ Không thể thế chấp "${tile.name}": ${check.reason}`, 'warning', player.id),
              ...state.events,
            ],
          };
        }
        return state;
      }

      const updatedPlayer: Player = {
        ...player,
        balance: player.balance + tile.mortgageValue,
      };

      let nextState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        mortgagedProperties: { ...state.mortgagedProperties, [tile.id]: true },
        events: [
          createEvent(`📜 ${player.name} thế chấp "${tile.name}" nhận ${galleons(tile.mortgageValue)}.`, 'warning', player.id),
          ...state.events,
        ],
      });
      nextState = recordTransaction(nextState, {
        playerId: player.id,
        amount: tile.mortgageValue,
        type: 'INCOME',
        category: 'MORTGAGE',
        description: `Thế chấp "${tile.name}"`,
        tileId: tile.id,
      });
      // Auto-check if player can now pay debt after mortgaging
      return checkAndPayDebt(nextState);
    }

    case 'UNMORTGAGE_PROPERTY': {
      const activeTiles = state.boardTiles || HOGWARTS_TILES;
      const tile = activeTiles.find((t) => t.id === action.propertyId);
      if (!tile || !tile.mortgageValue) return state;

      const player = actingOwner(state, tile, action.playerId);
      if (!player) return state;

      const check = canUnmortgageProperty(player, tile.id, state);
      if (!check.allowed) {
        if (check.reason && !player.isAI) {
          return {
            ...state,
            events: [
              createEvent(`⚠️ Không thể chuộc "${tile.name}": ${check.reason}`, 'warning', player.id),
              ...state.events,
            ],
          };
        }
        return state;
      }

      const cost = check.cost ?? Math.floor(tile.mortgageValue * 1.1);

      const updatedPlayer: Player = {
        ...player,
        balance: player.balance - cost,
      };

      const newMortgages = { ...state.mortgagedProperties };
      delete newMortgages[tile.id];

      let nextUnmState = refreshAllNetWorth({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        mortgagedProperties: newMortgages,
        events: [
          createEvent(`✨ ${player.name} chuộc lại "${tile.name}" với ${galleons(cost)}.`, 'success', player.id),
          ...state.events,
        ],
      });

      return recordTransaction(nextUnmState, {
        playerId: player.id,
        amount: cost,
        type: 'EXPENSE',
        category: 'MORTGAGE',
        description: `Chuộc thế chấp "${tile.name}"`,
        tileId: tile.id,
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

      const stateAfterPayment: GameState = recordTransaction({
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        freeParkingPot: state.freeParkingPot + 150,
        events: [
          createEvent(`${player.name} nộp 150G tiền bảo lãnh rời khỏi Ngục Azkaban!`, 'success', player.id),
          ...state.events,
        ],
      }, {
        playerId: player.id,
        amount: 150,
        type: 'EXPENSE',
        category: 'JAIL',
        description: 'Nộp phạt bảo lãnh rời Ngục Azkaban',
      });

      // Player paid bail and is freed - they can now roll and move in the same turn
      // Auto-roll dice for them (similar to when rolling doubles in jail)
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const isDouble = d1 === d2;

      const newPos = (updatedPlayer.position + total) % (state.boardSize || 40);
      const freedPlayer: Player = {
        ...updatedPlayer,
        position: newPos,
      };

      // If passed GO while exiting jail, still award 500G
      if (newPos < updatedPlayer.position) {
        freedPlayer.balance += 500;
      }

      const stateWithMove: GameState = {
        ...stateAfterPayment,
        players: stateAfterPayment.players.map((p) => (p.id === player.id ? freedPlayer : p)),
        dice: { die1: d1, die2: d2, total, isDouble },
        consecutiveDoubles: isDouble ? 1 : 0,
        events: [
          createEvent(`🎲 ${player.name} trả tiền bảo lãnh và tự động gieo xúc xắc (${d1}-${d2}) di chuyển ${total} ô!`, 'info', player.id),
          ...stateAfterPayment.events,
        ],
      };

      return resolveLanding(stateWithMove, freedPlayer, total);
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

      const stateAfterCard: GameState = {
        ...state,
        players: state.players.map((p) => (p.id === player.id ? updatedPlayer : p)),
        events: [
          createEvent(`✨ ${player.name} sử dụng Thẻ Miễn Giam và rời khỏi Azkaban!`, 'success', player.id),
          ...state.events,
        ],
      };

      // Player used jail card and is freed - they can now roll and move in the same turn
      // Auto-roll dice for them
      const d1 = Math.floor(Math.random() * 6) + 1;
      const d2 = Math.floor(Math.random() * 6) + 1;
      const total = d1 + d2;
      const isDouble = d1 === d2;

      const newPos = (updatedPlayer.position + total) % (state.boardSize || 40);
      const freedPlayer: Player = {
        ...updatedPlayer,
        position: newPos,
      };

      // If passed GO while exiting jail, still award 500G
      if (newPos < updatedPlayer.position) {
        freedPlayer.balance += 500;
      }

      const stateWithMove: GameState = {
        ...stateAfterCard,
        players: stateAfterCard.players.map((p) => (p.id === player.id ? freedPlayer : p)),
        dice: { die1: d1, die2: d2, total, isDouble },
        consecutiveDoubles: isDouble ? 1 : 0,
        events: [
          createEvent(`🎲 ${player.name} thoát Azkaban và tự động gieo xúc xắc (${d1}-${d2}) di chuyển ${total} ô!`, 'info', player.id),
          ...stateAfterCard.events,
        ],
      };

      return resolveLanding(stateWithMove, freedPlayer, total);
    }

    case 'DISMISS_CARD': {
      return { ...state, activeCard: null };
    }

    case 'DECLARE_BANKRUPTCY': {
      if (state.turnPhase !== 'BANKRUPTCY' || !state.bankruptcyInfo) {
        return state;
      }
      const { debtorId, creditorId, amount, reason } = state.bankruptcyInfo;
      const debtor = state.players.find((p) => p.id === debtorId);
      if (!debtor) return state;

      // Process the bankruptcy - transfer to creditor or bank
      const result = handleBankruptcy(state, debtor, creditorId, reason, undefined, amount);
      return {
        ...result,
        bankruptcyInfo: null,
      };
    }

    case 'SELECT_DRAFT_PROPERTY': {
      if (!state.bankruptcyDraft) return state;
      const targetPlayerId =
        action.playerId || state.bankruptcyDraft.draftOrder[state.bankruptcyDraft.currentDraftIndex];
      return selectDraftProperty(state, targetPlayerId, action.propertyId);
    }

    case 'END_TURN': {
      // If in BANKRUPTCY phase, check if player can now pay the debt
      if (state.turnPhase === 'BANKRUPTCY' && state.bankruptcyInfo) {
        const info = state.bankruptcyInfo;
        const debtor = state.players.find((p) => p.id === info.debtorId);
        if (debtor && debtor.balance >= info.amount) {
          const { amount, creditorId, reason } = info;
          let updatedPlayers = state.players.map((p) =>
            p.id === debtor.id ? { ...p, balance: p.balance - amount } : p
          );
          if (creditorId) {
            updatedPlayers = updatedPlayers.map((p) =>
              p.id === creditorId ? { ...p, balance: p.balance + amount } : p
            );
          }
          const creditor = creditorId ? state.players.find((p) => p.id === creditorId) : null;
          let debtPaidState = refreshAllNetWorth({
            ...state,
            players: updatedPlayers,
            turnPhase: 'END_TURN',
            bankruptcyInfo: null,
            events: [
              createEvent(
                `💸 ${debtor.name} đã thanh toán ${amount}G cho ${reason}${creditor ? ` cho ${creditor.name}` : ''}!`,
                'success',
                debtor.id,
                creditor?.id
              ),
              ...state.events,
            ],
          });

          debtPaidState = recordTransaction(debtPaidState, {
            playerId: debtor.id,
            amount,
            type: 'EXPENSE',
            category: creditorId ? 'RENT' : 'TAX',
            description: `Thanh toán nợ ${amount}G (${reason})`,
            counterpartyPlayerId: creditorId,
          });

          if (creditorId) {
            debtPaidState = recordTransaction(debtPaidState, {
              playerId: creditorId,
              amount,
              type: 'INCOME',
              category: 'RENT',
              description: `Thu hồi nợ ${amount}G từ ${debtor.name}`,
              counterpartyPlayerId: debtor.id,
            });
          }

          return debtPaidState;
        }
        // Not enough money - stay in bankruptcy phase
        return state;
      }
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
              ? 'Đã bật siêu tốc 2x: bot đi nhanh hơn, đấu giá còn 4 giây.'
              : 'Đã về tốc độ thường.',
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

/** The player acting on a tile (the given one, else whoever's turn it is), only when they own it. */
function actingOwner(state: GameState, tile: TileConfig | undefined, playerId?: string): Player | undefined {
  const actorId = playerId || state.players[state.currentPlayerIndex]?.id;
  return tile && actorId && state.propertyOwnership[tile.id] === actorId ? state.players.find((p) => p.id === actorId) : undefined;
}

function resolveLanding(state: GameState, player: Player, diceTotal: number): GameState {
  const activeTiles = state.boardTiles || HOGWARTS_TILES;
  const tile = activeTiles[player.position];
  if (!tile) return { ...state, turnPhase: 'END_TURN' };

  switch (tile.type) {
    case 'GO':
    case 'JAIL':
      return { ...state, turnPhase: 'END_TURN' };

    case 'FREE_PARKING': {
      const pot = state.freeParkingPot;
      if (pot > 0) {
        const luckyPlayer: Player = { ...player, balance: player.balance + pot };
        let nextPotState = refreshAllNetWorth({
          ...state,
          players: state.players.map((p) => (p.id === player.id ? luckyPlayer : p)),
          freeParkingPot: 0,
          turnPhase: 'END_TURN',
          events: [
            createEvent(`🎉 ${player.name} bước vào Phòng Yêu Cầu và nhặt được kho báu ${galleons(pot)}!`, 'success', player.id),
            ...state.events,
          ],
        });
        return recordTransaction(nextPotState, {
          playerId: player.id,
          amount: pot,
          type: 'INCOME',
          category: 'PARKING',
          description: 'Nhận kho báu Phòng Yêu Cầu (Free Parking)',
        });
      }
      return { ...state, turnPhase: 'END_TURN' };
    }

    case 'TAX': {
      const baseTax = tile.price || 100;
      const taxAmt = baseTax * (state.rentMultiplier || 1);
      const res = resolveDebtOrLiquidate(state, player, taxAmt, undefined, `thuế tại "${tile.name}"`, tile.id);

      // If player went bankrupt or entered BANKRUPTCY phase, do NOT override with END_TURN!
      if (res.isBankrupt || res.state.turnPhase === 'BANKRUPTCY') {
        return res.state;
      }

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
      const jailPos = Math.floor((state.boardSize || 40) / 4);
      const jailedPlayer: Player = {
        ...player,
        position: jailPos,
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

      // Add this tile to player's visitedProperties if they own it (for building eligibility)
      let updatedPlayer = player;
      if (ownerId === player.id && tile.type === 'PROPERTY') {
        if (!player.visitedProperties.includes(tile.id)) {
          updatedPlayer = {
            ...player,
            visitedProperties: [...player.visitedProperties, tile.id],
          };
        }
      }

      if (!ownerId) {
        // Unowned: player can buy or pass (triggering auction)
        const playersWithVisit = state.players.map((p) =>
          p.id === updatedPlayer.id ? updatedPlayer : p
        );
        return refreshAllNetWorth({
          ...state,
          players: playersWithVisit,
          turnPhase: 'ACTION',
          takeoverCandidate: null,
          upgradeCandidate: null,
        });
      }

      if (ownerId === player.id) {
        // Check if property can be upgraded (houses or castle)
        const hasMortgagedInGroup = tile.colorGroup
          ? activeTiles.filter((t) => t.type === 'PROPERTY' && t.colorGroup === tile.colorGroup).some((t) => !!state.mortgagedProperties[t.id])
          : false;
        if (tile.type === 'PROPERTY' && tile.houseCost && !state.mortgagedProperties[tile.id] && !hasMortgagedInGroup) {
          const currentHouses = updatedPlayer.houses[tile.id] || 0;
          const currentHotels = updatedPlayer.hotels[tile.id] || 0;
          if (currentHotels === 0) {
            const isHotelUpgrade = currentHouses >= 4;
            const playersWithVisit = state.players.map((p) =>
              p.id === updatedPlayer.id ? updatedPlayer : p
            );
            return refreshAllNetWorth({
              ...state,
              players: playersWithVisit,
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
                  } với giá ${g(tile.houseCost)}!`,
                  'info',
                  player.id
                ),
                ...state.events,
              ],
            });
          }
        }

        const playersWithVisit = state.players.map((p) =>
          p.id === updatedPlayer.id ? updatedPlayer : p
        );
        return refreshAllNetWorth({
          ...state,
          players: playersWithVisit,
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
        const ownerPf = state.playerFinances?.[owner.id] || {
          totalIncome: 0,
          totalExpense: 0,
          rentIncome: 0,
          rentExpense: 0,
          taxExpense: 0,
          landVisitsCount: 0,
        };
        const nextPf = {
          ...state.playerFinances,
          [owner.id]: {
            ...ownerPf,
            landVisitsCount: (ownerPf.landVisitsCount || 0) + 1,
          },
        };
        return refreshAllNetWorth({
          ...state,
          playerFinances: nextPf,
          turnPhase: 'END_TURN',
          upgradeCandidate: null,
          takeoverCandidate: null,
          events: [
            createEvent(`"${tile.name}" đang bị thế chấp. ${player.name} được miễn tiền thuê!`, 'info', player.id, owner.id),
            ...state.events,
          ],
        });
      }

      const debtRes = resolveDebtOrLiquidate(state, player, rent, owner.id, `tiền thuê "${tile.name}"`, tile.id);

      // If player went bankrupt or entered BANKRUPTCY phase, do NOT override with takeover or END_TURN!
      if (debtRes.isBankrupt || debtRes.state.turnPhase === 'BANKRUPTCY') {
        return debtRes.state;
      }

      const afterDebtPlayer = debtRes.state.players.find((p) => p.id === player.id);

      // Check Hostile Takeover: If debtor survived, property is not mortgaged, and has NO castle
      const hasCastle = (owner.hotels[tile.id] || 0) > 0;
      const takeoverCost = calculateTakeoverCost(tile, owner);
      const canTakeover =
        afterDebtPlayer &&
        !debtRes.isBankrupt &&
        !hasCastle &&
        takeoverCost > 0 &&
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
  const activeTiles = state.boardTiles || HOGWARTS_TILES;
  const tile = activeTiles.find((t) => t.id === state.auction!.propertyId);
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
    const reasonMsg = winner && winner.balance < state.auction.currentBid
      ? `❌ ${winner.name} không đủ ${galleons(state.auction.currentBid)} để thanh toán. "${tile.name}" vẫn thuộc về ngân hàng.`
      : `🔨 Không ai trả giá cho "${tile.name}". Ô đất vẫn thuộc về ngân hàng.`;
    return {
      ...state,
      auction: null,
      turnPhase: 'END_TURN',
      events: [
        createEvent(reasonMsg, 'warning'),
        ...state.events,
      ],
    };
  }

  const cost = state.auction.currentBid;
  // Winner acquires property; must land on it in a subsequent turn to upgrade
  const updatedWinner: Player = {
    ...winner,
    balance: winner.balance - cost,
    properties: [...winner.properties, tile.id],
  };

  const starterId = state.auction.starterId ?? state.auction.activeBidders[0];
  const isStarterDefaultWin = !state.auction.highBidderId && winner.id === starterId;
  const winMessage = isStarterDefaultWin
    ? `🏛️ Không ai tham gia đấu giá! "${tile.name}" thuộc về ${winner.name} với giá khởi điểm ${galleons(cost)}.`
    : `🎉 ${winner.name} sở hữu "${tile.name}" với giá ${galleons(cost)}!`;

  let nextAuctionWinState = refreshAllNetWorth({
    ...state,
    players: state.players.map((p) => (p.id === winner.id ? updatedWinner : p)),
    propertyOwnership: { ...state.propertyOwnership, [tile.id]: winner.id },
    auction: null,
    turnPhase: 'END_TURN',
    events: [
      createEvent(winMessage, 'success', winner.id),
      ...state.events,
    ],
  });

  return recordTransaction(nextAuctionWinState, {
    playerId: winner.id,
    amount: cost,
    type: 'EXPENSE',
    category: 'AUCTION',
    description: isStarterDefaultWin ? `Mua "${tile.name}" theo giá khởi điểm đấu giá` : `Thắng đấu giá "${tile.name}"`,
    tileId: tile.id,
  });
}

function advanceTurn(state: GameState): GameState {
  const currentPlayer = state.players[state.currentPlayerIndex];
  let finalizedState = state;
  if (currentPlayer) {
    finalizedState = finalizeTurnFinances(state, currentPlayer);
  }

  const activePlayers = finalizedState.players.filter((p) => !p.isBankrupt);

  // Edge case: No active players remaining - game ends with no winner
  if (activePlayers.length === 0) {
    return {
      ...finalizedState,
      turnPhase: 'GAME_OVER',
      winner: null,
      events: [
        createEvent('💀 Tất cả người chơi đã phá sản! Không có người chiến thắng!', 'error'),
        ...finalizedState.events,
      ],
    };
  }

  // Only 1 active player remaining - they win!
  if (activePlayers.length === 1) {
    return {
      ...finalizedState,
      turnPhase: 'GAME_OVER',
      winner: activePlayers[0],
      events: [
        createEvent(`🏆 ${activePlayers[0].name} là người chiến thắng duy nhất còn lại!`, 'success'),
        ...finalizedState.events,
      ],
    };
  }

  // If the player rolled a double and is not in jail, they get another turn!
  if (finalizedState.consecutiveDoubles > 0 && !currentPlayer.inJail && !currentPlayer.isBankrupt) {
    return refreshAllNetWorth({
      ...finalizedState,
      turnPhase: 'ROLL',
      dice: null,
      auction: null,
      activeCard: null,
      takeoverCandidate: null,
      upgradeCandidate: null,
      lastRentPayment: null,
      turnSecondsRemaining: finalizedState.maxTurnSeconds || 60,
      events: [
        createEvent(`🎲 ${currentPlayer.name} được gieo tiếp vì tung số đôi! (Lần ${finalizedState.consecutiveDoubles})`, 'info', currentPlayer.id),
        ...finalizedState.events,
      ],
    });
  }

  let nextIndex = (finalizedState.currentPlayerIndex + 1) % finalizedState.players.length;
  while (finalizedState.players[nextIndex].isBankrupt) {
    nextIndex = (nextIndex + 1) % finalizedState.players.length;
  }

  const nextTurnNumber = nextIndex === 0 ? finalizedState.turnNumber + 1 : finalizedState.turnNumber;

  const rentMultiplier = finalizedState.rentMultiplier || 1;
  const maxRentMultiplier = finalizedState.maxRentMultiplier || 5;
  const lastEscalationMinute = finalizedState.lastEscalationMinute ?? 0;
  const activeEscalationEvent = finalizedState.activeEscalationEvent || null;
  const newEvents = finalizedState.events;

  return refreshAllNetWorth({
    ...finalizedState,
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
    turnSecondsRemaining: finalizedState.maxTurnSeconds || 60,
    rentMultiplier,
    maxRentMultiplier,
    lastEscalationMinute,
    activeEscalationEvent,
    events: newEvents,
  });
}

/**
 * Automatically resolves a turn when the player's 1-minute time expires.
 * Auto-rolls dice, auto-decides properties, auto-dismisses cards, and ends turns
 * to guarantee the game never hangs or stalls.
 */
/**
 * Check if debtor can now pay debt after selling houses/mortgaging properties,
 * and automatically process payment and exit BANKRUPTCY phase.
 */
function checkAndPayDebt(state: GameState): GameState {
  // Only check if in BANKRUPTCY phase with pending debt
  if (state.turnPhase !== 'BANKRUPTCY' || !state.bankruptcyInfo) {
    return state;
  }

  const info = state.bankruptcyInfo;
  const debtor = state.players.find((p) => p.id === info.debtorId);

  // If debtor has enough balance now, pay the debt automatically
  if (debtor && debtor.balance >= info.amount) {
    const { amount, creditorId, reason } = info;
    let updatedPlayers = state.players.map((p) =>
      p.id === debtor.id ? { ...p, balance: p.balance - amount } : p
    );
    if (creditorId) {
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === creditorId ? { ...p, balance: p.balance + amount } : p
      );
    }
    const creditor = creditorId ? state.players.find((p) => p.id === creditorId) : null;

    // Add tax to free parking pot if this was a tax payment (no creditor)
    let updatedState = state;
    if (!creditorId) {
      updatedState = { ...state, freeParkingPot: state.freeParkingPot + amount };
    }

    let nextPaidState = refreshAllNetWorth({
      ...updatedState,
      players: updatedPlayers,
      turnPhase: 'END_TURN',
      bankruptcyInfo: null,
      events: [
        createEvent(
          `💸 ${debtor.name} đã thanh toán ${amount}G cho ${reason}${creditor ? ` cho ${creditor.name}` : ''}!`,
          'success',
          debtor.id,
          creditor?.id
        ),
        ...state.events,
      ],
    });

    nextPaidState = recordTransaction(nextPaidState, {
      playerId: debtor.id,
      amount,
      type: 'EXPENSE',
      category: creditorId ? 'RENT' : 'TAX',
      description: `Thanh toán nợ ${amount}G (${reason})`,
      counterpartyPlayerId: creditorId,
    });

    if (creditorId) {
      nextPaidState = recordTransaction(nextPaidState, {
        playerId: creditorId,
        amount,
        type: 'INCOME',
        category: 'RENT',
        description: `Thu hồi nợ ${amount}G từ ${debtor.name}`,
        counterpartyPlayerId: debtor.id,
      });
    }

    return nextPaidState;
  }

  // Not enough money yet - stay in bankruptcy phase
  return state;
}

/**
 * Limits the event log to the most recent MAX_EVENTS entries.
 */
function limitEvents(events: GameEvent[]): GameEvent[] {
  const MAX_EVENTS = 100;
  return events.slice(0, MAX_EVENTS);
}

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

  // 2. If in BANKRUPTCY phase: auto-declare bankruptcy if player can't pay
  if (state.turnPhase === 'BANKRUPTCY' && state.bankruptcyInfo) {
    const debtor = state.players.find((p) => p.id === state.bankruptcyInfo!.debtorId);
    if (debtor && debtor.balance < state.bankruptcyInfo.amount) {
      return gameReducer(
        {
          ...state,
          turnSecondsRemaining: state.maxTurnSeconds || 60,
          events: [
            createEvent(
              `⏱️ ${currentPlayer.name} đã hết 1 phút! Không đủ tiền trả nợ - tự động tuyên bố phá sản.`,
              'warning',
              currentPlayer.id
            ),
            ...state.events,
          ],
        },
        { type: 'DECLARE_BANKRUPTCY' }
      );
    }
    // If player has enough money, auto-pay
    return gameReducer(state, { type: 'END_TURN' });
  }

  // 3. If in ROLL phase: auto-roll the dice
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
