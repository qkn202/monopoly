import { GameState, Player } from '../src/core/types';
import { HOGWARTS_TILES } from '../src/core/boardData';
import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { handleBankruptcy, resolveDebtOrLiquidate, selectDraftProperty, getBestDraftProperty } from '../src/core/reducerHelpers';
import { chooseBotDraftProperty } from '../src/core/botAI';

console.log('⚖️ RUNNING BANKRUPTCY REDISTRIBUTION TEST SUITE...\n');

const tile1 = HOGWARTS_TILES[1]; // Borgin & Burkes (200G)
const tile2 = HOGWARTS_TILES[3]; // Quán Cái Vạc Lủng (200G)
const tile3 = HOGWARTS_TILES[6]; // Bồ Câu Đưa Thư (240G)
const tile4 = HOGWARTS_TILES[8]; // Tiệm Giáp Phù Thủy (240G)
const tile5 = HOGWARTS_TILES[9]; // Tiệm Cú Eeylops (280G)

const baseState = createInitialState([
  { name: 'Harry Potter', house: 'Gryffindor', isAI: false, id: 'harry' },
  { name: 'Draco Malfoy', house: 'Slytherin', isAI: false, id: 'draco' },
  { name: 'Ron Weasley', house: 'Gryffindor', isAI: false, id: 'ron' },
]);

// =========================================================================
// TEST 1: Even Distribution with Remainder Lands (Draft + Liquidation)
// =========================================================================
console.log('Test 1: Even Distribution with Remainder Lands...');
{
  const state: GameState = {
    ...baseState,
    propertyOwnership: {
      [tile1.id]: 'ron',
      [tile2.id]: 'ron',
      [tile3.id]: 'ron',
      [tile4.id]: 'ron',
      [tile5.id]: 'ron',
    },
    players: [
      {
        ...baseState.players[0], // Harry (poorest)
        id: 'harry',
        balance: 1000,
        netWorth: 1000,
        properties: [],
      },
      {
        ...baseState.players[1], // Draco (richest)
        id: 'draco',
        balance: 3000,
        netWorth: 3000,
        properties: [],
      },
      {
        ...baseState.players[2], // Ron (debtor)
        id: 'ron',
        balance: 500,
        netWorth: 1660,
        properties: [tile1.id, tile2.id, tile3.id, tile4.id, tile5.id],
      },
    ],
  };

  const debtor = state.players[2];
  const afterBankruptcy = handleBankruptcy(state, debtor);

  // 1. Debtor must be marked bankrupt
  const finalRon = afterBankruptcy.players.find((p) => p.id === 'ron')!;
  if (!finalRon.isBankrupt || finalRon.balance !== 0) {
    throw new Error('Debtor should be bankrupt with 0 balance');
  }

  // 2. Draft should be initialized
  const draft = afterBankruptcy.bankruptcyDraft;
  if (!draft) {
    throw new Error('bankruptcyDraft must be initialized for 5 properties among 2 players');
  }

  if (draft.propsPerPlayer !== 2) {
    throw new Error(`Expected propsPerPlayer to be 2, got ${draft.propsPerPlayer}`);
  }

  // 3. Poorest player (Harry, net worth 1000) MUST pick first!
  if (draft.draftOrder[0] !== 'harry') {
    throw new Error(`Poorest player Harry should pick first! Got: ${draft.draftOrder[0]}`);
  }

  // Draft order should alternate: Harry, Draco, Harry, Draco
  const expectedOrder = ['harry', 'draco', 'harry', 'draco'];
  if (JSON.stringify(draft.draftOrder) !== JSON.stringify(expectedOrder)) {
    throw new Error(`Expected draft order ${expectedOrder}, got ${draft.draftOrder}`);
  }

  console.log('  ✓ Poorest player Harry correctly assigned first pick');
  console.log('  ✓ Draft order verified: [Harry, Draco, Harry, Draco]');

  // Step 4: Execute Draft picks
  // Pick 1: Harry chooses tile5 (280G)
  const afterPick1 = gameReducer(afterBankruptcy, {
    type: 'SELECT_DRAFT_PROPERTY',
    propertyId: tile5.id,
    playerId: 'harry',
  });
  if (!afterPick1.players.find((p) => p.id === 'harry')?.properties.includes(tile5.id)) {
    throw new Error('Harry should now own tile5');
  }

  // Pick 2: Draco chooses tile4 (240G)
  const afterPick2 = gameReducer(afterPick1, {
    type: 'SELECT_DRAFT_PROPERTY',
    propertyId: tile4.id,
    playerId: 'draco',
  });
  if (!afterPick2.players.find((p) => p.id === 'draco')?.properties.includes(tile4.id)) {
    throw new Error('Draco should now own tile4');
  }

  // Pick 3: Harry chooses tile3 (240G)
  const afterPick3 = gameReducer(afterPick2, {
    type: 'SELECT_DRAFT_PROPERTY',
    propertyId: tile3.id,
    playerId: 'harry',
  });

  // Pick 4 (Final Pick): Draco chooses tile2 (200G)
  // Leftover property should be tile1 (200G)
  const afterFinalPick = gameReducer(afterPick3, {
    type: 'SELECT_DRAFT_PROPERTY',
    propertyId: tile2.id,
    playerId: 'draco',
  });

  // 5. Verify Draft Finished & Remainder Liquidated
  if (afterFinalPick.bankruptcyDraft !== null) {
    throw new Error('bankruptcyDraft must be null after all rounds complete');
  }

  // Remainder tile1 price is 200G. Initial debtor cash was 500G.
  // Total cash pool = 500G + 200G = 700G.
  // Divided between Harry and Draco: +350G each!
  const harryFinal = afterFinalPick.players.find((p) => p.id === 'harry')!;
  const dracoFinal = afterFinalPick.players.find((p) => p.id === 'draco')!;

  if (harryFinal.balance !== 1000 + 350) {
    throw new Error(`Harry balance should be 1350, got ${harryFinal.balance}`);
  }
  if (dracoFinal.balance !== 3000 + 350) {
    throw new Error(`Draco balance should be 3350, got ${dracoFinal.balance}`);
  }

  // Remainder tile1 should not be owned by anyone (sold to bank)
  if (afterFinalPick.propertyOwnership[tile1.id]) {
    throw new Error(`Remainder tile1 should be unowned bank property, got owned by: ${afterFinalPick.propertyOwnership[tile1.id]}`);
  }

  console.log('✅ Test 1 Passed: Even land drafting, poorest-first ordering, remainder liquidation, and 50/50 cash split verified!\n');
}

