import { GameState, GameAction, HouseType } from '../core/types';

export type NetworkMessage =
  | {
      type: 'JOIN_REQUEST';
      senderId: string;
      playerName: string;
      house: HouseType;
    }
  | {
      type: 'JOIN_ACCEPTED';
      targetGuestId?: string;
      assignedPlayerId?: string;
      playerId?: string;
      initialGameState: GameState;
    }
  | {
      type: 'JOIN_REJECTED';
      targetGuestId: string;
      reason: string;
    }
  | {
      type: 'SYNC_STATE';
      senderId: string;
      state: GameState;
      timestamp: number;
    }
  | {
      type: 'CLIENT_ACTION';
      senderId: string;
      action: GameAction;
      timestamp: number;
    }
  | {
      type: 'CHAT_MESSAGE';
      senderId: string;
      senderName: string;
      text: string;
      timestamp: number;
    }
  | {
      type: 'PING';
      senderId: string;
      timestamp: number;
    }
  | {
      type: 'CLIENT_HEARTBEAT';
      senderId: string;
      timestamp: number;
    }
  | {
      type: 'HOST_DISCONNECTED';
      disconnectedAt: number;
    }
  | {
      type: 'HOST_RECONNECTED';
      timestamp: number;
    };

export interface ConnectedPeer {
  id: string;
  name: string;
  house: HouseType;
  isHost: boolean;
  joinedAt: number;
}
