import assert from 'node:assert/strict';
import { gameReducer } from '../src/core/gameReducer';
import { GameState, Player, HouseType } from '../src/core/types';
import { HOGWARTS_TILES } from '../src/core/boardData';
import { getBotAction } from '../src/core/botAI';
import { authorizeAction } from '../src/core/actionAuth';

console.log('⚡ RUNNING AUCTION 7S & STARTER RULES TEST SUITE...\n');

function makeBaseState(): GameState {
  const p1: Player = {
    id: 'p1',
    name: 'Harry (Starter)',
    house: 'gryffindor',
    balance: 1500,
    position: 1, // Tile-1 (Borgin & Burkes, price 60)
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    properties: [],
    houses: {},
    hotels: {},
    isAI: false,
    isBankrupt: false,
    netWorth: 1500,
  };

  const p2: Player = {
    id: 'p2',
    name: 'Draco (Subsequent 1)',
    house: 'slytherin',
    balance: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    properties: [],
    houses: {},
    hotels: {},
    isAI: false,
    isBankrupt: false,
    netWorth: 1500,
  };

  const p3: Player = {
    id: 'p3',
    name: 'Ron (Subsequent 2)',
    house: 'gryffindor',
    balance: 1500,
    position: 0,
    inJail: false,
    jailTurns: 0,
    getOutOfJailCards: 0,
    properties: [],
    houses: {},
    hotels: {},
    isAI: false,
    isBankrupt: false,
    netWorth: 1500,
  };

  return {
    players: [p1, p2, p3],
    currentPlayerIndex: 0, // p1 is current player
    propertyOwnership: {},
    mortgagedProperties: {},
    turnPhase: 'ACTION',
    freeParkingPot: 0,
    lastDiceRoll: { die1: 1, die2: 2, total: 3, isDouble: false },
    activeCard: null,
    events: [],
    round: 1,
    consecutiveDoubles: 0,
    turnSecondsRemaining: 60,
    auction: null,
    tradeOffer: null,
    timer: {
      durationSeconds: 1800,
      remainingSeconds: 1800,
      isExpired: false,
      isPaused: false,
    },
    gameStarted: true,
  };
}

// ==========================================
// TEST 1: PASS_PROPERTY triggers Auction with 7s timer and starter at index 0
// ==========================================
console.log('Test 1: Auction initialization has 7s timer and orders starter first');
const state1 = makeBaseState();
const s1Auction = gameReducer(state1, { type: 'PASS_PROPERTY' });

assert.equal(s1Auction.turnPhase, 'AUCTION');
assert.ok(s1Auction.auction, 'Auction must be active');
assert.equal(s1Auction.auction.timerSeconds, 7, 'Timer must be 7s');
assert.equal(s1Auction.auction.starterId, 'p1', 'p1 must be starter');
assert.equal(s1Auction.auction.starterFolded, false, 'starterFolded must initially be false');
assert.equal(s1Auction.auction.activeBidders[0], 'p1', 'starter must be bidder index 0');
assert.deepEqual(s1Auction.auction.activeBidders, ['p1', 'p2', 'p3'], 'bidders must follow turn order from starter');
assert.equal(s1Auction.auction.highBidderId, null, 'highBidderId must be null initially');
const tile1 = HOGWARTS_TILES[1];
const expectedStartBid = Math.max(25, Math.floor((tile1.price || 100) * 0.1));
assert.equal(s1Auction.auction.currentBid, expectedStartBid, 'currentBid must equal startingBid');
assert.equal(s1Auction.auction.startingBid, expectedStartBid, 'startingBid must be recorded');
console.log(`✅ Test 1 Passed: 7s countdown, starterId = p1, activeBidders = [p1, p2, p3], startingBid = ${expectedStartBid}G`);

// ==========================================
// TEST 2: Starter times out on round 1 -> DOES NOT fold! Turn passes to p2 with 7s timer
// ==========================================
console.log('\nTest 2: Starter timing out does NOT fold the starter');
let s2 = s1Auction;
// Tick down from 7 to 0
for (let sec = 7; sec >= 1; sec--) {
  s2 = gameReducer(s2, { type: 'AUCTION_TICK' });
}
// Now timer should have reached 0 and ticked to next bidder
assert.equal(s2.turnPhase, 'AUCTION', 'Auction should still be active');
assert.ok(s2.auction, 'Auction must exist');
assert.equal(s2.auction.currentBidderIndex, 1, 'Turn should advance to p2');
assert.equal(s2.auction.activeBidders.includes('p1'), true, 'p1 MUST still be in activeBidders');
assert.equal(s2.auction.starterFolded, false, 'p1 MUST NOT be marked as folded');
assert.equal(s2.auction.timerSeconds, 7, 'Timer for p2 must reset to 7s');
assert.equal(s2.auction.highBidderId, null, 'highBidderId still null');
console.log('✅ Test 2 Passed: Starter timed out without folding. Turn moved to p2 with 7s timer.');

