import { createConnection } from "node:net";
import type { Socket } from "node:net";
import type { ClientConfig, NetworkMessage, ConnectionHandler, NetworkStatus, StatusHandler } from "./types.js";
import { MessageCodec } from "./codec.js";

export class ClientConnection {
  readonly playerId: string;
  readonly playerName: string;
  private host: string;
  private port: number;
  private socket: Socket | null = null;
  private codec: MessageCodec;
  private onMessageHandler: ConnectionHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private status: NetworkStatus = "disconnected";
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;

  constructor(playerId: string, config: ClientConfig) {
    this.playerId = playerId;
    this.playerName = config.playerName;
    this.host = config.host;
    this.port = config.port;
    this.codec = new MessageCodec();
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

      this.socket = createConnection(this.port, this.host, () => {
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
          reject(new Error("加入房间超时"));
        }, 5000);

        const joinHandler = (msg: NetworkMessage): void => {
          if (msg.type === "join_accepted" || msg.type === "join_rejected") {
            clearTimeout(joinTimeout);
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
      });

      this.socket!.on("data", (data: Buffer) => {
        const messages = this.codec.feed(data.toString("utf-8"));
        for (const msg of messages) {
          if (this.onMessageHandler) {
            this.onMessageHandler(msg);
          }
        }
      });

      this.socket!.on("close", () => {
        this.setStatus("disconnected");
        this.attemptReconnect();
      });

      this.socket!.on("error", (err: Error) => {
        this.setStatus("disconnected");
        if (this.status === "connecting") {
          reject(err);
        }
        this.attemptReconnect();
      });
    });
  }

  send(message: NetworkMessage): void {
    if (!this.socket || this.status !== "connected") {
      return;
    }

    const encoded = MessageCodec.encode(message);
    try {
      this.socket.write(encoded);
    } catch {
      // Socket write failed, will be handled by error event
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
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