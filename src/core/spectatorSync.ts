import { GameState } from './types';
import { packSnapshot, unpackSnapshot } from '../hpvn/onlineGame';
import { withVisitList } from './reducerHelpers';

const CHANNEL_NAME = 'hogwarts_monopoly_spectator_sync';
const STORAGE_PREFIX = 'monopoly_spectate_';
const TTL_MS = 60 * 60 * 1000; // 1 hour TTL for live spectator sessions

export interface SpectatorPayload {
  roomCode: string;
  epoch: number;
  timestamp: number;
  snapshot: string;
}

export interface SpectatorMessage {
  type: 'LIVE_UPDATE' | 'REQUEST_SYNC' | 'SYNC_REPLY' | 'HEARTBEAT';
  roomCode: string;
  epoch?: number;
  timestamp?: number;
  snapshot?: string;
}

let sharedSenderChannel: BroadcastChannel | null = null;

function getSenderChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!sharedSenderChannel) {
    try {
      sharedSenderChannel = new BroadcastChannel(CHANNEL_NAME);
      (sharedSenderChannel as any).unref?.();
    } catch {
      return null;
    }
  }
  return sharedSenderChannel;
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
 * Unpack snapshot with flexible epoch support
 */
export function unpackSpectatorSnapshot(snapshotStr: string, epoch?: number): GameState | null {
  if (!snapshotStr) return null;
  try {
    const data = JSON.parse(snapshotStr);
    const targetEpoch = epoch ?? data?.e ?? 1;
    if (data?.e === targetEpoch && Array.isArray(data.state?.players)) {
      return withVisitList(data.state);
    }
    // Fallback if epoch differs but state structure is valid
    if (Array.isArray(data?.state?.players)) {
      return withVisitList(data.state);
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Broadcast current game state to all listeners:
 * 1. Persistent BroadcastChannel (cross-tab)
 * 2. localStorage (cross-tab / reload)
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

  // 1. BroadcastChannel (persistent sender channel)
  try {
    const channel = getSenderChannel();
    if (channel) {
      channel.postMessage({ type: 'LIVE_UPDATE', ...payload });
    }
  } catch {
    // Ignore fallback
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
    return unpackSpectatorSnapshot(data.snapshot, epoch || data.epoch);
  } catch {
    return null;
  }
}

/**
 * Host Broadcaster Service:
 * - Dedicated BroadcastChannel listener responding immediately to cross-tab REQUEST_SYNC messages
 * - Heartbeat pulse every 2000ms so newly opened spectator tabs catch up instantly
 */
export function initHostSpectatorBroadcaster(
  roomCode: string,
  getState: () => GameState | null,
  epoch: number = 1
): () => void {
  const upperCode = roomCode.trim().toUpperCase();
  let destroyed = false;
  let hostChannel: BroadcastChannel | null = null;

  // 1. Dedicated host listener channel for incoming spectator requests
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      hostChannel = new BroadcastChannel(CHANNEL_NAME);
      (hostChannel as any).unref?.();
      hostChannel.onmessage = (event: MessageEvent) => {
        if (destroyed) return;
        const data = event.data;
        if (data?.type === 'REQUEST_SYNC' && data.roomCode === upperCode) {
          const current = getState();
          if (current) {
            broadcastSpectatorState(upperCode, current, epoch);
          }
        }
      };
    }
  } catch {}

  // 2. Heartbeat pulse every 2000ms
  const heartbeatTimer = setInterval(() => {
    if (destroyed) return;
    const current = getState();
    if (current) {
      broadcastSpectatorState(upperCode, current, epoch);
    }
  }, 2000);

  return () => {
    destroyed = true;
    clearInterval(heartbeatTimer);
    if (hostChannel) {
      try {
        hostChannel.close();
      } catch {}
      hostChannel = null;
    }
  };
}

/**
 * Subscribe to live game state updates for a specific match code
 */
export function subscribeToSpectatorState(
  roomCode: string,
  onUpdate: (state: GameState) => void,
  epoch: number = 1,
  onStatusChange?: (status: string) => void
): () => void {
  const upperCode = roomCode.trim().toUpperCase();
  let destroyed = false;
  let receivedAny = false;
  let spectatorChannel: BroadcastChannel | null = null;

  const handlePayload = (payload: SpectatorPayload | SpectatorMessage) => {
    if (destroyed || !payload || payload.roomCode !== upperCode) return;
    if (!payload.snapshot) return;
    const state = unpackSpectatorSnapshot(payload.snapshot, epoch || payload.epoch);
    if (state) {
      receivedAny = true;
      onStatusChange?.('Đã kết nối trực tiếp · Đang cập nhật lượt đấu');
      onUpdate(state);
    }
  };

  // 1. Immediate cache check
  const cached = getLatestSpectatorState(upperCode, epoch);
  if (cached) {
    receivedAny = true;
    onStatusChange?.('Đã tải trạng thái bàn cờ');
    onUpdate(cached);
  }

  // 2. Dedicated spectator BroadcastChannel listener
  try {
    if (typeof BroadcastChannel !== 'undefined') {
      spectatorChannel = new BroadcastChannel(CHANNEL_NAME);
      (spectatorChannel as any).unref?.();
      spectatorChannel.onmessage = (event: MessageEvent) => {
        if (destroyed) return;
        const data = event.data;
        if (data?.type === 'LIVE_UPDATE' || data?.type === 'SYNC_REPLY') {
          handlePayload(data);
        }
      };
      // Actively ask any host in another tab for latest snapshot
      spectatorChannel.postMessage({ type: 'REQUEST_SYNC', roomCode: upperCode });
    }
  } catch {}

  // 3. Storage Event listener
  const storageHandler = (e: StorageEvent) => {
    if (e.key === `${STORAGE_PREFIX}${upperCode}` && e.newValue) {
      try {
        const payload: SpectatorPayload = JSON.parse(e.newValue);
        handlePayload(payload);
      } catch {}
    }
  };

  if (typeof window !== 'undefined') {
    window.addEventListener('storage', storageHandler);
  }

  // 4. Active Poll & Ping Interval (every 800ms until state received, then every 3000ms)
  const pollTimer = setInterval(() => {
    if (destroyed) return;

    // Check localStorage in case storage event was suppressed or cross-window timing
    if (!receivedAny) {
      const pollCache = getLatestSpectatorState(upperCode, epoch);
      if (pollCache) {
        handlePayload({
          roomCode: upperCode,
          epoch,
          timestamp: Date.now(),
          snapshot: packSnapshot(epoch, pollCache),
        });
      }
    }

    // Ping BroadcastChannel to ask Host for state
    if (spectatorChannel) {
      try {
        spectatorChannel.postMessage({ type: 'REQUEST_SYNC', roomCode: upperCode });
      } catch {}
    }
  }, 800);

  // Cleanup function
  return () => {
    destroyed = true;
    clearInterval(pollTimer);
    if (spectatorChannel) {
      try {
        spectatorChannel.close();
      } catch {}
      spectatorChannel = null;
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
