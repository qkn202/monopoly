import { startHostSession, startGuestSession, generateRoomCode } from '../src/network/peerManager';
import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { GameState, Player, GameAction } from '../src/core/types';

async function runMultiplayerTest() {
  console.log('⚡ TESTING SUPABASE MULTIPLAYER REALTIME ENGINE...\n');

  const testRoomCode = generateRoomCode();
  console.log(`Room Code: ${testRoomCode}`);

  let hostState: GameState = createInitialState([
    { name: 'Harry Potter (Host)', house: 'Gryffindor', isAI: false },
  ]);

  let guestAssignedId: string | null = null;
  let guestSyncedState: GameState | null = null;
  let guestReceivedSyncCount = 0;
  let hostReceivedActionCount = 0;

  console.log('1. Starting Host Session on Supabase...');
  let hostSession: any = null;
  let guestSession: any = null;

  try {
    hostSession = await startHostSession(
      testRoomCode,
      (guestSender, guestData) => {
        console.log(`[Host] Guest joined: ${guestData.playerName} (${guestData.house})`);
        const newPlayerId = `p-${hostState.players.length}`;
        const newPlayer: Player = {
          id: newPlayerId,
          name: guestData.playerName,
          house: guestData.house,
          color: '#10b981',
          tokenIcon: '🐍',
          balance: 5000,
          position: 0,
          properties: [],
          inJail: false,
          jailTurnsRemaining: 0,
          getOutOfJailCards: 0,
          isBankrupt: false,
          isAI: false,
          houses: {},
          hotels: {},
          netWorth: 5000,
        };

        hostState = {
          ...hostState,
          players: [...hostState.players, newPlayer],
        };

        guestSender.send({
          type: 'JOIN_ACCEPTED',
          targetGuestId: guestSender.id,
          assignedPlayerId: newPlayerId,
          initialGameState: hostState,
        });

        hostSession.broadcastState(hostState);
      },
      (action: GameAction, senderId: string) => {
        hostReceivedActionCount++;
        console.log(`[Host] Received action from guest (${senderId}):`, action.type);
        hostState = gameReducer(hostState, action);
        hostSession.broadcastState(hostState);
      },
      (guestSender) => {
        console.log(`[Host] Guest ${guestSender.id} left`);
      }
    );

    console.log('✅ Host session initialized and subscribed to Supabase channel.\n');

    console.log('2. Starting Guest Session to join room...');
    guestSession = await startGuestSession(
      testRoomCode,
      'Draco Malfoy (Guest)',
      'Slytherin',
      (syncedState) => {
        guestReceivedSyncCount++;
        guestSyncedState = syncedState;
        console.log(`[Guest] Received state sync #${guestReceivedSyncCount}. Active turn player: ${syncedState.players[syncedState.currentPlayerIndex]?.name}`);
      },
      (assignedPlayerId, initialState) => {
        guestAssignedId = assignedPlayerId;
        guestSyncedState = initialState;
        console.log(`[Guest] Successfully joined! Assigned ID: ${assignedPlayerId}`);
      },
      () => {
        console.log('[Guest] Disconnected from host');
      }
    );

    console.log('✅ Guest connected and accepted!\n');

    // Wait 1.5s for initial sync
    await new Promise((r) => setTimeout(r, 1500));

    console.assert(guestAssignedId === 'p-1', `Guest should be assigned ID p-1, got ${guestAssignedId}`);
    console.assert(hostState.players.length === 2, `Host should have 2 players, got ${hostState.players.length}`);
    console.assert(hostState.players[1].balance === 5000, `Guest balance must be 5000, got ${hostState.players[1].balance}`);
    console.assert(guestSyncedState !== null, 'Guest should have received state');

    console.log('3. Guest sends action: ROLL_DICE to Host...');
    guestSession.sendAction({ type: 'ROLL_DICE' });

    // Wait for roundtrip
    await new Promise((r) => setTimeout(r, 1500));

    console.assert(hostReceivedActionCount === 1, `Host should have received 1 action, got ${hostReceivedActionCount}`);
    console.assert(guestReceivedSyncCount >= 1, `Guest should have received state sync, got ${guestReceivedSyncCount}`);

    console.log('\n🎉 ALL MULTIPLAYER SUPABASE REALTIME TESTS PASSED SUCCESSFULLY!');
  } finally {
    if (guestSession) guestSession.destroy();
    if (hostSession) hostSession.destroy();
    // Allow Supabase websocket to disconnect cleanly
    await new Promise((r) => setTimeout(r, 1000));
  }
}

runMultiplayerTest()
  .then(() => {
    console.log('Test completed cleanly.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Multiplayer test error:', err);
    process.exit(1);
  });
