// HPVN Game Zone bridge: the signed-in member comes from the parent's identity handoff (never a typed
// name), and every server call goes through the parent page (this sandboxed frame never touches
// Firebase). Outside HPVN (no handoff) the game still plays locally with bots or on one device.
export interface HpvnIdentity { uid: string; displayName: string; house: string; nonce: string; issuedAt: number }
export interface RoomMember { uid: string; name: string; house: string }
export interface RoomView {
  code: string; hostUid: string; memberUids: string[]; members: RoomMember[];
  phase: 'lobby' | 'playing' | 'closed'; epoch: number; playerUids: string[] | null;
  /** Real Galleons per seat (0 = a friendly room) and how the last staked match was settled. */
  stake?: number;
  stakeResult?: { epoch: number; winnerUid?: string; pot?: number; stake: number; held?: boolean; refunded?: boolean } | null;
}
export type RoomEvent =
  | { t: 'room'; room: RoomView | null }
  | { t: 'live'; n: number; s: string }
  | { t: 'inputs'; list: { uid: string; a?: string; n?: number }[] }
  | { t: 'error' } | { t: 'env'; phone: boolean } | { t: 'floo'; open: boolean };

function readIdentity(): HpvnIdentity | null {
  try {
    const params = new URLSearchParams(location.hash.slice(1));
    const data = JSON.parse(params.get('hpvn-handoff') || 'null');
    if (window.parent !== window && new URL(document.referrer).origin === location.origin && data
      && typeof data.uid === 'string' && typeof data.nonce === 'string' && data.nonce === params.get('hpvn-ticket')
      && Math.abs(Date.now() - data.issuedAt) < 10 * 60 * 1000) return data;
  } catch { /* standalone */ }
  return null;
}

export const identity = readIdentity();
if (identity) document.documentElement.classList.add('hpvn-framed');
let flooOpen = false;
/** HPVN reports whether its Floo panel is open over the game (it covers the whole frame on phones). */
export const flooCovers = () => flooOpen && matchMedia('(max-width: 900px)').matches;
const pending = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void; timer: number }>();
const listeners = new Set<(event: RoomEvent) => void>();
const newId = () => crypto.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;

addEventListener('message', (event) => {
  const d = event.data;
  if (!identity || event.source !== window.parent || event.origin !== location.origin || d?.channel !== 'hpvn-game' || d.nonce !== identity.nonce) return;
  if (d.event === 'sb') {
    if (d.t === 'floo') flooOpen = d.open === true;
    listeners.forEach((fn) => fn(d));
    return;
  }
  const wait = pending.get(d.id);
  if (!wait) return;
  clearTimeout(wait.timer); pending.delete(d.id);
  if (d.error) wait.reject(new Error(d.error)); else wait.resolve(d.result);
});

export function request<T = unknown>(action: string, data: object = {}): Promise<T> {
  if (!identity) return Promise.reject(new Error('Cần mở game từ HPVN.'));
  const id = newId();
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(() => { pending.delete(id); reject(new Error('Kết nối HPVN hết thời gian chờ.')); }, 30000);
    pending.set(id, { resolve, reject, timer });
    window.parent.postMessage({ ...data, channel: 'hpvn-game', nonce: identity.nonce, id, action }, location.origin);
  });
}

/** Fire and forget (snapshots, actions): a newer value supersedes a lost one. */
export function post(action: string, data: object = {}) {
  if (identity) window.parent.postMessage({ ...data, channel: 'hpvn-game', nonce: identity.nonce, id: newId(), action }, location.origin);
}

export function onRoomEvent(fn: (event: RoomEvent) => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

export const roomOp = (op: string, data: object = {}) => request<RoomView | null>('sb-room', { op, ...data });

/** Increasing numbers across reloads (snapshot and action order). */
let lastStamp = 0;
export const stamp = () => (lastStamp = Math.max(Date.now(), lastStamp + 1));