// ==========================================
// TEST 3: All subsequent players time out without bidding -> Starter wins at starting bid!
// ==========================================
console.log('\nTest 3: Subsequent players timing out without bidding -> Starter wins at starting price');
let s3 = s2; // currently on p2
// p2 times out (7 ticks)
for (let sec = 7; sec >= 1; sec--) {
  s3 = gameReducer(s3, { type: 'AUCTION_TICK' });
}
// p2 should have auto-folded, turn should move to p3
assert.equal(s3.turnPhase, 'AUCTION');
assert.equal(s3.auction!.activeBidders.includes('p2'), false, 'p2 must be auto-folded');
assert.deepEqual(s3.auction!.activeBidders, ['p1', 'p3'], 'p1 and p3 remain');
assert.equal(s3.auction!.timerSeconds, 7, 'p3 timer must be 7s');

// p3 times out (7 ticks)
for (let sec = 7; sec >= 1; sec--) {
  s3 = gameReducer(s3, { type: 'AUCTION_TICK' });
}
// Now only p1 remains, and p1 never folded! Auction must conclude!
assert.equal(s3.turnPhase, 'END_TURN', 'Auction must conclude to END_TURN');
assert.equal(s3.auction, null, 'Auction state must be cleared');
const p1Winner = s3.players.find((p) => p.id === 'p1')!;
assert.equal(s3.propertyOwnership[tile1.id], 'p1', 'Property must belong to p1');
assert.ok(p1Winner.properties.includes(tile1.id), 'Property must be in p1 properties list');
assert.equal(p1Winner.balance, 1500 - expectedStartBid, `p1 balance must decrease by starting bid ${expectedStartBid}G`);
const winEvent = s3.events.find((e) => e.message.includes('giá khởi điểm'));
assert.ok(winEvent, 'Event log must mention property won at starting price');
console.log(`✅ Test 3 Passed: Starter awarded "${tile1.name}" at starting price ${expectedStartBid}G! Balance: ${p1Winner.balance}G.`);

// ==========================================
// TEST 4: PASS_BID_TURN by starter immediately passes turn without waiting 7s
// ==========================================
console.log('\nTest 4: Starter can PASS_BID_TURN without forfeiting starting price privilege');
const s4Init = gameReducer(makeBaseState(), { type: 'PASS_PROPERTY' });
const authPass = authorizeAction(s4Init, { type: 'PASS_BID_TURN', playerId: 'p1' }, 'p1');
assert.ok(authPass, 'PASS_BID_TURN must be authorized for current bidder');

const s4Passed = gameReducer(s4Init, { type: 'PASS_BID_TURN', playerId: 'p1' });
assert.equal(s4Passed.auction!.currentBidderIndex, 1, 'Turn moves to p2');
assert.equal(s4Passed.auction!.activeBidders.includes('p1'), true, 'p1 still in activeBidders');
assert.equal(s4Passed.auction!.starterFolded, false, 'starterFolded is false');
assert.equal(s4Passed.auction!.timerSeconds, 7, 'Timer reset to 7s for p2');

// If p2 and p3 explicitly fold via FOLD_AUCTION
const s4P2Fold = gameReducer(s4Passed, { type: 'FOLD_AUCTION', playerId: 'p2' });
assert.equal(s4P2Fold.auction!.activeBidders.length, 2);
assert.equal(s4P2Fold.auction!.timerSeconds, 7);

const s4P3Fold = gameReducer(s4P2Fold, { type: 'FOLD_AUCTION', playerId: 'p3' });
assert.equal(s4P3Fold.turnPhase, 'END_TURN');
assert.equal(s4P3Fold.propertyOwnership[tile1.id], 'p1', 'p1 wins property when all subsequent players fold');
assert.equal(s4P3Fold.players.find((p) => p.id === 'p1')!.balance, 1500 - expectedStartBid);
console.log('✅ Test 4 Passed: PASS_BID_TURN works smoothly and subsequent FOLD_AUCTION grants property to starter.');

