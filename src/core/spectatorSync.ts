import { GameState } from './types';
import { packSnapshot, unpackSnapshot } from '../hpvn/onlineGame';

const CHANNEL_NAME = 'hogwarts_monopoly_spectator_sync';
const STORAGE_PREFIX = 'monopoly_spectate_';
const TTL_MS = 60 * 60 * 1000; // 1 hour TTL for live spectator sessions

export interface SpectatorPayload {
  roomCode: string;
  epoch: number;
  timestamp: number;
  snapshot: string;
}

/**
 * Generate a friendly 6-character match code for local or custom sessions
 * (e.g. HGW7K2, PFR9X4)
 */
export function generateMatchCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid ambiguous 0, O, 1, I
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

/**
 * Broadcast current game state to all listeners (cross-tab via BroadcastChannel & localStorage)
 */
export function broadcastSpectatorState(roomCode: string, state: GameState, epoch: number = 1): void {
  if (!roomCode || !state) return;
  const upperCode = roomCode.trim().toUpperCase();
  const packed = packSnapshot(epoch, state);
  const payload: SpectatorPayload = {
    roomCode: upperCode,
    epoch,
    timestamp: Date.now(),
    snapshot: packed,
  };

  // 1. BroadcastChannel (0ms real-time event stream across tabs/windows)
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      const channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage({ type: 'LIVE_UPDATE', ...payload });
      channel.close();
    }
  } catch {
    // Graceful fallback if BroadcastChannel is blocked
  }

  // 2. localStorage for immediate catch-up when spectator opens mid-game
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(`${STORAGE_PREFIX}${upperCode}`, JSON.stringify(payload));
    }
  } catch {
    // Quota or incognito block fallback
  }
}

/**
 * Retrieve the latest cached snapshot for a given match code
 */
export function getLatestSpectatorState(roomCode: string, epoch: number = 1): GameState | null {
  if (!roomCode) return null;
  const upperCode = roomCode.trim().toUpperCase();
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(`${STORAGE_PREFIX}${upperCode}`);
    if (!raw) return null;
    const data: SpectatorPayload = JSON.parse(raw);
    if (!data || Date.now() - data.timestamp > TTL_MS) {
      localStorage.removeItem(`${STORAGE_PREFIX}${upperCode}`);
      return null;
    }
    return unpackSnapshot(data.snapshot, epoch || data.epoch);
  } catch {
    return null;
  }
}

/**
 * Subscribe to live game state updates for a specific match code
 */
export function subscribeToSpectatorState(
  roomCode: string,
  onUpdate: (state: GameState) => void,
  epoch: number = 1
): () => void {
  const upperCode = roomCode.trim().toUpperCase();
  let channel: BroadcastChannel | null = null;

  const handlePayload = (payload: SpectatorPayload) => {
    if (!payload || payload.roomCode !== upperCode) return;
    const state = unpackSnapshot(payload.snapshot, epoch || payload.epoch);
    if (state) {
      onUpdate(state);
    }
  };

  // 1. Setup BroadcastChannel listener
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      channel = new BroadcastChannel(CHANNEL_NAME);
      channel.onmessage = (event) => {
        if (event.data?.type === 'LIVE_UPDATE') {
          handlePayload(event.data);
        }
      };
    }
  } catch {
    // Fallback
  }

  // 2. Setup Storage Event listener (triggers on other tabs/windows)
  const storageHandler = (e: StorageEvent) => {
    if (e.key === `${STORAGE_PREFIX}${upperCode}` && e.newValue) {
      try {
        const payload: SpectatorPayload = JSON.parse(e.newValue);
        handlePayload(payload);
      } catch {
        // Malformed
      }
    }
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  // Cleanup function
  return () => {
    if (channel) {
      channel.close();
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', storageHandler);
    }
  };
}

/**
 * Build shareable spectator URL with ?watch=CODE parameter
 */
export function getSpectatorUrl(roomCode: string): string {
  if (typeof window === 'undefined') return `?watch=${roomCode.toUpperCase()}`;
  const url = new URL(window.location.href);
  url.searchParams.delete('room'); // remove direct player invite
  url.searchParams.set('watch', roomCode.toUpperCase());
  return url.toString();
}

/**
 * Clear cached spectator snapshot
 */
export function cleanupSpectatorState(roomCode: string): void {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.removeItem(`${STORAGE_PREFIX}${roomCode.trim().toUpperCase()}`);
    }
  } catch {
    // Ignore
  }
}
