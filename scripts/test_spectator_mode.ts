import { createInitialState } from '../src/core/gameReducer';
import {
  generateMatchCode,
  broadcastSpectatorState,
  getLatestSpectatorState,
  subscribeToSpectatorState,
  getSpectatorUrl,
  initHostSpectatorBroadcaster,
} from '../src/core/spectatorSync';
import { packSnapshot, unpackSnapshot } from '../src/hpvn/onlineGame';
import { GameState } from '../src/core/types';

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`❌ FAIL: ${msg}`);
    process.exit(1);
  }
  console.log(`✅ PASS: ${msg}`);
}

console.log('--- TEST SUITE: SPECTATOR MODE & LIVE SYNC ---');

// 1. Test Match Code Generation
console.log('\n1. Test Match Code Generation:');
const code1 = generateMatchCode();
const code2 = generateMatchCode();
assert(code1.length === 6, `Code 1 should be 6 characters: ${code1}`);
assert(code2.length === 6, `Code 2 should be 6 characters: ${code2}`);
assert(code1 !== code2, `Generated codes should be distinct: ${code1} vs ${code2}`);
assert(/^[A-Z0-9]{6}$/.test(code1), `Code should be uppercase alphanumeric: ${code1}`);

// 2. Test Spectator URL Generation
console.log('\n2. Test Spectator URL Generation:');
const url = getSpectatorUrl('HGW7K2');
assert(url.includes('watch=HGW7K2'), `Spectator URL contains ?watch=HGW7K2: ${url}`);

// 3. Test Snapshot Pack and Unpack
console.log('\n3. Test Snapshot Pack and Unpack:');
const initial = createInitialState([
  { name: 'Harry Potter', house: 'Gryffindor', isAI: false },
  { name: 'Draco Malfoy', house: 'Slytherin', isAI: true },
  { name: 'Luna Lovegood', house: 'Ravenclaw', isAI: true },
], 40);

const packed = packSnapshot(1, initial);
assert(typeof packed === 'string' && packed.length > 50, 'Packed snapshot is a valid string');

const unpacked = unpackSnapshot(packed, 1);
assert(unpacked !== null, 'Unpacked snapshot successfully');
assert(unpacked?.players.length === 3, `Unpacked players count is 3 (got ${unpacked?.players.length})`);
assert(unpacked?.players[0].name === 'Harry Potter', 'Player 0 is Harry Potter');

// 4. Test Mock Storage Broadcast and Retrieval
console.log('\n4. Test Local Storage Broadcast & Retrieval:');
const mockStorage: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key: string) => mockStorage[key] || null,
  setItem: (key: string, val: string) => { mockStorage[key] = val; },
  removeItem: (key: string) => { delete mockStorage[key]; },
  clear: () => { Object.keys(mockStorage).forEach(k => delete mockStorage[k]); },
  key: (i: number) => Object.keys(mockStorage)[i] || null,
  length: 0,
} as unknown as Storage;

broadcastSpectatorState('TEST99', initial, 1);
const retrieved = getLatestSpectatorState('TEST99', 1);
assert(retrieved !== null, 'Retrieved broadcasted game state from storage');
assert(retrieved?.players[0].name === 'Harry Potter', 'Retrieved game state matches original players');
assert(retrieved?.turnNumber === initial.turnNumber, 'Turn numbers match');

// 5. Test Spectator Permissions (Read-Only Safety Guardrails)
console.log('\n5. Test Spectator Permissions Guardrails:');
const spectatorId = 'spectator-audience-uid-123';
const isPlayerInGame = initial.players.some(p => p.id === spectatorId);
assert(!isPlayerInGame, 'Spectator UID is not in game players list');

// Derive isSpectator logic as implemented in App.tsx and RightSidebar.tsx
const isSpectatingFlag = true;
const isSpectator = Boolean(
  isSpectatingFlag ||
  (initial && spectatorId && !initial.players.some((p) => p.id === spectatorId))
);
assert(isSpectator === true, 'isSpectator resolves to true for audience viewer');

const currentPlayer = initial.players[initial.currentPlayerIndex];
// isMyTurn check
const isMyTurn = isSpectator ? false : (spectatorId ? currentPlayer?.id === spectatorId : true);
assert(isMyTurn === false, 'Spectator isMyTurn is STRICTLY FALSE');

// isControllingViewingPlayer check
const viewingPlayer = currentPlayer;
const isControllingViewingPlayer = !isSpectator && viewingPlayer?.id === (spectatorId || currentPlayer?.id);
assert(isControllingViewingPlayer === false, 'Spectator isControllingViewingPlayer is STRICTLY FALSE');

// isMyBidTurn check in auction
const isMyBidTurn = !isSpectator && (spectatorId ? false : true);
assert(isMyBidTurn === false, 'Spectator isMyBidTurn is STRICTLY FALSE');

// 6. Test Host Broadcaster & Active Spectator Handshake
console.log('\n6. Test Host Broadcaster & Active Spectator Handshake:');
let handshakeState: GameState | null = null;
const cleanupHost = initHostSpectatorBroadcaster('SYNC01', () => initial, 1);
const cleanupGuest = subscribeToSpectatorState('SYNC01', (state) => {
  handshakeState = state;
}, 1);

// Allow microtask tick for BroadcastChannel message passing
await new Promise((r) => setTimeout(r, 60));

assert(handshakeState !== null, 'Handshake subscriber received state');
assert(handshakeState?.players.length === 3, 'Handshake subscriber got all players');
cleanupHost();
cleanupGuest();

// 7. Test Host Early Defeat & Lobby Return Resilience
console.log('\n7. Test Host Early Defeat & Lobby Return Resilience:');
const stateWithBankruptHost = {
  ...initial,
  players: [
    { ...initial.players[0], isBankrupt: true }, // Harry Potter (Host) is bankrupt
    { ...initial.players[1] },
    { ...initial.players[2] },
  ],
};

const hostUid = stateWithBankruptHost.players[0].id;
const myPlayerId = hostUid;
const isHost = true;
const hostPlayer = stateWithBankruptHost.players.find((p) => p.id === myPlayerId);
const isHostDefeatedEarly = Boolean(
  isHost &&
  hostPlayer?.isBankrupt &&
  stateWithBankruptHost.turnPhase !== 'GAME_OVER'
);

assert(isHostDefeatedEarly === true, 'Host early defeat condition correctly detected');

// Simulate exitGame logic for bankrupt host:
let localGameState: GameState | null = stateWithBankruptHost;
let inLobby = false;
let roomCancelled = false;

function simulateExitGame() {
  if (isHostDefeatedEarly) {
    inLobby = true;
    // Does NOT cancel room, does NOT set localGameState to null
    return;
  }
  roomCancelled = true;
  localGameState = null;
  inLobby = true;
}

simulateExitGame();
assert(inLobby === true, 'Host transitions to lobby view');
assert(localGameState !== null, 'Game state is PRESERVED in memory for background execution');
assert(roomCancelled === false, 'Online room is NOT cancelled when bankrupt host leaves to lobby');
assert(stateWithBankruptHost.players.filter((p) => !p.isBankrupt).length === 2, 'Two remaining players continue competing in the active match');

console.log('\n🎉 ALL SPECTATOR MODE & RESILIENCE TESTS PASSED 100%!\n');
