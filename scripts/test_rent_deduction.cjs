const { createInitialState, gameReducer } = require('../src/core/gameReducer');
const { HOGWARTS_TILES } = require('../src/core/boardData');

const p1 = { id: 'p-0', name: 'Harry Potter', house: 'Gryffindor', isAI: false };
const p2 = { id: 'p-1', name: 'Draco Malfoy', house: 'Slytherin', isAI: true };

let state = createInitialState([p1, p2]);

// Player 0 buys tile 1 (Borgin & Burkes, id: prop-borgin-burkes)
const tile1 = HOGWARTS_TILES[1];
console.log('Tile 1:', tile1.id, tile1.name, 'price:', tile1.price, 'baseRent:', tile1.baseRent);

state = gameReducer(state, { type: 'BUY_PROPERTY', propertyId: tile1.id });
console.log('P0 properties:', state.players[0].properties);
console.log('Property ownership:', state.propertyOwnership);

// Advance turn to Player 1 (Draco)
state = gameReducer(state, { type: 'END_TURN' });
console.log('Current player:', state.players[state.currentPlayerIndex].name);

// Now force Draco at position 0 to roll 1, so Draco lands on tile 1
// Let's test what resolveLanding does:
const dracoBeforeBalance = state.players[1].balance;
const harryBeforeBalance = state.players[0].balance;

console.log('Before Draco lands on tile 1:');
console.log('Harry balance:', harryBeforeBalance);
console.log('Draco balance:', dracoBeforeBalance);

// Trigger landing by simulating state before and after
// In gameReducer, ROLL_DICE generates random, but we can set position or mock Math.random
const oldRandom = Math.random;
// Roll 1: d1 = 1, d2 = 0? d1 = Math.floor(Math.random()*6) + 1. If random returns 0 -> d1=1, if random returns 0 -> d2=1 => total=2.
// Let's set Draco's position to tile 1 directly and call resolveLanding or simulate action
