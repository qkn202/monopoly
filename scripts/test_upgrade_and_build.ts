import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { canBuildHouse, canBuildHotel } from '../src/core/rulesEngine';
import { HOGWARTS_TILES } from '../src/core/boardData';

// Upstream 7099e39: a build needs a visit to the tile since the last build (landing, buying).
const visit = (s: any, playerId: string, tileId: string) => ({
  ...s,
  players: s.players.map((p: any) => (p.id === playerId ? { ...p, visitedProperties: [...p.visitedProperties, tileId] } : p)),
});

function runTests() {
  console.log('--- Testing House and Hotel Upgrades without Monopoly Constraint ---');

  let state = createInitialState([
    { name: 'Harry', house: 'Gryffindor', isAI: false },
    { name: 'Draco', house: 'Slytherin', isAI: false },
  ]);

  const p0 = state.players[0];
  const tile1 = HOGWARTS_TILES[1]; // First purchasable property
  const tile2 = HOGWARTS_TILES[3]; // Second purchasable property
  console.log(`Testing with tile1: "${tile1.name}" (ID: ${tile1.id}, idx: ${tile1.index}) and tile2: "${tile2.name}" (ID: ${tile2.id}, idx: ${tile2.index})`);

  // 1. Give player 0 ownership of tile1 and tile2 (no full color set)
  state = {
    ...state,
    propertyOwnership: { [tile1.id]: p0.id, [tile2.id]: p0.id },
    players: state.players.map((p) =>
      p.id === p0.id ? { ...p, properties: [tile1.id, tile2.id], visitedProperties: [], balance: 5000, position: 0 } : p
    ),
  };

  // 1a. When standing on GO (position 0), building on tile1 or tile2 is strictly rejected
  const checkWrongPosition = canBuildHouse(state.players[0], tile1.id, state);
  console.log('canBuildHouse while standing on different tile (GO):', checkWrongPosition);
  if (checkWrongPosition.allowed || !checkWrongPosition.reason?.includes('nơi bạn đang đặt chân đến')) {
    throw new Error('FAIL: Building house on property where player is not standing must be rejected');
  }

  // Move player position to tile1.index (standing on tile1)
  state = {
    ...state,
    players: state.players.map((p) => (p.id === p0.id ? { ...p, position: tile1.index } : p)),
  };

  // 1b. Standing on tile1, but trying to build on tile2 (other land) must be rejected
  const checkOtherLand = canBuildHouse(state.players[0], tile2.id, state);
  console.log('canBuildHouse on tile2 while standing on tile1 (should be rejected):', checkOtherLand);
  if (checkOtherLand.allowed || !checkOtherLand.reason?.includes('nơi bạn đang đặt chân đến')) {
    throw new Error('FAIL: Other lands cannot be upgraded when not standing on them');
  }

  // 1c. Standing on tile1, but without visit in subsequent turn, canBuildHouse is rejected
  const checkNoVisit = canBuildHouse(state.players[0], tile1.id, state);
  console.log('canBuildHouse without visit (should be rejected):', checkNoVisit);
  if (checkNoVisit.allowed || !checkNoVisit.reason?.includes('lần 2')) {
    throw new Error('FAIL: canBuildHouse without landing visit must be refused');
  }

  // 1d. After landing on tile1 in a subsequent turn (visitedProperties has tile1.id):
  // Even WITHOUT full color set, canBuildHouse is allowed!
  state = visit(state, p0.id, tile1.id);
  const check1 = canBuildHouse(state.players[0], tile1.id, state);
  console.log('canBuildHouse (standing on tile1, with 2nd visit):', check1);
  if (!check1.allowed) {
    throw new Error(`FAIL: canBuildHouse should be allowed without full set after visit, got: ${check1.reason}`);
  }

  // Build house 1
  state = gameReducer(state, { type: 'BUILD_HOUSE', propertyId: tile1.id, playerId: p0.id });
  const p0AfterH1 = state.players.find((p) => p.id === p0.id)!;
  console.log(`After 1st house: houses=${p0AfterH1.houses[tile1.id]}, balance=${p0AfterH1.balance}`);
  if (p0AfterH1.houses[tile1.id] !== 1 || p0AfterH1.balance !== 5000 - (tile1.houseCost || 0)) {
    throw new Error('FAIL: house 1 count or balance deduction mismatch');
  }

  // No second house without a new visit
  if (canBuildHouse(state.players[0], tile1.id, state).allowed) {
    throw new Error('FAIL: a second house without visiting the tile again must be refused');
  }

  // Build up to 4 houses, visiting between builds
  for (let i = 2; i <= 4; i++) {
    state = gameReducer(visit(state, p0.id, tile1.id), { type: 'BUILD_HOUSE', propertyId: tile1.id, playerId: p0.id });
  }
  state = visit(state, p0.id, tile1.id);
  const p0AfterH4 = state.players.find((p) => p.id === p0.id)!;
  console.log(`After 4 houses: houses=${p0AfterH4.houses[tile1.id]}, balance=${p0AfterH4.balance}`);
  if (p0AfterH4.houses[tile1.id] !== 4) {
    throw new Error('FAIL: expected 4 houses');
  }

  // Test canBuildHotel
  const checkHotel = canBuildHotel(p0AfterH4, tile1.id, state);
  console.log('canBuildHotel (with 4 houses, single property, standing on it):', checkHotel);
  if (!checkHotel.allowed) {
    throw new Error(`FAIL: canBuildHotel should be allowed, got: ${checkHotel.reason}`);
  }

  // Build Hotel
  state = gameReducer(state, { type: 'BUILD_HOTEL', propertyId: tile1.id, playerId: p0.id });
  const p0AfterHotel = state.players.find((p) => p.id === p0.id)!;
  console.log(`After hotel: houses=${p0AfterHotel.houses[tile1.id]}, hotels=${p0AfterHotel.hotels[tile1.id]}`);
  if (p0AfterHotel.houses[tile1.id] !== 0 || p0AfterHotel.hotels[tile1.id] !== 1) {
    throw new Error('FAIL: expected 0 houses and 1 hotel');
  }

  console.log('✅ Unit checks for standing-only building houses & hotel passed!');

  // 2. Test landing on own property with < 4 houses -> creates upgradeCandidate and ACTION phase
  console.log('\n--- Testing landing on own property ---');
  let landState = createInitialState([
    { name: 'Harry', house: 'Gryffindor', isAI: false },
    { name: 'Draco', house: 'Slytherin', isAI: false },
  ]);
  const landingTile = HOGWARTS_TILES[3];
  landState = {
    ...landState,
    propertyOwnership: { [tile1.id]: landState.players[0].id, [landingTile.id]: landState.players[0].id },
    players: landState.players.map((p, idx) =>
      idx === 0
        ? { ...p, properties: [tile1.id, landingTile.id], visitedProperties: [landingTile.id], balance: 5000, position: landingTile.index, houses: { [landingTile.id]: 2 } }
        : p
    ),
  };

  const simulatedPlayer = landState.players[0];
  const afterLandingState = gameReducer(
    {
      ...landState,
      turnPhase: 'ACTION',
      upgradeCandidate: {
        propertyId: landingTile.id,
        cost: landingTile.houseCost || 100,
        currentHouses: 2,
        hasHotel: false,
        isHotelUpgrade: false,
      },
    },
    { type: 'BUILD_HOUSE', propertyId: landingTile.id, playerId: simulatedPlayer.id }
  );

  console.log('After building during landing: turnPhase =', afterLandingState.turnPhase, ', upgradeCandidate =', afterLandingState.upgradeCandidate);
  if (afterLandingState.turnPhase !== 'END_TURN' || afterLandingState.upgradeCandidate !== null) {
    throw new Error('FAIL: Building house on landed tile should advance to END_TURN and clear upgradeCandidate');
  }

  // 3. Test PASS_PROPERTY on upgradeCandidate
  const passState = gameReducer(
    {
      ...landState,
      turnPhase: 'ACTION',
      upgradeCandidate: {
        propertyId: landingTile.id,
        cost: landingTile.houseCost || 100,
        currentHouses: 2,
        hasHotel: false,
        isHotelUpgrade: false,
      },
    },
    { type: 'PASS_PROPERTY' }
  );
  console.log('After PASS_PROPERTY: turnPhase =', passState.turnPhase, ', upgradeCandidate =', passState.upgradeCandidate);
  if (passState.turnPhase !== 'END_TURN' || passState.upgradeCandidate !== null) {
    throw new Error('FAIL: Passing upgrade should advance to END_TURN and clear upgradeCandidate');
  }

  console.log('✅ ALL TESTS PASSED SUCCESSFULLY!');
}

runTests();
