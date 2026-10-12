import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { isEventRelevantToPlayer, createEvent, resolveDebtOrLiquidate } from '../src/core/reducerHelpers';
import { HOGWARTS_TILES } from '../src/core/boardData';

function runPersonalLogTests() {
  console.log('--- Testing Personalized Event Log System ---');

  let state = createInitialState([
    { name: 'Harry Potter', house: 'Gryffindor', isAI: false },
    { name: 'Draco Malfoy', house: 'Slytherin', isAI: false },
    { name: 'Ron Weasley', house: 'Gryffindor', isAI: false },
  ]);

  const pHarry = state.players[0];
  const pDraco = state.players[1];
  const pRon = state.players[2];

  // 1. Test Rent Payment between Harry and Draco
  console.log('Test 1: Rent payment (Draco pays Harry)');
  const rentDebt = resolveDebtOrLiquidate(state, pDraco, 100, pHarry.id, 'tiền thuê đất');
  const rentEvent = rentDebt.state.events[0];
  console.log('Rent Event:', rentEvent.message);

  if (!isEventRelevantToPlayer(rentEvent, pHarry, state.players)) {
    throw new Error('FAIL: Creditor (Harry) must see rent payment from Draco');
  }
  if (!isEventRelevantToPlayer(rentEvent, pDraco, state.players)) {
    throw new Error('FAIL: Debtor (Draco) must see rent payment to Harry');
  }
  if (isEventRelevantToPlayer(rentEvent, pRon, state.players)) {
    throw new Error('FAIL: Unrelated player (Ron) must NOT see rent payment between Harry and Draco');
  }
  console.log('✅ Test 1 Passed: Rent payment correctly visible ONLY to debtor and creditor');

  // 2. Test Hostile Takeover (Draco buys out Harry)
  console.log('\nTest 2: Takeover property (Draco takes over Harry\'s land)');
  const tile1 = HOGWARTS_TILES[1];
  let takeoverState = {
    ...state,
    currentPlayerIndex: 1, // Draco's turn
    turnPhase: 'ACTION' as const,
    propertyOwnership: { [tile1.id]: pHarry.id },
    takeoverCandidate: {
      propertyId: tile1.id,
      cost: 400,
      ownerId: pHarry.id,
      ownerName: pHarry.name,
      originalPrice: 200,
      hasCottage: false,
    },
    players: state.players.map((p) => (p.id === pDraco.id ? { ...p, balance: 1000 } : p)),
  };

  takeoverState = gameReducer(takeoverState, { type: 'TAKEOVER_PROPERTY', propertyId: tile1.id });
  const takeoverEvent = takeoverState.events[0];
  console.log('Takeover Event:', takeoverEvent.message);

  if (!isEventRelevantToPlayer(takeoverEvent, pHarry, state.players)) {
    throw new Error('FAIL: Former owner (Harry) must see property takeover by Draco');
  }
  if (!isEventRelevantToPlayer(takeoverEvent, pDraco, state.players)) {
    throw new Error('FAIL: Buyer (Draco) must see property takeover of Harry');
  }
  if (isEventRelevantToPlayer(takeoverEvent, pRon, state.players)) {
    throw new Error('FAIL: Unrelated player (Ron) must NOT see property takeover between Draco and Harry');
  }
  console.log('✅ Test 2 Passed: Takeover event correctly visible ONLY to buyer and former owner');

  // 3. Test Tax Payment
  console.log('\nTest 3: Tax payment (Harry pays tax to bank)');
  const taxDebt = resolveDebtOrLiquidate(state, pHarry, 150, undefined, 'tiền thuế Bộ Pháp Thuật');
  const taxEvent = taxDebt.state.events[0];
  console.log('Tax Event:', taxEvent.message);

  if (!isEventRelevantToPlayer(taxEvent, pHarry, state.players)) {
    throw new Error('FAIL: Taxpayer (Harry) must see their own tax payment');
  }
  if (isEventRelevantToPlayer(taxEvent, pDraco, state.players)) {
    throw new Error('FAIL: Draco must NOT see Harry\'s tax payment to bank');
  }
  if (isEventRelevantToPlayer(taxEvent, pRon, state.players)) {
    throw new Error('FAIL: Ron must NOT see Harry\'s tax payment to bank');
  }
  console.log('✅ Test 3 Passed: Tax event visible ONLY to the taxpayer');

  // 4. Test Upgrades (House built)
  console.log('\nTest 4: House upgrade');
  const upgradeEvent = createEvent(`🛖 Harry Potter xây thêm 1 Túp Lều tại "${tile1.name}" (−150G)`, 'success', pHarry.id);

  if (!isEventRelevantToPlayer(upgradeEvent, pHarry, state.players)) {
    throw new Error('FAIL: Harry must see his own house upgrade');
  }
  if (isEventRelevantToPlayer(upgradeEvent, pDraco, state.players)) {
    throw new Error('FAIL: Draco must NOT see Harry\'s house upgrade in his personal log');
  }
  if (isEventRelevantToPlayer(upgradeEvent, pRon, state.players)) {
    throw new Error('FAIL: Ron must NOT see Harry\'s house upgrade in his personal log');
  }
  console.log('✅ Test 4 Passed: House upgrade visible ONLY to property owner');

  // 5. Test Global Event (Game Start & Victory)
  console.log('\nTest 5: Global Announcements');
  const startEvent = createEvent('Ván Cờ Tỷ Phú Hogwarts bắt đầu! Chúc các phù thủy may mắn!', 'success');
  const winEvent = createEvent(`🏆 ${pHarry.name} thắng ván với tổng tài sản 10,000 Galleons!`, 'success');

  for (const p of [pHarry, pDraco, pRon]) {
    if (!isEventRelevantToPlayer(startEvent, p, state.players)) {
      throw new Error(`FAIL: Global start event must be visible to ${p.name}`);
    }
    if (!isEventRelevantToPlayer(winEvent, p, state.players)) {
      throw new Error(`FAIL: Victory announcement must be visible to ${p.name}`);
    }
  }
  console.log('✅ Test 5 Passed: Global announcements visible to all players');

  console.log('\n🎉 ALL PERSONAL LOG TESTS PASSED FLAWLESSLY!');
}

runPersonalLogTests();
