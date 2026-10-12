// A local game (bots / one device) is parked in HPVN's per-member session hints so a reload, a trip
// elsewhere on HPVN, or "Thoát" can come back to it. The frame has no storage of its own: hints go
// through the parent (a few 8 KB chunks, this browser tab only) and arrive again with the next ticket.
// Online rooms do not use this: the host's snapshot ring already brings a table back.
import type { GameState } from '../core/types';
import { identity, post } from './bridge';
import { withVisitList } from '../core/reducerHelpers';

const PREFIX = 'monopoly-save';
export const SAVE_CHUNKS = 4;
const CHUNK = 7800;
/** A game ends this long after the player's last action (open or parked); the match clock stops while parked. */
export const SAVE_TTL_MS = 30 * 60 * 1000;
const LOG_KEPT = 60;

export interface SavedGame { v: 1; savedAt: number; lastActionAt: number; myPlayerId?: string; state: GameState }

const hints = (): Record<string, string> =>
  ((identity as unknown as { session?: Record<string, string> } | null)?.session) ?? {};

let lastWritten: string[] = [];

function chunksOf(text: string) {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += CHUNK) out.push(text.slice(i, i + CHUNK));
  return out;
}

export function writeSave(state: GameState, lastActionAt: number, myPlayerId?: string, now = Date.now()): boolean {
  if (!identity) return false;
  // The log is kept (newest first) but trimmed until the game fits the hint budget.
  for (const kept of [LOG_KEPT, 30, 10, 0]) {
    const saved: SavedGame = { v: 1, savedAt: now, lastActionAt, myPlayerId, state: { ...state, events: state.events.slice(0, kept) } };
    const parts = chunksOf(JSON.stringify(saved));
    if (parts.length > SAVE_CHUNKS) continue;
    for (let i = 0; i < SAVE_CHUNKS; i++) {
      if (parts[i] !== lastWritten[i]) post('session', { key: `${PREFIX}-${i}`, value: parts[i] ?? null });
    }
    lastWritten = parts;
    return true;
  }
  return false;
}

export function clearSave() {
  if (!identity) return;
  for (let i = 0; i < SAVE_CHUNKS; i++) post('session', { key: `${PREFIX}-${i}`, value: null });
  lastWritten = [];
}

/** The parked game, if it is still fresh and unfinished; an expired or broken one is cleared. */
export function loadSave(now = Date.now()): SavedGame | null {
  const all = hints();
  let text = '';
  for (let i = 0; i < SAVE_CHUNKS; i++) {
    const part = all[`${PREFIX}-${i}`];
    if (!part) break;
    text += part;
  }
  if (!text) return null;
  try {
    const saved = JSON.parse(text) as SavedGame;
    const ok = saved?.v === 1 && Number.isFinite(saved.savedAt) && Array.isArray(saved.state?.players)
      && saved.state.players.length > 0 && saved.state.turnPhase !== 'GAME_OVER'
      && Number.isFinite(saved.lastActionAt) && now - saved.lastActionAt < SAVE_TTL_MS;
    if (ok) return saved;
  } catch { /* broken hint */ }
  clearSave();
  return null;
}

/** A resumed game starts its turn clock afresh; the match clock continues from where it stopped. */
export function resumeState(saved: SavedGame): GameState {
  return { ...withVisitList(saved.state), turnSecondsRemaining: saved.state.maxTurnSeconds || 60 };
}
