import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { ownsFullColorSet, calculateRent } from '../src/core/rulesEngine';
import { getCardCoord, getTileTokenPosition } from '../src/render/BoardCoordinates';
import { getBoardTiles } from '../src/core/boardVariants';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASSED: ${msg}`);
}

console.log('--- Testing Board Size Variants (20, 28, 40 tiles) ---');

// 1. Initial State for 20-tile Board
const players = [
  { name: 'Harry', house: 'Gryffindor' as const, isAI: false },
  { name: 'Draco', house: 'Slytherin' as const, isAI: true }
];

const state20 = createInitialState(players, 20);
assert(state20.boardSize === 20, '20-tile state has boardSize === 20');
assert(state20.boardTiles?.length === 20, '20-tile state has exactly 20 tiles');
assert(state20.boardTiles[0].type === 'GO', 'Index 0 is GO on 20-tile board');
assert(state20.boardTiles[5].type === 'JAIL', 'Index 5 is JAIL on 20-tile board');
assert(state20.boardTiles[10].type === 'FREE_PARKING', 'Index 10 is FREE_PARKING on 20-tile board');
assert(state20.boardTiles[15].type === 'GO_TO_JAIL', 'Index 15 is GO_TO_JAIL on 20-tile board');

// 2. Initial State for 28-tile Board
const state28 = createInitialState(players, 28);
assert(state28.boardSize === 28, '28-tile state has boardSize === 28');
assert(state28.boardTiles?.length === 28, '28-tile state has exactly 28 tiles');
assert(state28.boardTiles[0].type === 'GO', 'Index 0 is GO on 28-tile board');
assert(state28.boardTiles[7].type === 'JAIL', 'Index 7 is JAIL on 28-tile board');
assert(state28.boardTiles[14].type === 'FREE_PARKING', 'Index 14 is FREE_PARKING on 28-tile board');
assert(state28.boardTiles[21].type === 'GO_TO_JAIL', 'Index 21 is GO_TO_JAIL on 28-tile board');

// 3. Initial State for 40-tile Board (Classic Hogwarts)
const state40 = createInitialState(players, 40);
assert(state40.boardSize === 40, '40-tile state has boardSize === 40');
assert(state40.boardTiles?.length === 40, '40-tile state has exactly 40 tiles');
assert(state40.boardTiles[0].type === 'GO', 'Index 0 is GO on 40-tile board');
assert(state40.boardTiles[10].type === 'JAIL', 'Index 10 is JAIL on 40-tile board');
assert(state40.boardTiles[20].type === 'FREE_PARKING', 'Index 20 is FREE_PARKING on 40-tile board');
assert(state40.boardTiles[30].type === 'GO_TO_JAIL', 'Index 30 is GO_TO_JAIL on 40-tile board');

// 4. Wrap around movement and passing GO on 20-tile board
let moveState20 = {
  ...state20,
  players: [
    { ...state20.players[0], position: 18, balance: 1500 },
    state20.players[1]
  ],
  turnPhase: 'ROLL' as const
};
// Roll 1 + 3 = 4 -> from 18 to (18+4)%20 = 2, passes GO (+500)
moveState20 = gameReducer(moveState20, { type: 'ROLL_DICE', forceRoll: [1, 3] });
assert(moveState20.players[0].position === 2, 'Player moved from 18 to 2 on 20-tile board');
assert(moveState20.players[0].balance === 2000, 'Player received 500 GO bonus on 20-tile board');

// 5. Landing on GO_TO_JAIL on 20-tile board
let jailState20 = {
  ...state20,
  players: [
    { ...state20.players[0], position: 12, balance: 1500 },
    state20.players[1]
  ],
  turnPhase: 'ROLL' as const
};
// Roll 1 + 2 = 3 -> from 12 to 15 (GO_TO_JAIL)
jailState20 = gameReducer(jailState20, { type: 'ROLL_DICE', forceRoll: [1, 2] });
assert(jailState20.players[0].inJail === true, 'Player is sent to JAIL on 20-tile board');
assert(jailState20.players[0].position === 5, 'Player position is placed at index 5 (JAIL) on 20-tile board');

// 6. Landing on GO_TO_JAIL on 28-tile board
let jailState28 = {
  ...state28,
  players: [
    { ...state28.players[0], position: 18, balance: 1500 },
    state28.players[1]
  ],
  turnPhase: 'ROLL' as const
};
// Roll 1 + 2 = 3 -> from 18 to 21 (GO_TO_JAIL)
jailState28 = gameReducer(jailState28, { type: 'ROLL_DICE', forceRoll: [1, 2] });
assert(jailState28.players[0].inJail === true, 'Player is sent to JAIL on 28-tile board');
assert(jailState28.players[0].position === 7, 'Player position is placed at index 7 (JAIL) on 28-tile board');

// 7. Full color set (Monopoly) on 20-tile board (2 properties per group)
const brownProps20 = state20.boardTiles.filter(t => t.colorGroup === 'BROWN').map(t => t.id);
assert(brownProps20.length === 2, '20-tile board has 2 BROWN properties');

const monopolyState20 = {
  ...state20,
  propertyOwnership: {
    [brownProps20[0]]: state20.players[0].id,
    [brownProps20[1]]: state20.players[0].id
  },
  players: [
    { ...state20.players[0], properties: brownProps20 },
    state20.players[1]
  ]
};
assert(ownsFullColorSet(monopolyState20.players[0], 'BROWN', monopolyState20) === true, 'Player owns full BROWN set on 20-tile board');

const firstBrownTile = state20.boardTiles.find(t => t.id === brownProps20[0])!;
const baseRent = firstBrownTile.baseRent || 0;
const actualRent = calculateRent(firstBrownTile, monopolyState20.players[0], 4, monopolyState20);
assert(actualRent === baseRent, `Independent unimproved rent on 20-tile board (${actualRent} === ${baseRent})`);

// 8. 3D Coordinates check
for (const size of [20, 28, 40]) {
  for (let i = 0; i < size; i++) {
    const cardCoord = getCardCoord(i, size);
    assert(!isNaN(cardCoord.x) && !isNaN(cardCoord.y) && !isNaN(cardCoord.z) && !isNaN(cardCoord.rotZ), `Card coord for tile ${i}/${size} is valid`);
    const tokenCoord = getTileTokenPosition(i, 0, 4, size);
    assert(!isNaN(tokenCoord.x) && !isNaN(tokenCoord.z), `Token pos for tile ${i}/${size} is valid`);
  }
}

console.log('🎉 All Board Size Variant tests passed successfully!');
