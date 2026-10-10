import { RealtimeChannel } from '@supabase/supabase-js';
import { GameState, GameAction, HouseType } from '../core/types';
import { NetworkMessage } from './networkProtocol';
import { createSupabaseClient } from './supabaseClient';

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let result = '';
  for (let i = 0; i < 4; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

export interface GuestSender {
  id: string;
  send: (msg: NetworkMessage) => void;
}

export interface HostSession {
  roomCode: string;
  hostPeerId: string;
  channel: RealtimeChannel;
  broadcastState: (state: GameState) => void;
  destroy: () => void;
}

export interface GuestSession {
  roomCode: string;
  guestPeerId: string;
  channel: RealtimeChannel;
  sendAction: (action: GameAction) => void;
  destroy: () => void;
}

/**
 * Start Host Session using Supabase Realtime Channel
 */
export function startHostSession(
  roomCode: string,
  onGuestJoin: (guestSender: GuestSender, data: { playerName: string; house: HouseType }) => void,
  onClientAction: (action: GameAction, senderId: string) => void,
  onGuestLeave: (guestSender: GuestSender) => void
): Promise<HostSession> {
  return new Promise((resolve, reject) => {
    const formattedCode = roomCode.trim().toUpperCase();
    const channelName = `hp-monopoly-${formattedCode.toLowerCase()}`;
    const supabase = createSupabaseClient();
    const hostPeerId = `host_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[Host] Initializing Supabase channel: ${channelName} (Host ID: ${hostPeerId})`);

    // Track guest sender ID to assigned player ID mapping for security
    const guestToPlayerMap: Record<string, string> = {};

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: hostPeerId },
        broadcast: { self: false },
      },
    });

    let isSettled = false;
    let heartbeatTimer: any = null;

    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        supabase.removeChannel(channel);
        reject(new Error(`Timeout connecting to Supabase room ${formattedCode}`));
      }
    }, 15000);

    // Listen for broadcast messages from clients
    channel.on('broadcast', { event: 'game_message' }, (eventPayload: any) => {
      const msg = eventPayload?.payload as NetworkMessage;
      if (!msg) return;

      if (msg.type === 'JOIN_REQUEST') {
        console.log(`[Host] Incoming JOIN_REQUEST from guest: ${msg.playerName} (${msg.senderId})`);
        const guestSender: GuestSender = {
          id: msg.senderId,
          send: (replyMsg: any) => {
            channel.send({
              type: 'broadcast',
              event: 'game_message',
              payload: {
                ...replyMsg,
                targetGuestId: replyMsg.targetGuestId || msg.senderId,
                assignedPlayerId: replyMsg.assignedPlayerId || replyMsg.playerId,
              },
            });
          },
        };
        onGuestJoin(guestSender, { playerName: msg.playerName, house: msg.house });
      } else if (msg.type === 'CLIENT_ACTION') {
        // Security: Verify the action belongs to the player assigned to this sender
        const assignedPlayerId = guestToPlayerMap[msg.senderId];
        if (assignedPlayerId) {
          // Wrap action with verified player ID for host to validate
          const secureAction = {
            ...msg.action,
            _verifiedPlayerId: assignedPlayerId,
            _senderId: msg.senderId,
          };
          onClientAction(secureAction as GameAction, msg.senderId);
        } else {
          console.warn(`[Host] CLIENT_ACTION from unknown sender: ${msg.senderId} - ignored`);
        }
      } else if (msg.type === 'CLIENT_HEARTBEAT') {
        // Keep-alive from client received
      }
    });

    // Track presence to detect when guests leave
    channel.on('presence', { event: 'leave' }, (payload: any) => {
      const leftKey = payload?.key;
      if (leftKey && leftKey !== hostPeerId) {
        console.log(`[Host] Presence: Guest ${leftKey} left.`);
        const guestSender: GuestSender = {
          id: leftKey,
          send: () => {},
        };
        onGuestLeave(guestSender);
      }
    });

    channel.subscribe(async (status) => {
      console.log(`[Host] Supabase channel status: ${status}`);

      if (status === 'SUBSCRIBED') {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);

          // Track Host presence
          await channel.track({
            id: hostPeerId,
            isHost: true,
            onlineAt: Date.now(),
          });

          // Start 10s keepalive ping
          heartbeatTimer = setInterval(() => {
            channel.send({
              type: 'broadcast',
              event: 'game_message',
              payload: {
                type: 'PING',
                senderId: hostPeerId,
                timestamp: Date.now(),
              },
            });
          }, 10000);

          resolve({
            roomCode: formattedCode,
            hostPeerId,
            channel,
            broadcastState: (state: GameState) => {
              channel.send({
                type: 'broadcast',
                event: 'game_message',
                payload: {
                  type: 'SYNC_STATE',
                  senderId: hostPeerId,
                  state,
                  timestamp: Date.now(),
                },
              });
            },
            destroy: () => {
              console.log(`[Host] Closing room ${formattedCode}`);
              if (heartbeatTimer) clearInterval(heartbeatTimer);
              channel.send({
                type: 'broadcast',
                event: 'game_message',
                payload: {
                  type: 'HOST_DISCONNECTED',
                  disconnectedAt: Date.now(),
                },
              });
              channel.untrack();
              supabase.removeChannel(channel);
            },
          });
        }
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);
          supabase.removeChannel(channel);
          reject(new Error(`Failed to subscribe to room (Supabase status: ${status})`));
        }
      }
    });
  });
}

