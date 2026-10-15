import assert from 'node:assert/strict';
import { canMortgageProperty, canUnmortgageProperty, canBuildHouse, canBuildHotel, calculateRent } from '../src/core/rulesEngine';
import { gameReducer } from '../src/core/gameReducer';
import { authorizeAction } from '../src/core/actionAuth';
import { getBotAction } from '../src/core/botAI';
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

// TEST 10: cannot build houses if any property in group is mortgaged
console.log('10. Testing cannot build houses when partner in color group is mortgaged...');
const s10 = createTestState();
s10.mortgagedProperties['tile-1'] = true; // tile-1 is mortgaged
s10.players[0].position = 3; // Standing on tile-3
s10.players[0].visitedProperties = ['tile-3'];
const buildCheck = canBuildHouse(s10.players[0], 'tile-3', s10);
assert.equal(buildCheck.allowed, false);
assert.match(buildCheck.reason || '', /nhóm màu/);

// TEST 11: cannot build hotel if any property in group is mortgaged
console.log('11. Testing cannot build hotel when partner in color group is mortgaged...');
s10.players[0].houses['tile-3'] = 4;
const hotelCheck = canBuildHotel(s10.players[0], 'tile-3', s10);
assert.equal(hotelCheck.allowed, false);
assert.match(hotelCheck.reason || '', /nhóm màu/);

// TEST 12: double rent is disabled if any property in color group is mortgaged
console.log('12. Testing double rent disabled on unimproved property when partner is mortgaged...');
const s12 = createTestState();
const tile3 = HOGWARTS_TILES.find((t) => t.id === 'tile-3')!;
// When not mortgaged: full color set gives double rent (e.g. 20 * 2 = 40)
const unmortgagedRent = calculateRent(tile3, s12.players[0], 7, s12);
assert.equal(unmortgagedRent, (tile3.baseRent || 20) * 2);

// When partner tile-1 is mortgaged: double rent must be disabled! Only base rent!
s12.mortgagedProperties['tile-1'] = true;
const mortgagedPartnerRent = calculateRent(tile3, s12.players[0], 7, s12);
assert.equal(mortgagedPartnerRent, tile3.baseRent || 20);

// TEST 13: cannot unmortgage during bankruptcy phase
console.log('13. Testing cannot unmortgage while in BANKRUPTCY phase owing debt...');
const s13 = createTestState();
s13.turnPhase = 'BANKRUPTCY';
s13.bankruptcyInfo = { debtorId: 'p1', amountOwed: 500 };
s13.mortgagedProperties['tile-1'] = true;
s13.players[0].balance = 1000;
const unmortCheck = canUnmortgageProperty(s13.players[0], 'tile-1', s13);
assert.equal(unmortCheck.allowed, false);
assert.match(unmortCheck.reason || '', /vỡ nợ/);

// TEST 14: bot downgrades hotel to raise money before declaring bankruptcy
console.log('14. Testing bot AI sells hotel before declaring bankruptcy...');
const s14 = createTestState();
s14.turnPhase = 'BANKRUPTCY';
s14.bankruptcyInfo = { debtorId: 'p2', creditorId: 'p1', amountOwed: 2000, reason: 'Nợ tiền thuê' };
const botPlayer = s14.players[1];
botPlayer.balance = 50;
botPlayer.properties = ['tile-6'];
botPlayer.hotels['tile-6'] = 1;
botPlayer.houses['tile-6'] = 0;
s14.propertyOwnership['tile-6'] = 'p2';

const botAction = getBotAction(s14, botPlayer);
assert.deepEqual(botAction, { type: 'SELL_HOUSE', propertyId: 'tile-6', playerId: 'p2' });

console.log('\n🎉 ALL 14 MORTGAGE & ANTI-LAG AUDIT TESTS PASSED 100%!\n');