// =========================================================================
// TEST 2: Indivisible Properties (propsPerPlayer === 0)
// =========================================================================
console.log('Test 2: Indivisible Properties (propsPerPlayer === 0)...');
{
  const state: GameState = {
    ...baseState,
    propertyOwnership: {
      [tile1.id]: 'ron',
    },
    players: [
      { ...baseState.players[0], balance: 1000 },
      { ...baseState.players[1], balance: 2000 },
      { ...baseState.players[2], balance: 100, properties: [tile1.id] },
    ],
  };

  const debtor = state.players[2];
  // 1 land among 2 surviving players -> propsPerPlayer = 0
  const afterBankruptcy = handleBankruptcy(state, debtor);

  // Draft should NOT be needed, immediate liquidation
  if (afterBankruptcy.bankruptcyDraft !== null) {
    throw new Error('bankruptcyDraft should be null when propsPerPlayer is 0');
  }

  // Tile1 price = 200G. Debtor cash = 100G. Total cash pool = 300G.
  // Divided between Harry and Draco: +150G each!
  const harry = afterBankruptcy.players.find((p) => p.id === 'harry')!;
  const draco = afterBankruptcy.players.find((p) => p.id === 'draco')!;

  if (harry.balance !== 1000 + 150) {
    throw new Error(`Harry balance should be 1150, got ${harry.balance}`);
  }
  if (draco.balance !== 2000 + 150) {
    throw new Error(`Draco balance should be 2150, got ${draco.balance}`);
  }
  if (afterBankruptcy.propertyOwnership[tile1.id]) {
    throw new Error('Tile 1 should be sold to bank (unowned)');
  }

  console.log('✅ Test 2 Passed: Indivisible land correctly liquidated to cash and split evenly among survivors!\n');
}

// =========================================================================
// TEST 3: Poorest-First Priority with 3 Surviving Drafters
// =========================================================================
console.log('Test 3: Poorest-First Priority with 3 Surviving Drafters...');
{
  const fourPlayersState = createInitialState([
    { name: 'Alice', house: 'Gryffindor', isAI: false, id: 'alice' },
    { name: 'Bob', house: 'Slytherin', isAI: false, id: 'bob' },
    { name: 'Charlie', house: 'Ravenclaw', isAI: false, id: 'charlie' },
    { name: 'Debtor', house: 'Hufflepuff', isAI: false, id: 'debtor' },
  ]);

  const state: GameState = {
    ...fourPlayersState,
    propertyOwnership: {
      [tile1.id]: 'debtor',
      [tile2.id]: 'debtor',
      [tile3.id]: 'debtor',
    },
    players: [
      { ...fourPlayersState.players[0], id: 'alice', balance: 2500, netWorth: 2500 }, // Wealthiest
      { ...fourPlayersState.players[1], id: 'bob', balance: 500, netWorth: 500 },     // Poorest
      { ...fourPlayersState.players[2], id: 'charlie', balance: 1400, netWorth: 1400 }, // Middle
      { ...fourPlayersState.players[3], id: 'debtor', balance: 0, netWorth: 640, properties: [tile1.id, tile2.id, tile3.id] },
    ],
  };

  const debtor = state.players[3];
  const afterBankruptcy = handleBankruptcy(state, debtor);
  const draft = afterBankruptcy.bankruptcyDraft!;

  // 3 lands among 3 survivors -> propsPerPlayer = 1
  // Order must be strictly ascending net worth: Bob (500) -> Charlie (1400) -> Alice (2500)
  const expectedOrder = ['bob', 'charlie', 'alice'];
  if (JSON.stringify(draft.draftOrder) !== JSON.stringify(expectedOrder)) {
    throw new Error(`Expected draft order ${expectedOrder}, got ${draft.draftOrder}`);
  }

  console.log('  ✓ Verified 3-player priority order: Bob (500G) -> Charlie (1400G) -> Alice (2500G)');
  console.log('✅ Test 3 Passed: Ascending net-worth ordering confirmed.\n');
}