/**
 * Start Guest Session using Supabase Realtime Channel
 */
export function startGuestSession(
  roomCode: string,
  playerName: string,
  house: HouseType,
  onStateSync: (state: GameState) => void,
  onJoinAccepted: (playerId: string, initialState: GameState) => void,
  onDisconnect: () => void
): Promise<GuestSession> {
  return new Promise((resolve, reject) => {
    const formattedCode = roomCode.trim().toUpperCase();
    const channelName = `hp-monopoly-${formattedCode.toLowerCase()}`;
    const supabase = createSupabaseClient();
    const guestPeerId = `guest_${Math.random().toString(36).substring(2, 9)}`;

    console.log(`[Guest] Connecting to Supabase room: ${channelName} (Guest ID: ${guestPeerId})`);

    const channel = supabase.channel(channelName, {
      config: {
        presence: { key: guestPeerId },
        broadcast: { self: false },
      },
    });

    let isSettled = false;
    let joinAccepted = false;
    let joinRetryInterval: any = null;
    let heartbeatTimer: any = null;
    let hostGraceTimer: any = null;

    const timeoutTimer = setTimeout(() => {
      if (!isSettled) {
        isSettled = true;
        if (joinRetryInterval) clearInterval(joinRetryInterval);
        supabase.removeChannel(channel);
        reject(new Error(`Không thể kết nối tới phòng "${formattedCode}". Vui lòng kiểm tra mã phòng!`));
      }
    }, 15000);

    const sendJoinRequest = () => {
      channel.send({
        type: 'broadcast',
        event: 'game_message',
        payload: {
          type: 'JOIN_REQUEST',
          senderId: guestPeerId,
          playerName,
          house,
        },
      });
    };

    // Listen for broadcast messages from Host
    channel.on('broadcast', { event: 'game_message' }, (eventPayload: any) => {
      const msg = eventPayload?.payload as NetworkMessage;
      if (!msg) return;

      if (msg.type === 'JOIN_ACCEPTED') {
        const isForMe = !msg.targetGuestId || msg.targetGuestId === guestPeerId;
        if (isForMe) {
          const assignedId = (msg.assignedPlayerId || msg.playerId || guestPeerId) as string;
          console.log(`[Guest] JOIN_ACCEPTED! Assigned Player ID: ${assignedId}`);
          joinAccepted = true;
          if (joinRetryInterval) {
            clearInterval(joinRetryInterval);
            joinRetryInterval = null;
          }

          if (!isSettled) {
            isSettled = true;
            clearTimeout(timeoutTimer);

            onJoinAccepted(assignedId, msg.initialGameState);

            // Apply any pending SYNC_STATE that arrived before JOIN_ACCEPTED
            const pendingState = (window as any).__pendingSyncState;
            if (pendingState) {
              console.log('[Guest] Applying pending SYNC_STATE that arrived before JOIN_ACCEPTED');
              onStateSync(pendingState);
              delete (window as any).__pendingSyncState;
            }

            // Start client heartbeat to keep WebSocket open across NAT
            heartbeatTimer = setInterval(() => {
              channel.send({
                type: 'broadcast',
                event: 'game_message',
                payload: {
                  type: 'CLIENT_HEARTBEAT',
                  senderId: guestPeerId,
                  timestamp: Date.now(),
                },
              });
            }, 12000);

          resolve({
            roomCode: formattedCode,
            guestPeerId,
            channel,
            sendAction: (action: GameAction) => {
              channel.send({
                type: 'broadcast',
                event: 'game_message',
                payload: {
                  type: 'CLIENT_ACTION',
                  senderId: guestPeerId,
                  action,
                  timestamp: Date.now(),
                },
              });
            },
            destroy: () => {
              console.log(`[Guest] Leaving room ${formattedCode}`);
              if (joinRetryInterval) clearInterval(joinRetryInterval);
              if (heartbeatTimer) clearInterval(heartbeatTimer);
              if (hostGraceTimer) clearTimeout(hostGraceTimer);
              channel.untrack();
              supabase.removeChannel(channel);
            },
          });
        }
      }
    } else if (msg.type === 'SYNC_STATE') {
      // SYNC_STATE can come before JOIN_ACCEPTED - store it and apply when joined
      if (joinAccepted) {
        onStateSync(msg.state);
      }
      // Store latest SYNC_STATE in case it arrives before JOIN_ACCEPTED
      if (!joinAccepted && msg.state) {
        // Queue the state to be applied after JOIN_ACCEPTED
        const pendingState = msg.state;
        // We need to apply this after JOIN_ACCEPTED is received
        // Use a flag to track pending state
        (window as any).__pendingSyncState = pendingState;
      }
    } else if (msg.type === 'HOST_DISCONNECTED') {
      console.warn('[Guest] Host has disconnected.');
      onDisconnect();
    }
  });

    // Detect Host presence leave with 25s mobile grace period
    channel.on('presence', { event: 'leave' }, (payload: any) => {
      const leftPresences = payload?.leftPresences;
      const hostLeft = Array.isArray(leftPresences) && leftPresences.some((p: any) => p?.isHost);
      if (hostLeft) {
        console.warn('[Guest] Host left presence. Starting 25s grace period...');
        if (!hostGraceTimer) {
          hostGraceTimer = setTimeout(() => {
            console.error('[Guest] Host did not return. Disconnecting...');
            onDisconnect();
          }, 25000);
        }
      }
    });

    channel.on('presence', { event: 'sync' }, () => {
      // If host is present, cancel grace timer
      const state = channel.presenceState();
      let hostFound = false;
      for (const k in state) {
        const presences = state[k] as any[];
        if (presences?.some((p) => p.isHost)) {
          hostFound = true;
          break;
        }
      }
      if (hostFound && hostGraceTimer) {
        console.log('[Guest] Host detected back online.');
        clearTimeout(hostGraceTimer);
        hostGraceTimer = null;
      }
    });

    channel.subscribe(async (status) => {
      console.log(`[Guest] Supabase channel status: ${status}`);

      if (status === 'SUBSCRIBED') {
        // Track guest presence
        await channel.track({
          id: guestPeerId,
          name: playerName,
          house,
          isHost: false,
          onlineAt: Date.now(),
        });

        // Send JOIN_REQUEST and repeat every 2.5s until accepted
        sendJoinRequest();
        joinRetryInterval = setInterval(() => {
          if (!joinAccepted) {
            console.log('[Guest] Resending JOIN_REQUEST...');
            sendJoinRequest();
          } else {
            clearInterval(joinRetryInterval);
          }
        }, 2500);
      } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
        if (!isSettled) {
          isSettled = true;
          clearTimeout(timeoutTimer);
          if (joinRetryInterval) clearInterval(joinRetryInterval);
          supabase.removeChannel(channel);
          reject(new Error(`Lỗi kết nối máy chủ Supabase (${status})`));
        }
      }
    });
  });
}
