import type { ClientConfig, NetworkMessage, ConnectionHandler, NetworkStatus, StatusHandler } from "./types.js";
import { MessageCodec } from "./codec.js";

const WS_CLOSED = 3;

function getWebSocketConstructor(): typeof WebSocket {
  if (typeof WebSocket !== "undefined") {
    return WebSocket;
  }
  throw new Error(
    "WebSocket is not available in this environment. " +
    "In Node.js, polyfill globalThis.WebSocket with the 'ws' package before importing this module."
  );
}

export class ClientConnection {
  readonly playerId: string;
  readonly playerName: string;
  private host: string;
  private port: number;
  private ws: WebSocket | null = null;
  private codec: MessageCodec;
  private onMessageHandler: ConnectionHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private status: NetworkStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private wsCtor: typeof WebSocket;

  constructor(playerId: string, config: ClientConfig) {
    this.playerId = playerId;
    this.playerName = config.playerName;
    this.host = config.host;
    this.port = config.port;
    this.codec = new MessageCodec();
    this.wsCtor = getWebSocketConstructor();
  }

  onConnection(handler: ConnectionHandler): void {
    this.onMessageHandler = handler;
  }

  onStatus(handler: StatusHandler): void {
    this.onStatusChange = handler;
  }

  async connect(roomCode?: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.setStatus("connecting");

      this.ws = new this.wsCtor(`ws://${this.host}:${this.port}`);
      const socket = this.ws;

      let resolved = false;

      socket.onopen = () => {
        this.setStatus("connected");
        this.reconnectAttempts = 0;

        const joinMsg: NetworkMessage = {
          type: "join_request",
          payload: {
            playerId: this.playerId,
            playerName: this.playerName,
            roomCode: roomCode ?? "",
          },
          timestamp: Date.now(),
        };

        this.send(joinMsg);

        const joinTimeout = setTimeout(() => {
          if (!resolved) {
            resolved = true;
            this.onMessageHandler = userHandler;
            reject(new Error("加入房间超时"));
          }
        }, 5000);

        const joinHandler = (msg: NetworkMessage): void => {
          if (msg.type === "join_accepted" || msg.type === "join_rejected") {
            clearTimeout(joinTimeout);
            resolved = true;
            this.onMessageHandler = userHandler;
            if (msg.type === "join_rejected") {
              reject(new Error((msg.payload.reason as string) ?? "加入被拒绝"));
            } else {
              resolve();
            }
            if (userHandler) {
              userHandler(msg);
            }
          }
        };

        const userHandler = this.onMessageHandler;
        this.onMessageHandler = joinHandler;
      };

      socket.onmessage = (event: MessageEvent) => {
        const data = typeof event.data === "string" ? event.data : "";
        const messages = this.codec.feed(data);
        for (const msg of messages) {
          if (this.onMessageHandler) {
            this.onMessageHandler(msg);
          }
        }
      };

      socket.onclose = () => {
        this.setStatus("disconnected");
        if (!resolved) {
          resolved = true;
          reject(new Error("连接已关闭"));
        }
        this.attemptReconnect();
      };

      socket.onerror = () => {
        this.setStatus("disconnected");
        if (!resolved) {
          resolved = true;
          reject(new Error("连接失败"));
        }
        this.attemptReconnect();
      };
    });
  }

  send(message: NetworkMessage): void {
    if (!this.ws || this.status !== "connected") {
      return;
    }
    if (this.ws.readyState !== WebSocket.OPEN) {
      return;
    }

    const encoded = MessageCodec.encode(message);
    try {
      this.ws.send(encoded);
    } catch {
      // Socket send failed, will be handled by error event
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    this.setStatus("disconnected");
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  private setStatus(status: NetworkStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  private attemptReconnect(): void {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      this.setStatus("disconnected");
      return;
    }

    this.reconnectAttempts++;
    this.setStatus("reconnecting");

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(() => {
        // Will retry via close/error events
      });
    }, 1000 * Math.min(this.reconnectAttempts, 5));
  }
}