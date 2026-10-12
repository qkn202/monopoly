import { GameState, Player, CardConfig, GameEvent, BankruptcyDraft } from './types';
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

  const totalTransferCash = Math.max(0, debtor.balance) + cashFromBuildings;

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

  // Check if only 1 active player remains
  const activePlayers = updatedPlayers.filter((p) => !p.isBankrupt);

  if (activePlayers.length <= 1) {
    const winner = activePlayers[0] || null;
    if (winner) {
      debtor.properties.forEach((tileId) => {
        newPropertyOwnership[tileId] = winner.id;
      });
      updatedPlayers = updatedPlayers.map((p) => {
        if (p.id === winner.id) {
          return {
            ...p,
            balance: p.balance + totalTransferCash,
            properties: [...p.properties, ...debtor.properties],
          };
        }
        return p;
      });
    }
    return refreshAllNetWorth({
      ...state,
      players: updatedPlayers,
      propertyOwnership: newPropertyOwnership,
      mortgagedProperties: newMortgages,
      winner,
      turnPhase: 'GAME_OVER',
      events: [
        createEvent(`💥 ${debtor.name} đã tuyên bố PHÁ SẢN!`, 'error', debtor.id),
        createEvent(
          `🏆 ${winner ? `${winner.name} là người sống sót duy nhất và chiến thắng ván cờ!` : 'Trò chơi kết thúc!'}`,
          'success'
        ),
        ...state.events,
      ],
    });
  }

  // Active players >= 2: Egalitarian Redistribution!
  // Assets of the bankrupt player are divided equally among surviving players.
  // Properties are drafted round-robin with poorest (lowest net worth) choosing first.
  // Uneven remainder properties are converted to cash at 100% price and added to the cash pool.
  const numSurviving = activePlayers.length;
  const debtorProps = [...debtor.properties];
  const totalProps = debtorProps.length;
  const propsPerPlayer = Math.floor(totalProps / numSurviving);

  // Case A: propsPerPlayer === 0 (debtor has 0 lands, or fewer lands than surviving players)
  // None can be divided evenly: liquidate ALL debtor lands to cash at 100% face value!
  if (propsPerPlayer === 0) {
    let propsLiquidationCash = 0;
    const liquidatedNames: string[] = [];
    debtorProps.forEach((propId) => {
      const tile = HOGWARTS_TILES.find((t) => t.id === propId);
      const price = tile?.price || 100;
      propsLiquidationCash += price;
      liquidatedNames.push(tile?.name || propId);
      delete newPropertyOwnership[propId];
      delete newMortgages[propId];
    });

    const totalCashPool = totalTransferCash + propsLiquidationCash;
    const cashPerPlayer = Math.floor(totalCashPool / numSurviving);
    const changeCents = totalCashPool % numSurviving;

    const finalPlayers = updatedPlayers.map((p) => {
      if (p.isBankrupt) return p;
      return {
        ...p,
        balance: p.balance + cashPerPlayer,
      };
    });

    // Advance turn if debtor was current player
    let nextIdx = state.currentPlayerIndex;
    let nextPhase = state.turnPhase;
    if (debtor.id === state.players[state.currentPlayerIndex]?.id) {
      let idx = (nextIdx + 1) % state.players.length;
      while (idx !== nextIdx && finalPlayers[idx].isBankrupt) {
        idx = (idx + 1) % state.players.length;
      }
      nextIdx = idx;
      nextPhase = 'ROLL';
    }

    const explanationMsg =
      liquidatedNames.length > 0
        ? `⚖️ ${debtor.name} phá sản! ${liquidatedNames.length} ô đất lẻ (${liquidatedNames.join(', ')}) được bán cho Ngân hàng lấy ${propsLiquidationCash}G. Tổng ${totalCashPool}G được chia đều: mỗi người nhận +${cashPerPlayer}G!`
        : `⚖️ ${debtor.name} phá sản! Tổng ${totalCashPool}G tiền mặt được chia đều: mỗi người nhận +${cashPerPlayer}G!`;

    return refreshAllNetWorth({
      ...state,
      players: finalPlayers,
      propertyOwnership: newPropertyOwnership,
      mortgagedProperties: newMortgages,
      freeParkingPot: state.freeParkingPot + changeCents,
      currentPlayerIndex: nextIdx,
      turnPhase: nextPhase,
      dice: null,
      consecutiveDoubles: 0,
      auction: null,
      activeCard: null,
      takeoverCandidate: null,
      upgradeCandidate: null,
      lastRentPayment: null,
      turnSecondsRemaining: state.maxTurnSeconds || 60,
      bankruptcyDraft: null,
      events: [
        createEvent(`💥 ${debtor.name} đã tuyên bố PHÁ SẢN!`, 'error', debtor.id),
        createEvent(explanationMsg, 'success'),
        ...state.events,
      ],
    });
  }

  // Case B: propsPerPlayer > 0: Evenly draft lands round-robin, starting with the poorest player!
  // Sort surviving players ascending by net worth (poorest first)
  const sortedSurviving = [...activePlayers].sort((a, b) => a.netWorth - b.netWorth);

  const draftOrder: string[] = [];
  for (let round = 0; round < propsPerPlayer; round++) {
    for (const player of sortedSurviving) {
      draftOrder.push(player.id);
    }
  }

  // Clear debtor's ownership & mortgages while in draft pool
  debtorProps.forEach((propId) => {
    delete newPropertyOwnership[propId];
    delete newMortgages[propId];
  });

  const bankruptcyDraft: BankruptcyDraft = {
    debtorId: debtor.id,
    debtorName: debtor.name,
    creditorId,
    availablePropertyIds: [...debtorProps],
    draftOrder,
    currentDraftIndex: 0,
    propsPerPlayer,
    initialCashPool: totalTransferCash,
    timerSeconds: 15,
    history: [],
  };

  const firstPicker = sortedSurviving[0];

  return refreshAllNetWorth({
    ...state,
    players: updatedPlayers,
    propertyOwnership: newPropertyOwnership,
    mortgagedProperties: newMortgages,
    bankruptcyDraft,
    events: [
      createEvent(`💥 ${debtor.name} đã tuyên bố PHÁ SẢN!`, 'error', debtor.id),
      createEvent(
        `🏛️ Bắt đầu chia đều ${debtorProps.length} bất động sản của ${debtor.name}! Mỗi người được chọn ${propsPerPlayer} ô đất. ${firstPicker.name} (ít tài sản nhất: ${firstPicker.netWorth}G) được ưu tiên chọn trước!`,
        'info',
        firstPicker.id
      ),
      ...state.events,
    ],
  });
}

