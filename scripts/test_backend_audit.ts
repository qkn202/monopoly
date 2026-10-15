import assert from 'node:assert/strict';
import { createInitialState, gameReducer, handleTurnTimeout } from '../src/core/gameReducer';
import { authorizeAction } from '../src/core/actionAuth';
import { executeCardEffect, resolveDebtOrLiquidate } from '../src/core/reducerHelpers';
import { HOGWARTS_TILES } from '../src/core/boardData';
import { CardConfig, GameState, Player } from '../src/core/types';

console.log('⚡ RUNNING COMPREHENSIVE BACKEND AUDIT TEST SUITE...\n');

// =========================================================================
// TEST 1: Turn Number Increment When Player 0 is Bankrupt
// =========================================================================
console.log('Test 1: Turn number increment when Player 0 is bankrupt...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
    { id: 'p2', name: 'Hermione', house: 'Gryffindor', isAI: false },
  ]);

  // Set Player 0 as bankrupt
  const stateWithP0Bankrupt: GameState = {
    ...base,
    turnNumber: 1,
    currentPlayerIndex: 2, // Hermione is currently taking her turn
    players: [
      { ...base.players[0], isBankrupt: true },
      base.players[1],
      base.players[2],
    ],
  };

  // Hermione ends turn. Next active player must wrap to Ron (p1), skipping p0.
  const nextState = gameReducer(stateWithP0Bankrupt, { type: 'END_TURN' });
  assert.equal(nextState.currentPlayerIndex, 1, 'Next player should be Ron (index 1)');
  assert.equal(nextState.turnNumber, 2, 'turnNumber MUST increment from 1 to 2 when wrapping around!');
  console.log('✅ Test 1 Passed: Round counter never freezes even when Player 0 is bankrupt.');
}

// =========================================================================
// TEST 2: Debtor Debt Settlement Authorization in Online Mode
// =========================================================================
console.log('\nTest 2: Debtor debt settlement authorization in online mode...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
  ]);

  // Harry is the current turn player (currentPlayerIndex = 0).
  // Ron (p1) is in BANKRUPTCY phase owing debt from a card/tax.
  const stateInBankruptcy: GameState = {
    ...base,
    currentPlayerIndex: 0,
    turnPhase: 'BANKRUPTCY',
    bankruptcyInfo: {
      debtorId: 'p1',
      creditorId: 'p0',
      amount: 100,
      reason: 'quà tặng',
    },
    players: [
      base.players[0],
      { ...base.players[1], balance: 200 }, // Ron now has enough cash
    ],
  };

  // Ron sends END_TURN to settle his debt
  const auth = authorizeAction(stateInBankruptcy, { type: 'END_TURN' }, 'p1');
  assert.deepEqual(auth, { type: 'END_TURN' }, 'Ron must be authorized to send END_TURN to settle debt');

  // Verify reducer settles the debt
  const settled = gameReducer(stateInBankruptcy, auth!);
  assert.equal(settled.turnPhase, 'END_TURN', 'Phase should transition to END_TURN');
  assert.equal(settled.players[1].balance, 100, 'Ron should have paid 100G (200 - 100 = 100)');
  assert.equal(settled.players[0].balance, base.players[0].balance + 100, 'Harry should receive 100G');
  console.log('✅ Test 2 Passed: Debtor is authorized to settle debt even when not the turn player.');
}

