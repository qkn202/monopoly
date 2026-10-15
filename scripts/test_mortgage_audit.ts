import assert from 'node:assert/strict';
import { canMortgageProperty, canUnmortgageProperty } from '../src/core/rulesEngine';
import { gameReducer } from '../src/core/gameReducer';
import { authorizeAction } from '../src/core/actionAuth';
import { canBotActNow } from '../src/core/botAI';
import { GameState, Player } from '../src/core/types';
import { HOGWARTS_TILES } from '../src/core/boardData';

console.log('⚡ RUNNING MORTGAGE ENGINE & ANTI-LAG AUDIT TESTS...\n');

function createTestState(): GameState {
  const p1: Player = {
    id: 'p1',
    name: 'Harry Potter',
    house: 'Gryffindor',
    color: '#ae0001',
    balance: 500,
    position: 0,
    properties: ['tile-1', 'tile-3'], // Brown / Khởi Đầu group
    houses: { 'tile-1': 0, 'tile-3': 0 },
    hotels: { 'tile-1': 0, 'tile-3': 0 },
    inJail: false,
    jailTurns: 0,
    isBankrupt: false,
    isAI: false,
    netWorth: 500,
  };

  const p2: Player = {
    id: 'p2',
    name: 'Draco Malfoy',
    house: 'Slytherin',
    color: '#2a623d',
    balance: 1000,
    position: 0,
    properties: [],
    houses: {},
    hotels: {},
    inJail: false,
    jailTurns: 0,
    isBankrupt: false,
    isAI: true,
    netWorth: 1000,
  };

  return {
    players: [p1, p2],
    currentPlayerIndex: 0,
    dice: [1, 2],
    turnPhase: 'ROLL',
    consecutiveDoubles: 0,
    gameLog: [],
    events: [],
    propertyOwnership: { 'tile-1': 'p1', 'tile-3': 'p1' },
    mortgagedProperties: {},
    activeCard: null,
    turnTimer: 30,
    taxPool: 0,
    taxDebt: {},
    bankruptcyDraft: null,
    bankruptcyInfo: null,
    turboMode: false,
    boardTiles: HOGWARTS_TILES,
    boardSize: 40,
    turnCount: 1,
    roundCount: 1,
  };
}

// TEST 1: Basic canMortgageProperty
console.log('1. Testing canMortgageProperty basic validation...');
const s1 = createTestState();
const check1 = canMortgageProperty(s1.players[0], 'tile-1', s1);
assert.equal(check1.allowed, true, 'Property with 0 houses should be mortgagable');

// TEST 2: Color group houses rejection
console.log('2. Testing color group building rejection...');
s1.players[0].houses['tile-3'] = 1; // Partner tile has 1 house
const check2 = canMortgageProperty(s1.players[0], 'tile-1', s1);
assert.equal(check2.allowed, false, 'Should be rejected because partner property has houses');
assert.match(check2.reason || '', /nhóm màu/, 'Reason should mention color group buildings');

// TEST 3: Reducer rejects mortgage when partner has house
console.log('3. Testing gameReducer handles invalid mortgage cleanly without crashing or mutating...');
const s3BeforeBal = s1.players[0].balance;
const s3 = gameReducer(s1, { type: 'MORTGAGE_PROPERTY', propertyId: 'tile-1', playerId: 'p1' });
assert.equal(s3.players[0].balance, s3BeforeBal, 'Balance should not change on rejected mortgage');
assert.equal(s3.mortgagedProperties['tile-1'], undefined, 'Property must not be mortgaged');
assert.ok(s3.events.some((e) => e.message.includes('⚠️')), 'Warning event should be recorded');

// TEST 4: Sell house then mortgage succeeds
console.log('4. Testing sell house then mortgage succeeds...');
s1.players[0].houses['tile-3'] = 0;
const tile1 = HOGWARTS_TILES.find((t) => t.id === 'tile-1')!;
const expectedMortgageVal = tile1.mortgageValue || 30;

const s4 = gameReducer(s1, { type: 'MORTGAGE_PROPERTY', propertyId: 'tile-1', playerId: 'p1' });
assert.equal(s4.players[0].balance, s3BeforeBal + expectedMortgageVal, 'Balance increased by mortgage value');
assert.equal(s4.mortgagedProperties['tile-1'], true, 'tile-1 is now flagged as mortgaged');

// TEST 5: Cannot re-mortgage an already mortgaged property
console.log('5. Testing double mortgage prevention...');
const check5 = canMortgageProperty(s4.players[0], 'tile-1', s4);
assert.equal(check5.allowed, false, 'Already mortgaged property cannot be mortgaged again');

// TEST 6: Unmortgage requires cost + 10% interest
console.log('6. Testing unmortgage calculation and balance check...');
const unmortCost = Math.floor(expectedMortgageVal * 1.1);
const check6 = canUnmortgageProperty(s4.players[0], 'tile-1', s4);
assert.equal(check6.allowed, true);
assert.equal(check6.cost, unmortCost);

// Poor player cannot unmortgage
s4.players[0].balance = 5;
const check6Poor = canUnmortgageProperty(s4.players[0], 'tile-1', s4);
assert.equal(check6Poor.allowed, false, 'Insufficient funds should reject unmortgage');

// TEST 7: Reducer handles UNMORTGAGE_PROPERTY
console.log('7. Testing gameReducer UNMORTGAGE_PROPERTY execution...');
s4.players[0].balance = 500;
const s7 = gameReducer(s4, { type: 'UNMORTGAGE_PROPERTY', propertyId: 'tile-1', playerId: 'p1' });
assert.equal(s7.players[0].balance, 500 - unmortCost, 'Deducted cost with 10% interest');
assert.equal(s7.mortgagedProperties['tile-1'], undefined, 'tile-1 is no longer mortgaged');

// TEST 8: Bankruptcy phase allows debtor to mortgage via authorizeAction
console.log('8. Testing debtor action authorization during BANKRUPTCY phase...');
const s8 = createTestState();
s8.turnPhase = 'BANKRUPTCY';
s8.bankruptcyInfo = {
  debtorId: 'p1',
  creditorId: 'p2',
  amountOwed: 800,
};

const authMort = authorizeAction(s8, { type: 'MORTGAGE_PROPERTY', propertyId: 'tile-1' }, 'p1');
assert.deepEqual(authMort, { type: 'MORTGAGE_PROPERTY', propertyId: 'tile-1', playerId: 'p1' });

const authStranger = authorizeAction(s8, { type: 'MORTGAGE_PROPERTY', propertyId: 'tile-1' }, 'p2');
assert.equal(authStranger, null, 'Creditor or stranger cannot mortgage someone else property');

// TEST 9: Bot AI doesn't get stuck in an infinite mortgage dispatch loop
console.log('9. Testing Bot AI mortgagableProps filter with group buildings...');
const botState = createTestState();
const bot = botState.players[1];
bot.properties = ['tile-6', 'tile-8', 'tile-9']; // Light blue group
bot.houses['tile-8'] = 2; // tile-8 has houses, so tile-6 and tile-9 cannot be mortgaged!
botState.propertyOwnership['tile-6'] = 'p2';
botState.propertyOwnership['tile-8'] = 'p2';
botState.propertyOwnership['tile-9'] = 'p2';

// Check bot filter:
const validForMortgage = bot.properties.filter((id) => canMortgageProperty(bot, id, botState).allowed);
assert.equal(validForMortgage.length, 0, 'No properties can be mortgaged until tile_8 houses are sold');

console.log('\n🎉 ALL MORTGAGE & ANTI-LAG AUDIT TESTS PASSED 100%!\n');