// =========================================================================
// TEST 4: Bot AI Draft Strategic Selection
// =========================================================================
console.log('Test 4: Bot AI Strategic Draft Selection...');
{
  // Bot already owns tile1. tile2 is in the same BROWN color group.
  const botPlayer: Player = {
    ...baseState.players[1],
    id: 'bot-1',
    isAI: true,
    properties: [tile1.id],
  };

  const simulatedState: GameState = {
    ...baseState,
    propertyOwnership: { [tile1.id]: 'bot-1' },
    players: [baseState.players[0], botPlayer, baseState.players[2]],
  };

  // Available to draft: tile2 (BROWN, price 200) vs tile5 (LIGHT_BLUE, price 280)
  // Since color group monopoly rules are removed, bot evaluates properties by face value & rent power!
  const chosen = chooseBotDraftProperty(simulatedState, botPlayer, [tile5.id, tile2.id]);
  if (chosen !== tile5.id) {
    throw new Error(`Bot should prioritize higher value property (tile5), got ${chosen}`);
  }

  console.log('  ✓ Bot intelligently prioritized higher face value and rent potential independently of color sets');
  console.log('✅ Test 4 Passed: Bot AI strategic drafting verified.\n');
}

// =========================================================================
// TEST 5: Draft Timer Timeout Auto-Selection
// =========================================================================
console.log('Test 5: Draft Timer Timeout Auto-Selection...');
{
  const state: GameState = {
    ...baseState,
    propertyOwnership: {
      [tile1.id]: 'ron',
      [tile2.id]: 'ron',
    },
    players: [
      { ...baseState.players[0], id: 'harry', balance: 1000 },
      { ...baseState.players[1], id: 'draco', balance: 2000 },
      { ...baseState.players[2], id: 'ron', balance: 0, properties: [tile1.id, tile2.id] },
    ],
  };

  const afterBankruptcy = handleBankruptcy(state, state.players[2]);
  if (!afterBankruptcy.bankruptcyDraft) {
    throw new Error('Draft should be active');
  }

  // Simulate timer running down to 1 second remaining
  const almostExpiredState: GameState = {
    ...afterBankruptcy,
    bankruptcyDraft: {
      ...afterBankruptcy.bankruptcyDraft,
      timerSeconds: 1,
    },
  };

  // Dispatch TIMER_TICK -> should trigger auto-pick for current drafter!
  const afterTick = gameReducer(almostExpiredState, { type: 'TIMER_TICK' });

  // Current drafter (Harry) should have auto-picked a property
  const harry = afterTick.players.find((p) => p.id === 'harry')!;
  if (harry.properties.length !== 1) {
    throw new Error(`Harry should have auto-picked 1 property on timeout, got ${harry.properties.length}`);
  }

  console.log('  ✓ Turn timeout auto-selected property for current drafter');
  console.log('✅ Test 5 Passed: Draft timeout auto-selection verified.\n');
}

// =========================================================================
// TEST 6: Sole Survivor Win Condition
// =========================================================================
console.log('Test 6: Sole Survivor Win Condition...');
{
  const twoPlayersState = createInitialState([
    { name: 'Harry Potter', house: 'Gryffindor', isAI: false, id: 'harry' },
    { name: 'Draco Malfoy', house: 'Slytherin', isAI: false, id: 'draco' },
  ]);

  const state: GameState = {
    ...twoPlayersState,
    propertyOwnership: { [tile1.id]: 'harry' },
    players: [
      { ...twoPlayersState.players[0], id: 'harry', balance: 50, properties: [tile1.id] },
      { ...twoPlayersState.players[1], id: 'draco', balance: 2000 },
    ],
  };

  // Harry goes bankrupt -> Draco is the sole survivor!
  const afterBankruptcy = handleBankruptcy(state, state.players[0]);

  if (afterBankruptcy.turnPhase !== 'GAME_OVER') {
    throw new Error(`Expected GAME_OVER for sole survivor, got ${afterBankruptcy.turnPhase}`);
  }
  if (afterBankruptcy.winner?.id !== 'draco') {
    throw new Error(`Draco should be declared the winner, got ${afterBankruptcy.winner?.name}`);
  }
  if (afterBankruptcy.players.find((p) => p.id === 'draco')?.balance !== 2050) {
    throw new Error("Draco should have received Harry's 50G remaining cash");
  }

  console.log('  ✓ Sole survivor correctly wins game immediately');
  console.log('✅ Test 6 Passed: Sole survivor condition verified.\n');
}

console.log('🎉 ALL 6 BANKRUPTCY REDISTRIBUTION TESTS PASSED FLAWLESSLY!');
