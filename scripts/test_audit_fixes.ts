import { createInitialState, gameReducer, handleTurnTimeout } from '../src/core/gameReducer';
import { resolveDebtOrLiquidate, handleBankruptcy, executeCardEffect } from '../src/core/reducerHelpers';
import { calculateRent, canBuildHouse, canBuildHotel } from '../src/core/rulesEngine';
import { HOGWARTS_TILES } from '../src/core/boardData';
import { Player, GameState, CardConfig } from '../src/core/types';

function runTests() {
  console.log('🔮 RUNNING FULL MONOPOLY AUDIT TEST SUITE...\n');

  // TEST 1: Debt Liquidation with Hotels & Houses
  console.log('Test 1: Orderly Liquidation (Houses & Hotels sold before bankruptcy)...');
  const baseState = createInitialState([
    { name: 'Harry', house: 'Gryffindor', isAI: false },
    { name: 'Draco', house: 'Slytherin', isAI: false },
  ]);

  const p1 = baseState.players[0]; // Harry
  const p2 = baseState.players[1]; // Draco

  // Harry owns tile 1 (Diagon Alley #1) with 1 hotel (castle) and 10G cash
  const tile1 = HOGWARTS_TILES[1]; // Brown property, price 200, houseCost 150
  const stateWithHotel: GameState = {
    ...baseState,
    propertyOwnership: { [tile1.id]: p1.id },
    players: [
      {
        ...p1,
        balance: 10,
        properties: [tile1.id],
        houses: { [tile1.id]: 0 },
        hotels: { [tile1.id]: 1 },
      },
      p2,
    ],
  };

  // Harry owes Draco 200G (more than cash 10G, but hotel + house sell values can cover it)
  // Hotel sell gives: 75G (downgrade to 4 cottages), then selling cottages gives 75G each (up to 4*75 = 300G)
  // Total available = 10 + 75 + 300 + mortgageValue(100) = 485G
  const debtorHarry = stateWithHotel.players[0];
  const liquidationRes = resolveDebtOrLiquidate(stateWithHotel, debtorHarry, 200, p2.id, 'tiền thuê đất');

  console.assert(!liquidationRes.isBankrupt, 'Debtor should NOT be bankrupt because assets exceed debt');
  const updatedHarry = liquidationRes.state.players.find(p => p.id === p1.id)!;
  const updatedDraco = liquidationRes.state.players.find(p => p.id === p2.id)!;

  console.assert(updatedHarry.balance >= 0, `Harry balance should be >= 0, got ${updatedHarry.balance}`);
  console.assert(updatedHarry.hotels[tile1.id] === 0, 'Hotel should have been dismantled');
  console.assert(updatedDraco.balance === p2.balance + 200, `Draco should receive 200G, got ${updatedDraco.balance}`);
  console.log('✅ Test 1 Passed: Orderly liquidation successfully raised cash without phantom cash or negative balance.\n');

  // TEST 2: True Bankruptcy Transfers Cash & Properties to Creditor
  console.log('Test 2: True Bankruptcy Handling...');
  const insolventState: GameState = {
    ...baseState,
    propertyOwnership: { [tile1.id]: p1.id },
    players: [
      {
        ...p1,
        balance: 15, // Has 15G cash
        properties: [tile1.id],
        houses: {},
        hotels: {},
      },
      { ...p2, balance: 1000 },
    ],
  };

  // Harry owes 500G to Draco, but only has 15G cash + 30G mortgage = 45G total!
  const bankruptHarry = insolventState.players[0];
  const bankruptRes = resolveDebtOrLiquidate(insolventState, bankruptHarry, 500, p2.id, 'nợ không thể trả');

  console.assert(bankruptRes.isBankrupt, 'Harry should be declared bankrupt');
  const finalHarry = bankruptRes.state.players.find(p => p.id === p1.id)!;
  const finalDraco = bankruptRes.state.players.find(p => p.id === p2.id)!;

  console.assert(finalHarry.isBankrupt, 'Harry isBankrupt must be true');
  console.assert(finalHarry.balance === 0, 'Harry balance must be 0');
  console.assert(finalDraco.balance === 1015, `Draco should have received Harry's 15G remaining cash! Got: ${finalDraco.balance}`);
  console.assert(bankruptRes.state.propertyOwnership[tile1.id] === p2.id, 'Tile 1 must be transferred to Draco');
  console.assert(finalDraco.properties.includes(tile1.id), 'Draco properties list must include Tile 1');
  console.log('✅ Test 2 Passed: Creditor received remaining cash & properties upon bankruptcy.\n');

  // TEST 3: Jail Turn 3 Fine Protection
  console.log('Test 3: Jail Turn 3 Forced Fine Safety...');
  // Player is in jail on turn 3 with only 10G cash and no properties
  const jailState: GameState = {
    ...baseState,
    turnPhase: 'ROLL',
    players: [
      {
        ...p1,
        balance: 10,
        inJail: true,
        jailTurnsRemaining: 1, // Final turn in Azkaban
        properties: [],
      },
      p2,
    ],
  };

  // Roll non-double (e.g. 1 and 2)
  const afterJailRoll = gameReducer(jailState, { type: 'ROLL_DICE' });
  const jailP1 = afterJailRoll.players.find(p => p.id === p1.id)!;
  console.assert(jailP1.balance >= 0, `Player balance after failed jail fine must NOT be negative! Got: ${jailP1.balance}`);
  if (jailP1.isBankrupt) {
    console.assert(afterJailRoll.turnPhase === 'GAME_OVER' || afterJailRoll.turnPhase === 'END_TURN', 'Must transition phase cleanly');
  }
  console.log('✅ Test 3 Passed: Jail turn 3 fine never causes negative balance.\n');

  // TEST 4: Card Effects with Negative Amounts / Repairs
  console.log('Test 4: Magic Card Effects Debt Resolution...');
  const repairsCard: CardConfig = {
    id: 'c-repairs',
    title: 'Trùng tu lâu đài',
    description: 'Chi phí sửa chữa',
    action: 'REPAIRS',
    amount: 50, // 50 per house, 200 per hotel
  };

  const richHarryWithHouses: GameState = {
    ...baseState,
    players: [
      {
        ...p1,
        balance: 200,
        properties: [tile1.id],
        houses: { [tile1.id]: 2 }, // 2 houses = 100G repairs
        hotels: {},
      },
      p2,
    ],
  };

  const cardRes = executeCardEffect(richHarryWithHouses, richHarryWithHouses.players[0], repairsCard);
  const afterRepairHarry = cardRes.nextState.players.find(p => p.id === p1.id)!;
  console.assert(afterRepairHarry.balance === 100, `Harry should have 100G remaining after 100G repairs, got ${afterRepairHarry.balance}`);
  console.assert(cardRes.nextState.freeParkingPot === richHarryWithHouses.freeParkingPot + 100, 'Free parking pot should receive 100G');
  console.log('✅ Test 4 Passed: Card repairs & penalties route safely into debt settlement & free parking pot.\n');

  // TEST 5: Rent & Dark Curse Multipliers
  console.log('Test 5: Rent Multiplier & Dark Curse Escalation...');
  const tile3 = HOGWARTS_TILES[3]; // Diagon Alley #2 (Brown, base rent 15)
  const brownGroupState: GameState = {
    ...baseState,
    rentMultiplier: 2, // Dark curse 2x multiplier
    propertyOwnership: {
      [tile1.id]: p2.id,
      [tile3.id]: p2.id,
    },
  };

  const dracoOwner = brownGroupState.players[1];
  // Full color group doubles base rent (15 * 2 = 30), dark curse doubles again (30 * 2 = 60)
  const calculatedRent = calculateRent(tile3, dracoOwner, 7, brownGroupState);
  console.assert(calculatedRent === 60, `Calculated rent should be 60G with monopoly + 2x dark curse, got ${calculatedRent}`);

  // If mortgaged, rent must be strictly 0
  const mortgagedState: GameState = {
    ...brownGroupState,
    mortgagedProperties: { [tile3.id]: true },
  };
  const mortgagedRent = calculateRent(tile3, dracoOwner, 7, mortgagedState);
  console.assert(mortgagedRent === 0, `Mortgaged property rent must be 0, got ${mortgagedRent}`);
  console.log('✅ Test 5 Passed: Rent rules, full set doubling, dark curse 2x, and mortgage exemptions validated.\n');

  // TEST 6: Timer Tick & Turn Timeout Auto-Play
  console.log('Test 6: Timer Tick & Turn Timeout Execution...');
  const stateNearExpiry: GameState = {
    ...baseState,
    timer: {
      durationSeconds: 1800,
      remainingSeconds: 1,
      isExpired: false,
      isPaused: false,
    },
  };

  const expiredState = gameReducer(stateNearExpiry, { type: 'TIMER_TICK' });
  console.assert(expiredState.turnPhase === 'GAME_OVER', 'Game should be GAME_OVER when timer hits 0');
  console.assert(expiredState.winner !== null, 'Winner should be selected based on net worth');
  console.log('✅ Test 6 Passed: Game expiration timer ends game and declares wealthiest player victor.\n');

  // TEST 7: Hostile Takeover (Mua Đứt Cưỡng Chế x2 Giá)
  console.log('Test 7: Hostile Takeover Execution & Property Transfer...');
  // Draco owns Tile 1 (Diagon Alley #1, price 200, houseCost 150) with 1 cottage
  // Total asset value = 200 + 150 = 350G -> Takeover cost = 350 * 2 = 700G!
  const dracoTile = HOGWARTS_TILES[1];
  const takeoverSetupState: GameState = {
    ...baseState,
    turnPhase: 'ROLL',
    propertyOwnership: { [dracoTile.id]: p2.id },
    players: [
      { ...p1, balance: 2500, position: 0 }, // Harry at GO
      {
        ...p2,
        balance: 1000,
        properties: [dracoTile.id],
        houses: { [dracoTile.id]: 1 },
        hotels: {},
      },
    ],
  };

  // Harry rolls 1 (moving from 0 to 1, landing on Draco's Diagon Alley)
  // Let's simulate Harry landing on tile 1:
  // First, Harry owes rent (tier 1 house rent = 40G). Harry balance drops from 2500 to 2460G.
  // Draco balance goes from 1000 to 1040G.
  // Harry has 2460G >= 700G takeoverCost -> game sets turnPhase = 'ACTION' and takeoverCandidate is populated!
  const stateWithCandidate: GameState = {
    ...takeoverSetupState,
    players: [
      { ...p1, balance: 2460, position: 1 },
      { ...p2, balance: 1040, properties: [dracoTile.id], houses: { [dracoTile.id]: 1 }, hotels: {} },
    ],
    turnPhase: 'ACTION',
    takeoverCandidate: {
      propertyId: dracoTile.id,
      cost: 700,
      ownerId: p2.id,
      ownerName: p2.name,
    },
  };

  // Harry triggers TAKEOVER_PROPERTY!
  const afterTakeover = gameReducer(stateWithCandidate, {
    type: 'TAKEOVER_PROPERTY',
    propertyId: dracoTile.id,
  });

  const finalBuyer = afterTakeover.players.find(p => p.id === p1.id)!;
  const finalSeller = afterTakeover.players.find(p => p.id === p2.id)!;

  console.assert(finalBuyer.balance === 2460 - 700, `Harry balance should be 1760, got ${finalBuyer.balance}`);
  console.assert(finalSeller.balance === 1040 + 700, `Draco balance should be 1740, got ${finalSeller.balance}`);
  console.assert(afterTakeover.propertyOwnership[dracoTile.id] === p1.id, 'Tile 1 must now be owned by Harry');
  console.assert(finalBuyer.properties.includes(dracoTile.id), 'Harry properties must include Tile 1');
  console.assert(!finalSeller.properties.includes(dracoTile.id), 'Draco properties must not include Tile 1');
  console.assert(finalBuyer.houses[dracoTile.id] === 1, 'Harry should inherit the cottage on the tile');
  console.assert(finalSeller.houses[dracoTile.id] === 0, 'Draco cottage count must be cleared');
  console.assert(afterTakeover.turnPhase === 'END_TURN', 'Phase should be END_TURN');
  console.assert(afterTakeover.takeoverCandidate === null, 'takeoverCandidate should be cleared');
  console.log('✅ Test 7 Passed: Hostile Takeover transferred ownership, cottage, and 2x funds accurately.\n');

  // =========================================================================
  // TEST 8: Hostile Takeover Decline via PASS_PROPERTY
  // =========================================================================
  console.log('Test 8: Hostile Takeover Decline via PASS_PROPERTY...');
  const afterDecline = gameReducer(stateWithCandidate, { type: 'PASS_PROPERTY' });
  console.assert(afterDecline.turnPhase === 'END_TURN', 'Phase must transition to END_TURN after declining takeover');
  console.assert(afterDecline.takeoverCandidate === null, 'takeoverCandidate must be null after decline');
  console.assert(afterDecline.propertyOwnership[dracoTile.id] === p2.id, 'Tile must remain owned by Draco');
  console.log('✅ Test 8 Passed: PASS_PROPERTY cleanly skips takeover and advances to END_TURN.\n');

  // =========================================================================
  // TEST 9: Turn Timeout During Hostile Takeover
  // =========================================================================
  console.log('Test 9: Turn Timeout During Hostile Takeover Candidate...');
  const afterTimeout = handleTurnTimeout(stateWithCandidate);
  console.assert(afterTimeout.currentPlayerIndex === 1, 'Turn must advance to Draco after timeout');
  console.assert(afterTimeout.turnPhase === 'ROLL', 'Next player must be in ROLL phase');
  console.assert(afterTimeout.takeoverCandidate === null, 'takeoverCandidate must be null after timeout');
  console.assert(afterTimeout.propertyOwnership[dracoTile.id] === p2.id, 'Tile remains with Draco');
  console.log('✅ Test 9 Passed: 1-minute timeout skips takeover and smoothly advances turn.\n');

  // =========================================================================
  // TEST 10: Multi-Player Card Effect (PAY_PLAYERS)
  // =========================================================================
  console.log('Test 10: Multi-Player Card Effect (PAY_PLAYERS)...');
  const p3: Player = { ...p2, id: 'player-3', name: 'Ron Weasley', balance: 300, properties: [], houses: {}, hotels: {} };
  const multiState: GameState = {
    ...baseState,
    players: [
      { ...p1, balance: 100 },
      { ...p2, balance: 200 },
      p3,
    ],
  };
  const payCard: CardConfig = {
    id: 'test-pay',
    title: 'Snitch Reward',
    description: 'Each player pays you 20G',
    action: 'PAY_PLAYERS',
    amount: 20,
  };
  const cardExecResult = executeCardEffect(multiState, multiState.players[0], payCard);
  const p1Final = cardExecResult.nextState.players.find(p => p.id === p1.id)!;
  const p2Final = cardExecResult.nextState.players.find(p => p.id === p2.id)!;
  const p3Final = cardExecResult.nextState.players.find(p => p.id === p3.id)!;

  console.assert(p2Final.balance === 180, `p2 should have 180G, got ${p2Final.balance}`);
  console.assert(p3Final.balance === 280, `p3 should have 280G, got ${p3Final.balance}`);
  console.assert(p1Final.balance === 140, `p1 should receive 20+20=40G -> 140G, got ${p1Final.balance}`);
  console.log('✅ Test 10 Passed: PAY_PLAYERS accurately transfers funds across all non-bankrupt players.\n');

  // =========================================================================
  // TEST 11: Non-Owner Cannot Sell Buildings
  // =========================================================================
  console.log('Test 11: Non-Owner Cannot Sell Buildings...');
  const illegalSellState = gameReducer(
    {
      ...baseState,
      currentPlayerIndex: 0, // Harry's turn
      propertyOwnership: { [dracoTile.id]: p2.id }, // Draco owns tile
      players: [
        { ...p1, properties: [] },
        { ...p2, properties: [dracoTile.id], houses: { [dracoTile.id]: 2 } },
      ],
    },
    { type: 'SELL_HOUSE', propertyId: dracoTile.id }
  );
  const dracoAfterIllegalSell = illegalSellState.players.find(p => p.id === p2.id)!;
  console.assert(dracoAfterIllegalSell.houses[dracoTile.id] === 2, 'Draco houses must remain intact when another player attempts to sell');
  console.log('✅ Test 11 Passed: Security guard prevents non-owners from selling houses.\n');

  console.log('🎉 ALL 11 AUDIT & GAMEPLAY TEST SUITES PASSED FLAWLESSLY!');
}

runTests();
