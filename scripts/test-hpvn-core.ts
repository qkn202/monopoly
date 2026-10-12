// HPVN core invariants for Cờ Tỷ Phú Hogwarts (run by `npm run test:hpvn` before every sync build).
// If one fails after an upstream update, fix the patch; do not relax the test.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { authorizeAction } from '../src/core/actionAuth';
import { HOGWARTS_TILES } from '../src/core/boardData';
import { createInitialState, gameReducer } from '../src/core/gameReducer';
import { GameState } from '../src/core/types';
import { packSnapshot, seatPlayers, unpackSnapshot } from '../src/hpvn/onlineGame';

const root = path.resolve(import.meta.dirname, '..');
const files = (dir: string): string[] => readdirSync(dir).flatMap((name) => {
  const full = path.join(dir, name);
  return statSync(full).isDirectory() ? files(full) : [full];
});
const source = files(path.join(root, 'src')).filter((f) => /\.(tsx?|css)$/.test(f)).map((f) => readFileSync(f, 'utf8')).join('\n');

// 1. HPVN owns the network: no third-party realtime backend or peer library, no outside URLs.
const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
for (const dep of ['@supabase/supabase-js', 'peerjs']) assert.equal(pkg.dependencies[dep], undefined, `${dep} must not ship`);
assert.doesNotMatch(source, /supabase|peerjs|https?:\/\/(?!www\.w3\.org)/i, 'no third-party backend or outside URL in the game');