/**
 * Returns the property ID with the highest price among available property IDs.
 */
export function getBestDraftProperty(propertyIds: string[]): string {
  if (propertyIds.length === 0) return '';
  let bestId = propertyIds[0];
  let bestPrice = -1;
  for (const id of propertyIds) {
    const tile = HOGWARTS_TILES.find((t) => t.id === id);
    const price = tile?.price || 0;
    if (price > bestPrice) {
      bestPrice = price;
      bestId = id;
    }
  }
  return bestId;
}

/**
 * Processes a property pick during a bankruptcy draft.
 * When all picks are finished, converts any remainder properties into cash at 100% price,
 * divides the total cash pool equally among all surviving players, and advances/resumes the turn.
 */
export function selectDraftProperty(state: GameState, playerId: string, propertyId: string): GameState {
  if (!state.bankruptcyDraft) return state;

  const draft = state.bankruptcyDraft;
  const currentDrafterId = draft.draftOrder[draft.currentDraftIndex];
  if (currentDrafterId !== playerId) return state;
  if (!draft.availablePropertyIds.includes(propertyId)) return state;

  const drafter = state.players.find((p) => p.id === playerId);
  const tile = HOGWARTS_TILES.find((t) => t.id === propertyId);
  if (!drafter || !tile) return state;

  // 1. Assign property to drafter
  const newPropertyOwnership = { ...state.propertyOwnership, [propertyId]: playerId };
  const newMortgages = { ...state.mortgagedProperties };
  delete newMortgages[propertyId];

  const updatedPlayers = state.players.map((p) => {
    if (p.id === playerId) {
      return {
        ...p,
        properties: [...p.properties, propertyId],
      };
    }
    return p;
  });

  const nextAvailable = draft.availablePropertyIds.filter((id) => id !== propertyId);
  const nextDraftIndex = draft.currentDraftIndex + 1;
  const historyEntry = {
    playerId,
    playerName: drafter.name,
    propertyId,
    propertyName: tile.name,
  };
  const updatedHistory = [...draft.history, historyEntry];

  // 2. Check if draft continues
  if (nextDraftIndex < draft.draftOrder.length) {
    const nextDrafterId = draft.draftOrder[nextDraftIndex];
    const nextDrafter = updatedPlayers.find((p) => p.id === nextDrafterId);

    return refreshAllNetWorth({
      ...state,
      players: updatedPlayers,
      propertyOwnership: newPropertyOwnership,
      mortgagedProperties: newMortgages,
      bankruptcyDraft: {
        ...draft,
        availablePropertyIds: nextAvailable,
        currentDraftIndex: nextDraftIndex,
        timerSeconds: 15,
        history: updatedHistory,
      },
      events: [
        createEvent(
          `🏛️ ${drafter.name} đã chọn "${tile.name}" từ tài sản của ${draft.debtorName}! Lượt tiếp: ${nextDrafter?.name}`,
          'info',
          drafter.id,
          nextDrafter?.id
        ),
        ...state.events,
      ],
    });
  }

  // 3. Draft is COMPLETE! Process remainder properties & equal cash division
  let remainderCash = 0;
  const remainderNames: string[] = [];
  for (const remId of nextAvailable) {
    const remTile = HOGWARTS_TILES.find((t) => t.id === remId);
    const price = remTile?.price || 100;
    remainderCash += price;
    remainderNames.push(remTile?.name || remId);
    delete newPropertyOwnership[remId];
    delete newMortgages[remId];
  }

  const survivingPlayers = updatedPlayers.filter((p) => !p.isBankrupt);
  const totalCashPool = draft.initialCashPool + remainderCash;
  const cashPerSurviving = survivingPlayers.length > 0 ? Math.floor(totalCashPool / survivingPlayers.length) : 0;
  const changeCents = survivingPlayers.length > 0 ? totalCashPool % survivingPlayers.length : 0;

  const finalPlayers = updatedPlayers.map((p) => {
    if (p.isBankrupt) return p;
    return {
      ...p,
      balance: p.balance + cashPerSurviving,
    };
  });

  // Advance turn if debtor was current player
  let nextIdx = state.currentPlayerIndex;
  let nextPhase = state.turnPhase;
  if (draft.debtorId === state.players[state.currentPlayerIndex]?.id) {
    let idx = (nextIdx + 1) % state.players.length;
    while (idx !== nextIdx && finalPlayers[idx].isBankrupt) {
      idx = (idx + 1) % state.players.length;
    }
    nextIdx = idx;
    nextPhase = 'ROLL';
  } else {
    nextPhase = 'END_TURN';
  }

  const eventsToAdd: GameEvent[] = [
    createEvent(`🏛️ ${drafter.name} đã chọn "${tile.name}" (hoàn tất lượt chọn)!`, 'info', drafter.id),
  ];

  if (remainderNames.length > 0) {
    eventsToAdd.push(
      createEvent(
        `⚖️ ${remainderNames.length} đất lẻ không chia hết (${remainderNames.join(', ')}) được bán lại cho Ngân hàng lấy ${remainderCash}G.`,
        'info'
      )
    );
  }

  eventsToAdd.push(
    createEvent(
      `💰 Tổng quỹ chia lại (${draft.initialCashPool}G tiền mặt + ${remainderCash}G đất lẻ = ${totalCashPool}G) đã chia đều: mỗi người nhận +${cashPerSurviving}G!`,
      'success'
    )
  );

  return refreshAllNetWorth({
    ...state,
    players: finalPlayers,
    propertyOwnership: newPropertyOwnership,
    mortgagedProperties: newMortgages,
    freeParkingPot: state.freeParkingPot + changeCents,
    currentPlayerIndex: nextIdx,
    turnPhase: nextPhase,
    dice: null,
    consecutiveDoubles: 0,
    auction: null,
    activeCard: null,
    takeoverCandidate: null,
    upgradeCandidate: null,
    lastRentPayment: null,
    turnSecondsRemaining: state.maxTurnSeconds || 60,
    bankruptcyDraft: null,
    events: [...eventsToAdd, ...state.events],
  });
}

/** A game saved before `visitedProperties` existed (solo save, room snapshot) gets an empty list per player. */
export const withVisitList = (state: GameState): GameState => ({
  ...state,
  players: state.players.map((p) => (Array.isArray(p.visitedProperties) ? p : { ...p, visitedProperties: [] })),
});
