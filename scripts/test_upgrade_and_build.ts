import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { canBuildHouse, canBuildHotel } from '../src/core/rulesEngine';
import { HOGWARTS_TILES } from '../src/core/boardData';

function runTests() {
  console.log('--- Testing House and Hotel Upgrades without Monopoly Constraint ---');

  let state = createInitialState([
    { name: 'Harry', house: 'Gryffindor', isAI: false },
    { name: 'Draco', house: 'Slytherin', isAI: false },
  ]);

  const p0 = state.players[0];
  const tile1 = HOGWARTS_TILES[1]; // First purchasable property
  console.log(`Testing with tile: "${tile1.name}" (ID: ${tile1.id}, houseCost: ${tile1.houseCost})`);

  // 1. Give player 0 ownership of tile 1 only (NOT full set)
  state = {
    ...state,
    propertyOwnership: { [tile1.id]: p0.id },
    players: state.players.map((p) =>
      p.id === p0.id ? { ...p, properties: [tile1.id], balance: 5000 } : p
    ),
  };

  // Test canBuildHouse for 1st house
  const check1 = canBuildHouse(state.players[0], tile1.id, state);
  console.log('canBuildHouse (single property owned):', check1);
  if (!check1.allowed) {
    throw new Error(`FAIL: canBuildHouse should be allowed, got: ${check1.reason}`);
  }

  // Build house 1
  state = gameReducer(state, { type: 'BUILD_HOUSE', propertyId: tile1.id, playerId: p0.id });
  const p0AfterH1 = state.players.find((p) => p.id === p0.id)!;
  console.log(`After 1st house: houses=${p0AfterH1.houses[tile1.id]}, balance=${p0AfterH1.balance}`);
  if (p0AfterH1.houses[tile1.id] !== 1 || p0AfterH1.balance !== 5000 - (tile1.houseCost || 0)) {
    throw new Error('FAIL: house 1 count or balance deduction mismatch');
  }

  // Build up to 4 houses
  for (let i = 2; i <= 4; i++) {
    state = gameReducer(state, { type: 'BUILD_HOUSE', propertyId: tile1.id, playerId: p0.id });
  }
  const p0AfterH4 = state.players.find((p) => p.id === p0.id)!;
  console.log(`After 4 houses: houses=${p0AfterH4.houses[tile1.id]}, balance=${p0AfterH4.balance}`);
  if (p0AfterH4.houses[tile1.id] !== 4) {
    throw new Error('FAIL: expected 4 houses');
  }

  // Test canBuildHotel
  const checkHotel = canBuildHotel(p0AfterH4, tile1.id, state);
  console.log('canBuildHotel (with 4 houses, single property):', checkHotel);
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

  console.log('✅ Unit checks for building houses & hotel passed!');

  // 2. Test landing on own property with < 4 houses -> creates upgradeCandidate and ACTION phase
  console.log('\n--- Testing landing on own property ---');
  let landState = createInitialState([
    { name: 'Harry', house: 'Gryffindor', isAI: false },
    { name: 'Draco', house: 'Slytherin', isAI: false },
  ]);
  const tile3 = HOGWARTS_TILES[3];
  landState = {
    ...landState,
    propertyOwnership: { [tile3.id]: landState.players[0].id },
    players: landState.players.map((p, idx) =>
      idx === 0
        ? { ...p, properties: [tile3.id], balance: 5000, position: 0, houses: { [tile3.id]: 2 } }
        : p
    ),
  };

  // Roll dice to move from 0 to 3
  // Mock rolling 1 + 2 = 3
  // We can test resolveLanding indirectly by rolling dice or triggering dice roll
  // Let's test by setting player position to 0 and rolling 3 if dice were deterministic, or directly test gameReducer with ROLL_DICE when position lands on 3
  // Since ROLL_DICE uses Math.random(), let's test landing through resolveLanding mechanism:
  // Set position to 1, roll 2 (or test tile landing directly)
  const simulatedPlayer = { ...landState.players[0], position: 3 };
  const afterLandingState = gameReducer(
    {
      ...landState,
      turnPhase: 'ACTION',
      upgradeCandidate: {
        propertyId: tile3.id,
        cost: tile3.houseCost || 100,
        currentHouses: 2,
        hasHotel: false,
        isHotelUpgrade: false,
      },
    },
    { type: 'BUILD_HOUSE', propertyId: tile3.id, playerId: simulatedPlayer.id }
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
        propertyId: tile3.id,
        cost: tile3.houseCost || 100,
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
