import { GameState, Player, CardConfig, GameEvent } from './types';
import { HOGWARTS_TILES } from './boardData';
import { calculateNetWorth } from './rulesEngine';

export function createEvent(message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', playerId?: string): GameEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
    timestamp: Date.now(),
    message,
    type,
    playerId,
  };
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
      ? `💸 ${debtor.name} dừng chân tại đất của ${creditor.name} và đã trả ${amount} Galleons ${reason}!`
      : `⚖️ ${debtor.name} đã nộp ${amount} Galleons ${reason}!`;

    return {
      state: refreshAllNetWorth({
        ...state,
        players: updatedPlayers,
        events: [createEvent(notice, creditorId ? 'warning' : 'info', debtor.id), ...state.events],
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

  // Case 3: Debtor CAN raise enough cash. Perform orderly emergency liquidation:
  let currentBalance = debtor.balance;
  const currentHouses = { ...debtor.houses };
  const currentHotels = { ...debtor.hotels };
  const newMortgages = { ...state.mortgagedProperties };
  const liquidationEvents: string[] = [];

  // Step A: Sell castles (hotels) down to cottages first
  for (const propId of debtor.properties) {
    if (currentBalance >= amount) break;
    const hotelCount = currentHotels[propId] || 0;
    if (hotelCount > 0) {
      const tile = HOGWARTS_TILES.find((t) => t.id === propId);
      const houseCost = tile?.houseCost || 50;
      const hotelRefund = Math.floor(houseCost / 2);
      currentHotels[propId] = 0;
      currentHouses[propId] = 4;
      currentBalance += hotelRefund;
      liquidationEvents.push(`hạ cấp Lâu Đài tại "${tile?.name || propId}" (+${hotelRefund}G)`);
    }
  }

  // Step B: Sell cottages one by one across properties
  while (currentBalance < amount) {
    let foundHouse = false;
    for (const propId of debtor.properties) {
      const houseCount = currentHouses[propId] || 0;
      if (houseCount > 0) {
        const tile = HOGWARTS_TILES.find((t) => t.id === propId);
        const houseCost = tile?.houseCost || 50;
        const refund = Math.floor(houseCost / 2);
        currentHouses[propId] = houseCount - 1;
        currentBalance += refund;
        liquidationEvents.push(`dỡ 1 Túp Lều tại "${tile?.name || propId}" (+${refund}G)`);
        foundHouse = true;
        if (currentBalance >= amount) break;
      }
    }
    if (!foundHouse) break;
  }

  // Step C: If still below debt amount, mortgage properties (only those with 0 houses in color group)
  for (const propId of debtor.properties) {
    if (currentBalance >= amount) break;
    if (newMortgages[propId]) continue; // already mortgaged

    const tile = HOGWARTS_TILES.find((t) => t.id === propId);
    if (!tile || !tile.mortgageValue) continue;

    // Check if color group has any remaining houses
    if (tile.colorGroup) {
      const groupTiles = HOGWARTS_TILES.filter((t) => t.colorGroup === tile.colorGroup);
      const hasBuildings = groupTiles.some(
        (t) => (currentHouses[t.id] || 0) > 0 || (currentHotels[t.id] || 0) > 0
      );
      if (hasBuildings) continue; // cannot mortgage yet
    }

    currentBalance += tile.mortgageValue;
    newMortgages[propId] = true;
    liquidationEvents.push(`thế chấp "${tile.name}" (+${tile.mortgageValue}G)`);
  }

  // Now currentBalance is guaranteed >= amount!
  const finalBalance = currentBalance - amount;
  const updatedDebtor: Player = {
    ...debtor,
    balance: Math.max(0, finalBalance),
    houses: currentHouses,
    hotels: currentHotels,
  };

  let updatedPlayers = state.players.map((p) => (p.id === debtor.id ? updatedDebtor : p));

  if (creditorId) {
    updatedPlayers = updatedPlayers.map((p) =>
      p.id === creditorId ? { ...p, balance: p.balance + amount } : p
    );
  }

  const liquidationSummary =
    liquidationEvents.slice(0, 3).join(', ') +
    (liquidationEvents.length > 3 ? ` và ${liquidationEvents.length - 3} tài sản khác` : '');
  const notice = `⚠️ ${debtor.name} thiếu tiền mặt, đã tự động phát mãi [${liquidationSummary}] để thanh toán ${amount}G ${reason}.`;

  return {
    state: refreshAllNetWorth({
      ...state,
      players: updatedPlayers,
      mortgagedProperties: newMortgages,
      events: [createEvent(notice, 'warning', debtor.id), ...state.events],
    }),
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
    // Debtor was active player, set turnPhase to END_TURN so the game can proceed to next player
    turnPhase = 'END_TURN';
  }

  return refreshAllNetWorth({
    ...state,
    players: updatedPlayers,
    propertyOwnership: newPropertyOwnership,
    mortgagedProperties: newMortgages,
    winner,
    turnPhase,
    events: [
      createEvent(`💥 ${debtor.name} đã tuyên bố PHÁ SẢN và rời khỏi cuộc chơi!`, 'error', debtor.id),
      ...state.events,
    ],
  });
}