// ==========================================
// TEST 5: Starter explicitly clicks FOLD_AUCTION -> starterFolded becomes true, land goes to bank if all others fold
// ==========================================
console.log('\nTest 5: Starter explicitly clicks FOLD_AUCTION -> starter loses priority, bank gets land if all fold');
const s5Init = gameReducer(makeBaseState(), { type: 'PASS_PROPERTY' });
// p1 explicitly folds
const s5P1Fold = gameReducer(s5Init, { type: 'FOLD_AUCTION', playerId: 'p1' });
assert.equal(s5P1Fold.auction!.starterFolded, true, 'starterFolded must be true');
assert.equal(s5P1Fold.auction!.activeBidders.includes('p1'), false, 'p1 removed from bidders');
assert.equal(s5P1Fold.auction!.timerSeconds, 7);

// p2 folds
const s5P2Fold = gameReducer(s5P1Fold, { type: 'FOLD_AUCTION', playerId: 'p2' });
// p3 folds
const s5P3Fold = gameReducer(s5P2Fold, { type: 'FOLD_AUCTION', playerId: 'p3' });
assert.equal(s5P3Fold.turnPhase, 'END_TURN');
assert.equal(s5P3Fold.propertyOwnership[tile1.id], undefined, 'Land must NOT be owned by anyone; remains with bank');
assert.equal(s5P3Fold.players.find((p) => p.id === 'p1')!.balance, 1500, 'p1 balance unchanged');
const bankEvent = s5P3Fold.events.find((e) => e.message.includes('vẫn thuộc về ngân hàng'));
assert.ok(bankEvent, 'Bank retention event logged');
console.log('✅ Test 5 Passed: Explicit starter withdrawal drops priority. Land safely returned to bank.');

// ==========================================
// TEST 6: Subsequent player bids higher -> Normal bidding competition
// ==========================================
console.log('\nTest 6: Subsequent player bids higher -> highBidderId set, normal auction win');
const s6Init = gameReducer(makeBaseState(), { type: 'PASS_PROPERTY' });
// p1 passes turn
const s6P1Pass = gameReducer(s6Init, { type: 'PASS_BID_TURN', playerId: 'p1' });
// p2 bids 50G
const s6P2Bid = gameReducer(s6P1Pass, { type: 'PLACE_BID', playerId: 'p2', amount: 50 });
assert.equal(s6P2Bid.auction!.highBidderId, 'p2');
assert.equal(s6P2Bid.auction!.currentBid, 50);
assert.equal(s6P2Bid.auction!.timerSeconds, 7);

// p3 folds
const s6P3Fold = gameReducer(s6P2Bid, { type: 'FOLD_AUCTION', playerId: 'p3' });
// p1's turn again. p1 folds
const s6P1Fold = gameReducer(s6P3Fold, { type: 'FOLD_AUCTION', playerId: 'p1' });
assert.equal(s6P1Fold.turnPhase, 'END_TURN');
assert.equal(s6P1Fold.propertyOwnership[tile1.id], 'p2', 'p2 wins because they bid 50G');
assert.equal(s6P1Fold.players.find((p) => p.id === 'p2')!.balance, 1500 - 50);
console.log('✅ Test 6 Passed: High bidder p2 wins when competition bids are made.');

// ==========================================
// TEST 7: Bot AI starter does not auto-fold on turn 1
// ==========================================
console.log('\nTest 7: Bot AI as auction starter emits PASS_BID_TURN instead of FOLD_AUCTION when no high bidder');
// When starter bot balance is too low to raise (+200 buffer):
const lowBalanceBotState = makeBaseState();
lowBalanceBotState.players[0].isAI = true;
lowBalanceBotState.players[0].balance = 50; // too low for nextMinBid + 200
const s7Low = gameReducer(lowBalanceBotState, { type: 'PASS_PROPERTY' });
const lowBotDecision = getBotAction(s7Low, s7Low.players[0]);
assert.ok(lowBotDecision);
assert.equal(lowBotDecision.type, 'PASS_BID_TURN', 'Starter Bot with low cash must PASS_BID_TURN to wait for default starting price win');
console.log('✅ Test 7 Passed: Starter bot emits PASS_BID_TURN when not raising, retaining starting price privilege.');

console.log('\n🎉 ALL 7 AUCTION 7S & STARTER RULE TESTS PASSED FLAWLESSLY!\n');
