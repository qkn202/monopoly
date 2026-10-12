import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { resolveDebtOrLiquidate } from '../src/core/reducerHelpers';
import { HOGWARTS_TILES } from '../src/core/boardData';

function runFinancesTests() {
  console.log('💰 RUNNING FINANCES & CASHFLOW TEST SUITE...');

  let state = createInitialState([
    { name: 'Harry Potter', house: 'Gryffindor', isAI: false },
    { name: 'Draco Malfoy', house: 'Slytherin', isAI: false },
    { name: 'Hermione Granger', house: 'Gryffindor', isAI: false },
  ]);

  const pHarry = state.players[0];
  const pDraco = state.players[1];
  const pHermione = state.players[2];

  // Test 1: Initial state structure
  console.log('Test 1: Initial State Structure');
  if (!state.playerFinances || !state.propertyRevenue || !state.turnFinances) {
    throw new Error('FAIL: Initial state must have playerFinances, propertyRevenue, and turnFinances initialized');
  }
  if (!state.playerFinances[pHarry.id] || state.playerFinances[pHarry.id].totalIncome !== 0) {
    throw new Error('FAIL: Player finances must be initialized with 0 balances');
  }
  console.log('✅ Test 1 Passed: Initial finance structures initialized correctly.');

  // Test 2: Buying a property records transaction
  console.log('\nTest 2: Property Purchase Cash Transaction');
  const tile1 = HOGWARTS_TILES[1]; // Borgin & Burkes, price ~60
  state = {
    ...state,
    currentPlayerIndex: 0,
    turnPhase: 'ACTION',
    players: state.players.map((p) => (p.id === pHarry.id ? { ...p, position: 1 } : p)),
  };
  state = gameReducer(state, { type: 'BUY_PROPERTY', propertyId: tile1.id });

  const harryFinancesAfterBuy = state.playerFinances[pHarry.id];
  if (harryFinancesAfterBuy.totalExpense !== (tile1.price || 60)) {
    throw new Error(`FAIL: Harry totalExpense should be ${tile1.price}, got ${harryFinancesAfterBuy.totalExpense}`);
  }
  const harryNetCashflow = harryFinancesAfterBuy.totalIncome - harryFinancesAfterBuy.totalExpense;
  if (harryNetCashflow !== -(tile1.price || 60)) {
    throw new Error(`FAIL: Harry netCashflow should be -${tile1.price}, got ${harryNetCashflow}`);
  }
  console.log(`✅ Test 2 Passed: Property purchase recorded as expense (-${tile1.price}G).`);

  // Test 3: Rent payment records expense for tenant, income for landlord, and propertyRevenue
  console.log('\nTest 3: Rent Payment & Property Revenue Tracking');
  const rentAmount = 120;
  const rentDebt = resolveDebtOrLiquidate(state, pDraco, rentAmount, pHarry.id, 'tiền thuê đất', tile1.id);
  state = rentDebt.state;

  const dracoFinances = state.playerFinances[pDraco.id];
  const harryFinancesAfterRent = state.playerFinances[pHarry.id];
  const propRev = state.propertyRevenue[tile1.id];

  if (!propRev) {
    throw new Error('FAIL: propertyRevenue for tile1 must exist');
  }
  if (propRev.totalRentCollected !== rentAmount) {
    throw new Error(`FAIL: totalRentCollected should be ${rentAmount}, got ${propRev.totalRentCollected}`);
  }
  if (propRev.rentCount !== 1) {
    throw new Error(`FAIL: rentCount should be 1, got ${propRev.rentCount}`);
  }
  if (dracoFinances.totalExpense !== rentAmount) {
    throw new Error(`FAIL: Draco totalExpense should be ${rentAmount}, got ${dracoFinances.totalExpense}`);
  }
  if (harryFinancesAfterRent.totalIncome !== rentAmount) {
    throw new Error(`FAIL: Harry totalIncome should be ${rentAmount}, got ${harryFinancesAfterRent.totalIncome}`);
  }
  console.log(`✅ Test 3 Passed: Rent of ${rentAmount}G tracked on tile1 and landlord/tenant accounts.`);

  // Test 4: Another property collects higher rent -> becomes Top Property
  console.log('\nTest 4: Top Revenue-Generating Property (Vua Thu Thuế Bàn Cờ)');
  const tile39 = HOGWARTS_TILES[39]; // High value property
  const bigRentAmount = 500;
  const bigRentDebt = resolveDebtOrLiquidate(state, pHermione, bigRentAmount, pHarry.id, 'tiền thuê đất', tile39.id);
  state = bigRentDebt.state;

  // Find top property
  const allRevenues = Object.entries(state.propertyRevenue || {})
    .map(([tileId, stat]) => ({ tileId, ...stat }))
    .filter((r) => r.totalRentCollected > 0)
    .sort((a, b) => b.totalRentCollected - a.totalRentCollected);

  if (allRevenues.length < 2) {
    throw new Error('FAIL: Expected at least 2 properties with revenue');
  }
  if (allRevenues[0].tileId !== tile39.id || allRevenues[0].totalRentCollected !== bigRentAmount) {
    throw new Error(`FAIL: Top property should be tile-39 with ${bigRentAmount}G, got ${allRevenues[0].tileId}`);
  }
  console.log(`✅ Test 4 Passed: Top property correctly identified as ${tile39.name} with ${bigRentAmount}G collected.`);

  // Test 5: Turn Finalization on END_TURN
  console.log('\nTest 5: Turn Finalization & Ledger Ledger Recording');
  const preTurnCount = state.turnFinances?.length || 0;
  state = { ...state, turnPhase: 'END_TURN' };
  state = gameReducer(state, { type: 'END_TURN' });

  if ((state.turnFinances?.length || 0) !== preTurnCount + 1) {
    throw new Error(`FAIL: advanceTurn should have appended a turnFinances record. Count: ${state.turnFinances?.length}`);
  }

  const lastTurnRecord = state.turnFinances![state.turnFinances!.length - 1];
  console.log('Turn Cashflow Record:', {
    turnIndex: lastTurnRecord.turnIndex,
    roundNumber: lastTurnRecord.roundNumber,
    player: lastTurnRecord.playerName,
    income: lastTurnRecord.totalIncome,
    expense: lastTurnRecord.totalExpense,
    net: lastTurnRecord.net,
    txCount: lastTurnRecord.transactions.length,
  });

  if (lastTurnRecord.transactions.length === 0) {
    throw new Error('FAIL: Turn record should include the transactions executed during the turn');
  }
  console.log('✅ Test 5 Passed: Turn cashflows finalized and recorded cleanly.');

  // Test 6: Tax Payment Transaction
  console.log('\nTest 6: Tax Payment Transaction');
  const taxTile = HOGWARTS_TILES[4]; // Thuế Bộ Pháp Thuật (200G)
  const taxDebt = resolveDebtOrLiquidate(state, pHarry, 200, null, 'tiền thuế Bộ Pháp Thuật', taxTile.id);
  state = taxDebt.state;

  const lastTx = state.currentTurnTransactions?.[state.currentTurnTransactions.length - 1];
  if (!lastTx || lastTx.category !== 'TAX' || lastTx.amount !== 200) {
    throw new Error(`FAIL: Last transaction should be TAX 200G, got ${JSON.stringify(lastTx)}`);
  }
  console.log('✅ Test 6 Passed: Tax payment recorded with category TAX.');

  console.log('\n🎉 ALL FINANCES & CASHFLOW TESTS PASSED FLAWLESSLY!');
}

runFinancesTests();