// =========================================================================
// TEST 3: Strict Validation on BUY_PROPERTY (Anti-Theft & Position Integrity)
// =========================================================================
console.log('\nTest 3: Strict validation on BUY_PROPERTY...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
  ]);

  const tile1 = HOGWARTS_TILES[1]; // Borgin & Burkes (pos 1)
  const tile3 = HOGWARTS_TILES[3]; // Quán Cái Vạc Lủng (pos 3)

  const testState: GameState = {
    ...base,
    currentPlayerIndex: 0,
    turnPhase: 'ACTION',
    propertyOwnership: { [tile1.id]: 'p1' }, // Owned by Ron
    players: [
      { ...base.players[0], position: 3, balance: 1000 }, // Harry is standing at tile 3
      base.players[1],
    ],
  };

  // Attempt A: Harry tries to buy Ron's property (tile 1)
  const stealAttempt = gameReducer(testState, { type: 'BUY_PROPERTY', propertyId: tile1.id });
  assert.equal(stealAttempt.propertyOwnership[tile1.id], 'p1', 'Cannot buy already owned property');

  // Attempt B: Harry tries to buy tile 1 while standing at tile 3
  const unownedTile1State: GameState = {
    ...testState,
    propertyOwnership: {},
  };
  const wrongPosAttempt = gameReducer(unownedTile1State, { type: 'BUY_PROPERTY', propertyId: tile1.id });
  assert.equal(wrongPosAttempt.propertyOwnership[tile1.id], undefined, 'Cannot buy property on a tile you are not standing on');

  // Attempt C: Harry buys tile 3 while standing on tile 3
  const validBuy = gameReducer(unownedTile1State, { type: 'BUY_PROPERTY', propertyId: tile3.id });
  assert.equal(validBuy.propertyOwnership[tile3.id], 'p0', 'Valid buy succeeds');
  console.log('✅ Test 3 Passed: BUY_PROPERTY strictly guards ownership and player tile position.');
}

// =========================================================================
// TEST 4: MOVE Card Effect Walking Backward (No GO Salary)
// =========================================================================
console.log('\nTest 4: MOVE card effect walking backward...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
  ]);

  const initialBalance = 1000;
  const stateAtPos5: GameState = {
    ...base,
    players: [{ ...base.players[0], position: 5, balance: initialBalance }],
  };

  const backwardCard: CardConfig = {
    id: 'back-3',
    title: 'Lùi lại',
    description: 'Lùi 3 bước',
    action: 'MOVE',
    amount: -3,
  };

  const res = executeCardEffect(stateAtPos5, stateAtPos5.players[0], backwardCard);
  const pMoved = res.nextState.players[0];
  assert.equal(pMoved.position, 2, 'Player should be at position 2');
  assert.equal(pMoved.balance, initialBalance, 'Walking backward must NOT award 500G salary for passing GO!');
  console.log('✅ Test 4 Passed: Stepping backward does not grant phantom GO salary.');
}

// =========================================================================
// TEST 5: FreeParkingPot Credited on Manual Debt Settlement Without Creditor
// =========================================================================
console.log('\nTest 5: FreeParkingPot credited on manual debt settlement without creditor...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
  ]);

  const stateWithTaxDebt: GameState = {
    ...base,
    freeParkingPot: 200,
    turnPhase: 'BANKRUPTCY',
    bankruptcyInfo: {
      debtorId: 'p0',
      amount: 150,
      reason: 'thuế bộ pháp thuật',
    },
    players: [{ ...base.players[0], balance: 500 }],
  };

  const settled = gameReducer(stateWithTaxDebt, { type: 'END_TURN' });
  assert.equal(settled.freeParkingPot, 350, 'Free parking pot must receive 150G tax payment (200 + 150 = 350)');
  assert.equal(settled.players[0].balance, 350, 'Harry balance drops by 150G');
  console.log('✅ Test 5 Passed: Free parking pot correctly receives penalty funds on manual debt settlement.');
}