// 2. Identity is the HPVN handoff, checked against the parent, origin and nonce; the online lobby has no typed name.
const bridge = readFileSync(path.join(root, 'src/hpvn/bridge.ts'), 'utf8');
assert.match(bridge, /window\.parent !== window && new URL\(document\.referrer\)\.origin === location\.origin/);
assert.match(bridge, /data\.nonce === params\.get\('hpvn-ticket'\)/);
assert.match(readFileSync(path.join(root, 'src/ui/Lobby.tsx'), 'utf8'), /\{!identity && \(\s*<label className="hpvn-field">\s*<span className="lobby-label">Tên phù thủy/);

// 3. The host applies a seat's action only as that seat, on its turn, on its own property.
const two = createInitialState([
  { id: 'uid-a', name: 'A', house: 'Gryffindor', isAI: false },
  { id: 'uid-b', name: 'B', house: 'Slytherin', isAI: false },
]);
const tile = HOGWARTS_TILES[1];
const owned: GameState = {
  ...two,
  propertyOwnership: { [tile.id]: 'uid-b' },
  players: [two.players[0], { ...two.players[1], properties: [tile.id], houses: { [tile.id]: 2 } }],
};
assert.deepEqual(authorizeAction(two, { type: 'ROLL_DICE' }, 'uid-a'), { type: 'ROLL_DICE' });
assert.equal(authorizeAction(two, { type: 'ROLL_DICE' }, 'uid-b'), null, 'not your turn');
assert.equal(authorizeAction(two, { type: 'ROLL_DICE' }, 'stranger'), null, 'no seat');
for (const type of ['TIMER_TICK', 'AUCTION_TICK', 'TURN_TIMEOUT', 'TOGGLE_TURBO', 'SET_TURBO', 'START_GAME', 'PROPOSE_TRADE']) {
  assert.equal(authorizeAction(two, { type }, 'uid-a'), null, `${type} belongs to the host runtime`);
}
assert.equal(authorizeAction(owned, { type: 'SELL_HOUSE', propertyId: tile.id, playerId: 'uid-b' }, 'uid-a'), null, 'cannot sell for someone else');
assert.deepEqual(authorizeAction(owned, { type: 'SELL_HOUSE', propertyId: tile.id }, 'uid-b'), { type: 'SELL_HOUSE', propertyId: tile.id, playerId: 'uid-b' });
assert.equal(authorizeAction(owned, { type: 'MORTGAGE_PROPERTY', propertyId: tile.id }, 'uid-a'), null);
assert.deepEqual(authorizeAction(two, { type: 'DISMISS_ESCALATION' }, 'uid-b'), { type: 'DISMISS_ESCALATION' });
const auction: GameState = { ...two, turnPhase: 'AUCTION', auction: { active: true, propertyId: tile.id, currentBid: 10, highBidderId: null, activeBidders: ['uid-a', 'uid-b'], currentBidderIndex: 1, timerSeconds: 6 } };
assert.deepEqual(authorizeAction(auction, { type: 'PLACE_BID', playerId: 'uid-a', amount: 20 }, 'uid-b'), { type: 'PLACE_BID', playerId: 'uid-b', amount: 20 });
assert.equal(authorizeAction(auction, { type: 'PLACE_BID', amount: 20 }, 'uid-a'), null, 'not your bid');
assert.equal(authorizeAction(auction, { type: 'PLACE_BID', amount: 5 }, 'uid-b'), null, 'bid must rise');

// 4. The reducer itself never acts on a tile for someone who does not own it.
const sold = gameReducer(owned, { type: 'SELL_HOUSE', propertyId: tile.id });
assert.equal(sold.players[1].houses[tile.id], 2, 'current player cannot sell the owner\'s cottages');
assert.equal(gameReducer(owned, { type: 'MORTGAGE_PROPERTY', propertyId: tile.id }).mortgagedProperties[tile.id], undefined);
assert.equal(gameReducer(owned, { type: 'SELL_HOUSE', propertyId: tile.id, playerId: 'uid-b' }).players[1].houses[tile.id], 1);

// 5. Online seats: player id = HPVN uid, the HPVN house when free, bots fill up to eight seats.
const seated = seatPlayers(
  [{ uid: 'u1', name: 'Một', house: 'ravenclaw' }, { uid: 'u2', name: 'Hai', house: 'ravenclaw' }],
  ['u1', 'u2'], 10);
assert.deepEqual(seated.players.slice(0, 2).map((p) => [p.id, p.name, p.isAI]), [['u1', 'Một', false], ['u2', 'Hai', false]]);
assert.equal(seated.players[0].house, 'Ravenclaw');
assert.notEqual(seated.players[1].house, 'Ravenclaw', 'one token per house');
assert.equal(seated.players.length, 8);
assert.equal(new Set(seated.players.map((p) => p.house)).size, 8);

// 6. A snapshot belongs to one game (room epoch); an old one is ignored.
assert.equal(unpackSnapshot(packSnapshot(2, two), 3), null);
assert.equal(unpackSnapshot(packSnapshot(3, two), 3)?.players.length, 2);
assert.equal(unpackSnapshot('not json', 3), null);

// 7. Light assets: WebP card art ≤ 150 KB, no JPEG/PNG referenced by the game.
assert.doesNotMatch(source, /\.(jpe?g|png)\b/i);
for (const file of files(path.join(root, 'public'))) {
  assert.doesNotMatch(file, /\.(jpe?g|png|glb|html)$/i, `${path.relative(root, file)} must not ship`);
  if (file.endsWith('.webp')) assert.ok(statSync(file).size <= 150 * 1024, `${path.relative(root, file)} ≤ 150 KB`);
}

console.log('HPVN core: network, identity, seat authorization, ownership, seating, snapshots and assets hold.');

// 9. A full local game (8 seats, every tile owned, 60 log lines) fits the parent's session-hint budget
// (src/hpvn/saveGame.ts: 4 chunks of 7800 characters).
{
  const houses = ['Gryffindor', 'Slytherin', 'Ravenclaw', 'Hufflepuff', 'Auror', 'DeathEater', 'OrderOfPhoenix', 'Ministry'] as const;
  const big = createInitialState(houses.map((house, i) => ({ name: `Phù thủy số ${i + 1} rất dài tên`, house, isAI: i > 0 })));
  const owned = HOGWARTS_TILES.filter((t) => t.price);
  owned.forEach((t, i) => { big.propertyOwnership[t.id] = big.players[i % 8].id; big.players[i % 8].properties.push(t.id); });
  big.events = Array.from({ length: 60 }, (_, i) => ({ ...big.events[0], id: `e${i}`, message: `Phù thủy số ${i % 8} dừng chân tại đất của một người khác và đã trả 1.200 Galleons tiền thuê đất!` }));
  const size = JSON.stringify({ v: 1, savedAt: 0, lastActionAt: 0, myPlayerId: big.players[0].id, state: big }).length;
  assert.ok(size < 4 * 7800, `local save is ${size} characters`);
  console.log(`Local save of a full 8-seat game: ${size} characters (budget ${4 * 7800}).`);
}

// 10. Upstream 7099e39's bankruptcy phase runs as upstream wrote it (owner's choice, 2026-10-11; known
// upstream issue: its rent/tax callers overwrite the phase, so the debt can lapse). HPVN core still holds:
// only the debtor may declare bankruptcy, and a snapshot from before `visitedProperties` still loads.
{
  const s = createInitialState([{ name: 'A', house: 'Gryffindor', isAI: false }, { name: 'B', house: 'Slytherin', isAI: false }]);
  const [a, b] = s.players;
  const owing: GameState = { ...s, turnPhase: 'BANKRUPTCY', bankruptcyInfo: { debtorId: a.id, creditorId: b.id, amount: 100, reason: 'thử' } };
  assert.equal(authorizeAction(owing, { type: 'DECLARE_BANKRUPTCY' }, b.id), null, 'only the debtor may give up');
  assert.deepEqual(authorizeAction(owing, { type: 'DECLARE_BANKRUPTCY' }, a.id), { type: 'DECLARE_BANKRUPTCY' });
  assert.equal(authorizeAction({ ...owing, turnPhase: 'ROLL' }, { type: 'DECLARE_BANKRUPTCY' }, a.id), null);

  const old = JSON.parse(packSnapshot(3, s));
  for (const p of old.state.players) delete p.visitedProperties;
  assert.ok(unpackSnapshot(JSON.stringify(old), 3)!.players.every((p) => Array.isArray(p.visitedProperties)));
  console.log('Bankruptcy: debtor-only declare; old snapshots load.');
}
