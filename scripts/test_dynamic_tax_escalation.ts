import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { calculateRent } from '../src/core/rulesEngine';
import { HOGWARTS_TILES } from '../src/core/boardData';

function runDynamicTaxEscalationTests() {
  console.log('⚡ RUNNING DYNAMIC TAX & RENT ESCALATION TESTS...');

  let state = createInitialState([
    { name: 'Harry Potter', house: 'Gryffindor', isAI: false },
    { name: 'Draco Malfoy', house: 'Slytherin', isAI: false },
  ]);

  // Test 1: Initial state before minute 15
  console.log('Test 1: Normal Multiplier before Minute 15');
  if (state.rentMultiplier !== 1) {
    throw new Error(`FAIL: Initial rentMultiplier should be 1, got ${state.rentMultiplier}`);
  }
  if (state.activeEscalationEvent !== null) {
    throw new Error('FAIL: Initial activeEscalationEvent should be null');
  }

  // Tick at 14 minutes elapsed (remaining 960s)
  state = {
    ...state,
    timer: { ...state.timer, remainingSeconds: 961 },
  };
  state = gameReducer(state, { type: 'TIMER_TICK' });
  if (state.rentMultiplier !== 1) {
    throw new Error(`FAIL: At minute 14, rentMultiplier should still be 1, got ${state.rentMultiplier}`);
  }
  console.log('✅ Test 1 Passed: Tax multiplier remains 1x before minute 15.');

  // Test 2: Trigger at Minute 15 (remaining 900s)
  console.log('\nTest 2: Trigger Random Escalation at Minute 15');
  state = {
    ...state,
    timer: { ...state.timer, remainingSeconds: 901 },
  };
  state = gameReducer(state, { type: 'TIMER_TICK' });

  if (state.timer.remainingSeconds !== 900) {
    throw new Error(`FAIL: remainingSeconds should be 900, got ${state.timer.remainingSeconds}`);
  }
  if (![2, 3, 4, 5].includes(state.rentMultiplier)) {
    throw new Error(`FAIL: rentMultiplier should be random between 2 and 5, got ${state.rentMultiplier}`);
  }
  if (state.lastEscalationMinute !== 15) {
    throw new Error(`FAIL: lastEscalationMinute should be 15, got ${state.lastEscalationMinute}`);
  }
  if (!state.activeEscalationEvent || state.activeEscalationEvent.multiplier !== state.rentMultiplier) {
    throw new Error(`FAIL: activeEscalationEvent must match rentMultiplier ${state.rentMultiplier}`);
  }
  const m15Multiplier = state.rentMultiplier;
  console.log(`✅ Test 2 Passed: Escalation successfully triggered at minute 15 with multiplier x${m15Multiplier}!`);

  // Test 3: Idempotent during remainder of Minute 15
  console.log('\nTest 3: Idempotent within the same minute');
  state = gameReducer(state, { type: 'TIMER_TICK' }); // remaining 899s
  if (state.rentMultiplier !== m15Multiplier) {
    throw new Error(`FAIL: Multiplier should not change within the same minute, got ${state.rentMultiplier}`);
  }
  console.log('✅ Test 3 Passed: Multiplier stays stable during minute 15.');

  // Test 4: Trigger again at Minute 20 (remaining 600s)
  console.log('\nTest 4: Trigger Random Escalation at Minute 20');
  state = {
    ...state,
    timer: { ...state.timer, remainingSeconds: 601 },
  };
  state = gameReducer(state, { type: 'TIMER_TICK' });

  if (state.timer.remainingSeconds !== 600) {
    throw new Error(`FAIL: remainingSeconds should be 600, got ${state.timer.remainingSeconds}`);
  }
  if (![2, 3, 4, 5].includes(state.rentMultiplier)) {
    throw new Error(`FAIL: rentMultiplier should be random between 2 and 5 at min 20, got ${state.rentMultiplier}`);
  }
  if (state.lastEscalationMinute !== 20) {
    throw new Error(`FAIL: lastEscalationMinute should be 20, got ${state.lastEscalationMinute}`);
  }
  const m20Multiplier = state.rentMultiplier;
  console.log(`✅ Test 4 Passed: Escalation successfully triggered at minute 20 with multiplier x${m20Multiplier}!`);

  // Test 5: Trigger again at Minute 25 (remaining 300s)
  console.log('\nTest 5: Trigger Random Escalation at Minute 25');
  state = {
    ...state,
    timer: { ...state.timer, remainingSeconds: 301 },
  };
  state = gameReducer(state, { type: 'TIMER_TICK' });

  if (state.timer.remainingSeconds !== 300) {
    throw new Error(`FAIL: remainingSeconds should be 300, got ${state.timer.remainingSeconds}`);
  }
  if (![2, 3, 4, 5].includes(state.rentMultiplier)) {
    throw new Error(`FAIL: rentMultiplier should be random between 2 and 5 at min 25, got ${state.rentMultiplier}`);
  }
  if (state.lastEscalationMinute !== 25) {
    throw new Error(`FAIL: lastEscalationMinute should be 25, got ${state.lastEscalationMinute}`);
  }
  console.log(`✅ Test 5 Passed: Escalation successfully triggered at minute 25 with multiplier x${state.rentMultiplier}!`);

  // Test 6: Verify Rent and Tax Scaling
  console.log('\nTest 6: Verify Rent & Tax Calculation with Escalation Multiplier');
  const tile1 = HOGWARTS_TILES[1]; // Borgin & Burkes, base rent 10
  const owner = state.players[0];
  const testMultiplier = 4;
  const testState: typeof state = {
    ...state,
    rentMultiplier: testMultiplier,
    propertyOwnership: { [tile1.id]: owner.id },
  };

  const calculatedRent = calculateRent(tile1, owner, 7, testState);
  const expectedRent = (tile1.baseRent || 10) * testMultiplier;
  if (calculatedRent !== expectedRent) {
    throw new Error(`FAIL: Expected rent ${expectedRent}, got ${calculatedRent}`);
  }
  console.log(`✅ Test 6 Passed: Rent cleanly scales with x${testMultiplier} multiplier (${calculatedRent}G).`);

  console.log('\n🎉 ALL DYNAMIC TAX ESCALATION TESTS PASSED FLAWLESSLY!');
}

runDynamicTaxEscalationTests();