// =========================================================================
// TEST 6: Turn Timeout Resilience During Bankruptcy Draft and Auction
// =========================================================================
console.log('\nTest 6: Turn timeout resilience during bankruptcy draft and auction...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
  ]);

  // Draft active
  const stateInDraft: GameState = {
    ...base,
    bankruptcyDraft: {
      debtorId: 'debtor-x',
      debtorName: 'Draco',
      availablePropertyIds: ['tile-1', 'tile-3'],
      draftOrder: ['p0', 'p1'],
      currentDraftIndex: 0,
      propsPerPlayer: 1,
      initialCashPool: 500,
      timerSeconds: 15,
      history: [],
    },
  };

  const afterTimeout = handleTurnTimeout(stateInDraft);
  assert.equal(afterTimeout.propertyOwnership['tile-3'] || afterTimeout.propertyOwnership['tile-1'], 'p0', 'Auto-drafts property on timeout');
  assert.equal(afterTimeout.dice, null, 'Does NOT roll dice or advance turn inappropriately during draft');

  // Auction active
  const stateInAuction: GameState = {
    ...base,
    turnPhase: 'AUCTION',
    auction: {
      active: true,
      propertyId: 'tile-1',
      currentBid: 100,
      highBidderId: 'p0',
      activeBidders: ['p0', 'p1'],
      currentBidderIndex: 1,
      timerSeconds: 6,
    },
  };

  const auctionAfterTimeout = handleTurnTimeout(stateInAuction);
  assert.equal(auctionAfterTimeout.turnPhase, 'AUCTION', 'Auction must not be prematurely terminated by turn timeout');
  console.log('✅ Test 6 Passed: Turn timeout safely delegates during bankruptcy drafts and auctions.');
}

// =========================================================================
// TEST 7: Card penalty entering BANKRUPTCY must credit the pot exactly once
// =========================================================================
console.log('\nTest 7: Card penalty pot credited exactly once through BANKRUPTCY phase...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
  ]);
  const tile1 = HOGWARTS_TILES[1];
  const s0: GameState = {
    ...base,
    freeParkingPot: 0,
    propertyOwnership: { [tile1.id]: 'p0' },
    players: [{ ...base.players[0], balance: 50, properties: [tile1.id], houses: {}, hotels: {} }, base.players[1]],
  };
  const penalty: CardConfig = { id: 'fine', title: 'Phạt', description: 'Phạt', action: 'MONEY', amount: -80 };
  const afterCard = executeCardEffect(s0, s0.players[0], penalty).nextState;
  assert.equal(afterCard.turnPhase, 'BANKRUPTCY', 'Debtor enters BANKRUPTCY (can mortgage to cover)');
  assert.equal(afterCard.freeParkingPot, 0, 'Pot must NOT be credited before the debt is paid');
  const afterMortgage = gameReducer(afterCard, { type: 'MORTGAGE_PROPERTY', propertyId: tile1.id, playerId: 'p0' });
  assert.equal(afterMortgage.turnPhase, 'END_TURN', 'Debt auto-settled after mortgage');
  assert.equal(afterMortgage.freeParkingPot, 80, 'Pot credited exactly once (80G)');
  console.log('✅ Test 7 Passed: No phantom cash from card penalties.');
}

// =========================================================================
// TEST 8: BUY_PROPERTY rejected outside ACTION phase
// =========================================================================
console.log('\nTest 8: BUY_PROPERTY rejected outside ACTION phase...');
{
  const base = createInitialState([
    { id: 'p0', name: 'Harry', house: 'Gryffindor', isAI: false },
    { id: 'p1', name: 'Ron', house: 'Gryffindor', isAI: false },
  ]);
  const tile3 = HOGWARTS_TILES[3];
  const endTurnState: GameState = {
    ...base,
    turnPhase: 'END_TURN',
    players: [{ ...base.players[0], position: 3, balance: 1000 }, base.players[1]],
  };
  const res = gameReducer(endTurnState, { type: 'BUY_PROPERTY', propertyId: tile3.id });
  assert.equal(res.propertyOwnership[tile3.id], undefined, 'Cannot buy after the decision phase is over');
  console.log('✅ Test 8 Passed: BUY_PROPERTY only allowed in ACTION phase.');
}

console.log('\n🎉 ALL BACKEND AUDIT TESTS PASSED FLAWLESSLY!');
