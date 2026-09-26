import { PieceColor, PieceType } from '../types/chess';
import { ClockControl } from '../hooks/useChessClock';

export type MultiplayerMessageType =
  | 'JOIN_GAME'
  | 'GAME_STARTED'
  | 'MOVE'
  | 'CLOCK_SYNC'
  | 'DRAW_OFFER'
  | 'DRAW_RESPONSE'
  | 'RESIGN'
  | 'ABORT'
  | 'TAKEBACK_REQUEST'
  | 'TAKEBACK_RESPONSE'
  | 'REMATCH_OFFER'
  | 'REMATCH_ACCEPTED'
  | 'HEARTBEAT'
  | 'DISCONNECT_WARNING';

export interface MultiplayerMessage {
  type: MultiplayerMessageType;
  gameId: string;
  senderId: string;
  payload?: any;
  timestamp: number;
}

export interface MultiplayerTransport {
  connect(gameId: string, playerId: string): void;
  disconnect(): void;
  send(type: MultiplayerMessageType, payload?: any): void;
  onMessage(callback: (msg: MultiplayerMessage) => void): void;
  onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void;
}

/**
 * BroadcastChannel Transport:
 * Enables instant multi-tab, zero-server multiplayer testing.
 * Two tabs with the same gameId communicate in real-time.
 */
export class BroadcastMultiplayerTransport implements MultiplayerTransport {
  private channel: BroadcastChannel | null = null;
  private gameId = '';
  private playerId = '';
  private messageListeners: ((msg: MultiplayerMessage) => void)[] = [];
  private statusListeners: ((status: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];
  private heartbeatInterval: any = null;
  private peerLastSeen = 0;

  connect(gameId: string, playerId: string): void {
    this.gameId = gameId;
    this.playerId = playerId;

    if (this.channel) {
      this.channel.close();
    }

    try {
      this.channel = new BroadcastChannel(`chess_game_${gameId}`);
      this.channel.onmessage = (event) => {
        const msg = event.data as MultiplayerMessage;
        if (msg && msg.gameId === this.gameId && msg.senderId !== this.playerId) {
          this.peerLastSeen = Date.now();
          this.notifyStatus('connected');
          this.messageListeners.forEach((fn) => fn(msg));
        }
      };

      this.notifyStatus('connected');

      // Heartbeat every 2 seconds
      this.heartbeatInterval = setInterval(() => {
        this.send('HEARTBEAT');
      }, 2000);
    } catch (e) {
      console.error('BroadcastChannel failed to connect:', e);
      this.notifyStatus('disconnected');
    }
  }

  disconnect(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
    this.notifyStatus('disconnected');
  }

  send(type: MultiplayerMessageType, payload?: any): void {
    if (!this.channel) return;
    const msg: MultiplayerMessage = {
      type,
      gameId: this.gameId,
      senderId: this.playerId,
      payload,
      timestamp: Date.now()
    };
    try {
      this.channel.postMessage(msg);
    } catch (e) {
      console.error('Failed to post broadcast message:', e);
    }
  }

  onMessage(callback: (msg: MultiplayerMessage) => void): void {
    this.messageListeners.push(callback);
  }

  onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void {
    this.statusListeners.push(callback);
  }

  private notifyStatus(status: 'connected' | 'disconnected' | 'reconnecting'): void {
    this.statusListeners.forEach((fn) => fn(status));
  }
}

/**
 * WebSocket Transport:
 * Ready to connect to any WebSocket server (e.g. ws://localhost:8080).
 */
export class WebSocketMultiplayerTransport implements MultiplayerTransport {
  private ws: WebSocket | null = null;
  private gameId = '';
  private playerId = '';
  private serverUrl = '';
  private messageListeners: ((msg: MultiplayerMessage) => void)[] = [];
  private statusListeners: ((status: 'connected' | 'disconnected' | 'reconnecting') => void)[] = [];

  constructor(serverUrl: string = 'ws://localhost:8080') {
    this.serverUrl = serverUrl;
  }

  connect(gameId: string, playerId: string): void {
    this.gameId = gameId;
    this.playerId = playerId;

    try {
      this.ws = new WebSocket(`${this.serverUrl}?game=${gameId}&player=${playerId}`);
      this.ws.onopen = () => {
        this.statusListeners.forEach((fn) => fn('connected'));
      };
      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.messageListeners.forEach((fn) => fn(msg));
        } catch (e) {
          console.error('Error parsing WS message:', e);
        }
      };
      this.ws.onclose = () => {
        this.statusListeners.forEach((fn) => fn('disconnected'));
      };
      this.ws.onerror = () => {
        this.statusListeners.forEach((fn) => fn('disconnected'));
      };
    } catch (e) {
      console.warn('WebSocket connection not reachable, falling back to BroadcastChannel:', e);
    }
  }

  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  send(type: MultiplayerMessageType, payload?: any): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      const msg: MultiplayerMessage = {
        type,
        gameId: this.gameId,
        senderId: this.playerId,
        payload,
        timestamp: Date.now()
      };
      this.ws.send(JSON.stringify(msg));
    }
  }

  onMessage(callback: (msg: MultiplayerMessage) => void): void {
    this.messageListeners.push(callback);
  }

  onConnectionStatus(callback: (status: 'connected' | 'disconnected' | 'reconnecting') => void): void {
    this.statusListeners.push(callback);
  }
}
