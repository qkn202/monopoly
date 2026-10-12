import { GameState, Player, CardConfig, GameEvent } from './types';
import { HOGWARTS_TILES } from './boardData';
import { calculateNetWorth } from './rulesEngine';
import { g, galleons } from '../hpvn/money';

export function createEvent(
  message: string,
  type: 'info' | 'success' | 'warning' | 'error' = 'info',
  playerId?: string,
  targetPlayerId?: string,
  involvedPlayerIds?: string[]
): GameEvent {
  const allInvolved = new Set<string>();
  if (playerId) allInvolved.add(playerId);
  if (targetPlayerId) allInvolved.add(targetPlayerId);
  if (involvedPlayerIds) involvedPlayerIds.forEach((id) => allInvolved.add(id));

  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
    message,
    type,
    playerId,
    targetPlayerId,
    involvedPlayerIds: allInvolved.size > 0 ? Array.from(allInvolved) : undefined,
  };
}

/**
 * Determines whether a game event is relevant to a specific player's personal log.
 * An event is relevant if:
 * 1. The player is the primary actor (event.playerId === player.id)
 * 2. The player is the target/beneficiary (event.targetPlayerId === player.id)
 * 3. The player is in the list of involved players (event.involvedPlayerIds?.includes(player.id))
 * 4. Or the message specifically mentions the player's name
 * 5. Truly global events that affect everyone (game start, round-end, dark curse, etc.)
 */
export function isEventRelevantToPlayer(
  event: GameEvent,
  player: Player,
  allPlayers: Player[]
): boolean {
  if (!player) return false;

  // 1. Explicit ID matches
  if (event.playerId === player.id) return true;
  if (event.targetPlayerId === player.id) return true;
  if (event.involvedPlayerIds && event.involvedPlayerIds.includes(player.id)) return true;

  // 2. Name matching in message
  const pName = player.name.trim();
  const firstName = pName.split(' ')[0];
  const mentionsPlayer =
    (pName.length > 0 && event.message.includes(pName)) ||
    (firstName.length >= 3 && event.message.includes(firstName));

  if (mentionsPlayer) return true;

  // 3. Victory / Game-over / Round-timeout announcements affect everyone
  if (
    event.message.includes('thắng ván') ||
    event.message.includes('chiến thắng') ||
    event.message.includes('kết thúc') ||
    event.message.includes('Tất cả người chơi đã phá sản')
  ) {
    return true;
  }

  // 4. Truly global announcements that don't belong to any specific player
  const hasSpecificActors =
    !!event.playerId ||
    !!event.targetPlayerId ||
    (!!event.involvedPlayerIds && event.involvedPlayerIds.length > 0);

  if (!hasSpecificActors) {
    // If it mentions any other player exclusively, it belongs to them
    const mentionsOtherPlayer = allPlayers.some((other) => {
      if (other.id === player.id) return false;
      const otherName = other.name.trim();
      const otherFirst = otherName.split(' ')[0];
      return (
        (otherName.length > 0 && event.message.includes(otherName)) ||
        (otherFirst.length >= 3 && event.message.includes(otherFirst))
      );
    });

    if (!mentionsOtherPlayer) {
      // Truly global event (e.g. game start, dark curse, turbo toggle)
      return true;
    }
  }

  return false;
}

export function refreshAllNetWorth(state: GameState): GameState {
  const updatedPlayers = state.players.map((p) => ({
    ...p,
    netWorth: calculateNetWorth(p, state),
  }));
  return { ...state, players: updatedPlayers };
}

export function executeCardEffect(
  state: GameState,
  player: Player,
  card: CardConfig
): { nextState: GameState; extraEvent?: GameEvent } {
  let p = { ...player };
  let s = { ...state };

  switch (card.action) {
    case 'MONEY': {
      const amt = card.amount || 0;
      if (amt < 0) {
        const debt = Math.abs(amt);
        const debtRes = resolveDebtOrLiquidate(s, p, debt, undefined, `thẻ phạt: "${card.title}"`);
        s = debtRes.state;
        if (!debtRes.isBankrupt) {
          s = { ...s, freeParkingPot: s.freeParkingPot + debt };
        }
        p = s.players.find((item) => item.id === p.id) || p;
      } else {
        p.balance += amt;
        s.players = s.players.map((item) => (item.id === p.id ? p : item));
      }
      break;
    }
    case 'MOVE': {
      const steps = card.amount || 0;
      const oldPos = p.position;
      // Use proper modulo: ((oldPos + steps) % 40 + 40) % 40 to handle negative steps
      const newPos = ((oldPos + steps) % 40 + 40) % 40;
      // Check if player wrapped around the board (crossed position 0/GO)
      if (newPos < oldPos) {
        // Passed GO
        p.balance += 500;
        s.events = [createEvent(`${p.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', p.id), ...s.events];
      }
      p.position = newPos;
      s.players = s.players.map((item) => (item.id === p.id ? p : item));
      break;
    }
    case 'MOVE_TO': {
      const target = card.targetTileIndex ?? 0;
      // Check if player crossed position 0 (GO) to reach target
      // This happens when: target < oldPos AND not going to jail (position 10)
      if (target < p.position && target !== 10) {
        // Passed GO (except when sent to Jail at 10)
        p.balance += 500;
        s.events = [createEvent(`${p.name} vượt qua Ga 9¾ và nhận 500 Galleons!`, 'success', p.id), ...s.events];
      }
      p.position = target;
      s.players = s.players.map((item) => (item.id === p.id ? p : item));
      break;
    }
    case 'JAIL': {
      p.position = 10;
      p.inJail = true;
      p.jailTurnsRemaining = 3;
      s.events = [createEvent(`${p.name} bị giải vào Ngục Azkaban!`, 'error', p.id), ...s.events];
      s.players = s.players.map((item) => (item.id === p.id ? p : item));
      break;
    }
    case 'GET_OUT_OF_JAIL': {
      p.getOutOfJailCards += 1;
      s.events = [createEvent(`${p.name} nhận được thẻ miễn giam Azkaban!`, 'success', p.id), ...s.events];
      s.players = s.players.map((item) => (item.id === p.id ? p : item));
      break;
    }
    case 'REPAIRS': {
      const perHouse = card.amount || 25;
      const perHotel = perHouse * 4;
      let totalCost = 0;
      p.properties.forEach((propId) => {
        totalCost += (p.houses[propId] || 0) * perHouse;
        totalCost += (p.hotels[propId] || 0) * perHotel;
      });
      if (totalCost > 0) {
        const debtRes = resolveDebtOrLiquidate(s, p, totalCost, undefined, `trùng tu tài sản ("${card.title}")`);
        s = debtRes.state;
        if (!debtRes.isBankrupt) {
          s = { ...s, freeParkingPot: s.freeParkingPot + totalCost };
        }
        p = s.players.find((item) => item.id === p.id) || p;
      }
      break;
    }
    case 'PAY_PLAYERS': {
      const amt = card.amount || 20;
      for (const other of s.players) {
        if (other.id !== p.id && !other.isBankrupt) {
          const currentOther = s.players.find((item) => item.id === other.id);
          if (currentOther && !currentOther.isBankrupt) {
            const debtRes = resolveDebtOrLiquidate(s, currentOther, amt, p.id, `quà tặng cho ${p.name}`);
            s = debtRes.state;
            p = s.players.find((item) => item.id === p.id) || p;
          }
        }
      }
      break;
    }
  }

  return { nextState: s };
}

/**
 * Handles debt settlement:
 * If debtor has sufficient cash: pays debt directly.
 * If cash is insufficient: performs orderly emergency liquidation (castles -> cottages -> mortgaging unbuilt properties).
 * If total assets are insufficient: triggers bankruptcy cleanly.
 */
export function resolveDebtOrLiquidate(
  state: GameState,
  debtor: Player,
  amount: number,
  creditorId?: string,
  reason: string = 'tiền phạt/thuê'
): { state: GameState; isBankrupt: boolean } {
  // Case 1: Debtor has sufficient cash on hand
  if (debtor.balance >= amount) {
    const updatedDebtor: Player = { ...debtor, balance: debtor.balance - amount };
    let updatedPlayers = state.players.map((p) => (p.id === debtor.id ? updatedDebtor : p));

    if (creditorId) {
      updatedPlayers = updatedPlayers.map((p) =>
        p.id === creditorId ? { ...p, balance: p.balance + amount } : p
      );
    }

    const creditor = creditorId ? state.players.find((p) => p.id === creditorId) : null;
    const notice = creditor
      ? `💸 ${debtor.name} dừng chân tại đất của ${creditor.name} và đã trả ${galleons(amount)} ${reason}!`
      : `⚖️ ${debtor.name} đã nộp ${galleons(amount)} ${reason}!`;

    return {
      state: refreshAllNetWorth({
        ...state,
        players: updatedPlayers,
        events: [createEvent(notice, creditorId ? 'warning' : 'info', debtor.id, creditorId), ...state.events],
      }),
      isBankrupt: false,
    };
  }

  // Case 2: Debtor lacks cash on hand. Calculate total maximum funds debtor can raise
  let availableFunds = debtor.balance;
  debtor.properties.forEach((propId) => {
    const tile = HOGWARTS_TILES.find((t) => t.id === propId);
    if (!tile) return;
    const houseCount = debtor.houses[propId] || 0;
    const hotelCount = debtor.hotels[propId] || 0;
    const houseCost = tile.houseCost || 50;

    availableFunds += houseCount * Math.floor(houseCost / 2);
    availableFunds += hotelCount * Math.floor((houseCost * 5) / 2);

    if (!state.mortgagedProperties[propId] && tile.mortgageValue) {
      availableFunds += tile.mortgageValue;
    }
  });

  if (availableFunds < amount) {
    // True bankruptcy! Cannot raise enough cash even with 100% liquidation!
    return {
      state: handleBankruptcy(state, debtor, creditorId),
      isBankrupt: true,
    };
  }

  // Case 3: Debtor CAN raise enough cash. Enter BANKRUPTCY phase for player to choose
  // Player can now mortgage properties or sell houses to raise funds manually
  return {
    state: {
      ...state,
      turnPhase: 'BANKRUPTCY',
      bankruptcyInfo: {
        debtorId: debtor.id,
        creditorId,
        amount,
        reason,
      },
      events: [
        createEvent(
          `⚠️ ${debtor.name} không đủ tiền! Cần ${amount} Galleons nhưng chỉ có ${debtor.balance}G. Hãy thế chấp tài sản hoặc bán nhà để trả nợ!`,
          'warning',
          debtor.id
        ),
        ...state.events,
      ],
    },
    isBankrupt: false,
  };
}

export function handleBankruptcy(state: GameState, debtor: Player, creditorId?: string): GameState {
  // 1. Sell any remaining houses/hotels on debtor's properties to bank at 50% value
  let cashFromBuildings = 0;
  debtor.properties.forEach((propId) => {
    const tile = HOGWARTS_TILES.find((t) => t.id === propId);
    if (!tile) return;
    const houseCount = debtor.houses[propId] || 0;
    const hotelCount = debtor.hotels[propId] || 0;
    const houseCost = tile.houseCost || 50;
    cashFromBuildings += houseCount * Math.floor(houseCost / 2);
    cashFromBuildings += hotelCount * Math.floor((houseCost * 5) / 2);
  });

  const totalTransferCash = debtor.balance + cashFromBuildings;

  const updatedDebtor: Player = {
    ...debtor,
    isBankrupt: true,
    balance: 0,
    netWorth: 0,
    properties: [],
    houses: {},
    hotels: {},
  };

  let newPropertyOwnership = { ...state.propertyOwnership };
  let newMortgages = { ...state.mortgagedProperties };
  let updatedPlayers = state.players.map((p) => (p.id === debtor.id ? updatedDebtor : p));

  if (creditorId) {
    // Transfer debtor's properties, cash, AND buildings (houses/hotels) to creditor
    debtor.properties.forEach((tileId) => {
      newPropertyOwnership[tileId] = creditorId;
    });
    updatedPlayers = updatedPlayers.map((p) => {
      if (p.id === creditorId) {
        // Merge debtor's houses and hotels with creditor's existing ones
        const mergedHouses = { ...p.houses };
        const mergedHotels = { ...p.hotels };
        debtor.properties.forEach((tileId) => {
          const housesToAdd = debtor.houses[tileId] || 0;
          const hotelsToAdd = debtor.hotels[tileId] || 0;
          mergedHouses[tileId] = (mergedHouses[tileId] || 0) + housesToAdd;
          mergedHotels[tileId] = (mergedHotels[tileId] || 0) + hotelsToAdd;
        });
        return {
          ...p,
          balance: p.balance + totalTransferCash,
          properties: [...p.properties, ...debtor.properties],
          houses: mergedHouses,
          hotels: mergedHotels,
        };
      }
      return p;
    });
  } else {
    // Return properties to bank (unowned and unmortgaged)
    debtor.properties.forEach((tileId) => {
      delete newPropertyOwnership[tileId];
      delete newMortgages[tileId];
    });
  }

  // Check if only 1 active player remains
  const activePlayers = updatedPlayers.filter((p) => !p.isBankrupt);
  let winner = state.winner;
  let turnPhase = state.turnPhase;

  if (activePlayers.length <= 1) {
    winner = activePlayers[0] || null;
    turnPhase = 'GAME_OVER';
  } else if (debtor.id === state.players[state.currentPlayerIndex]?.id) {
    // Debtor was current player - need to advance to next non-bankrupt player immediately
    // We can't just set turnPhase to END_TURN because the bankrupt player might still be "current"
    // We need to advance the turn immediately
    const currentIdx = state.currentPlayerIndex;
    let nextIdx = (currentIdx + 1) % state.players.length;
    while (nextIdx !== currentIdx && updatedPlayers[nextIdx].isBankrupt) {
      nextIdx = (nextIdx + 1) % state.players.length;
    }
    // If we found a non-bankrupt player, advance to them
    if (nextIdx !== currentIdx || !updatedPlayers[nextIdx].isBankrupt) {
      return refreshAllNetWorth({
        ...state,
        players: updatedPlayers,
        propertyOwnership: newPropertyOwnership,
        mortgagedProperties: newMortgages,
        winner,
        currentPlayerIndex: nextIdx,
        turnPhase: 'ROLL',
        dice: null,
        consecutiveDoubles: 0,
        auction: null,
        activeCard: null,
        takeoverCandidate: null,
        upgradeCandidate: null,
        lastRentPayment: null,
        turnSecondsRemaining: state.maxTurnSeconds || 60,
        events: [
          createEvent(
            creditorId
              ? `💥 ${debtor.name} đã tuyên bố PHÁ SẢN trước ${state.players.find((p) => p.id === creditorId)?.name || 'chủ nợ'}!`
              : `💥 ${debtor.name} đã tuyên bố PHÁ SẢN và rời khỏi cuộc chơi!`,
            'error',
            debtor.id,
            creditorId
          ),
          createEvent(`➡️ Lượt tự động chuyển cho ${updatedPlayers[nextIdx]?.name || 'người chơi tiếp theo'}`, 'info', updatedPlayers[nextIdx]?.id),
          ...state.events,
        ],
      });
    }
  }

  return refreshAllNetWorth({
    ...state,
    players: updatedPlayers,
    propertyOwnership: newPropertyOwnership,
    mortgagedProperties: newMortgages,
    winner,
    turnPhase,
    events: [
      createEvent(`💥 ${debtor.name} phá sản và rời ván.`, 'error', debtor.id, creditorId),
      ...state.events,
    ],
  });
}

/** A game saved before `visitedProperties` existed (solo save, room snapshot) gets an empty list per player. */
export const withVisitList = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => (Array.isArray(p.visitedProperties) ? p : { ...p, visitedProperties: [] })),
});
