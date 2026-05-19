import { WebSocketServer, WebSocket } from "ws";
import type { Game } from "@cardverse/core";
import type { HostConfig, NetworkMessage, ConnectionHandler, NetworkStatus, StatusHandler, HeartbeatConfig } from "./types.js";
import { RoomManager } from "./room.js";
import { MessageCodec } from "./codec.js";

const DEFAULT_HEARTBEAT: HeartbeatConfig = {
  interval: 15000,
  timeout: 30000,
};

export class HostServer {
  readonly roomCode: string;
  readonly hostId: string;
  readonly port: number;
  private server: WebSocketServer | null = null;
  private roomManager: RoomManager;
  private clients: Map<string, { ws: WebSocket; playerId: string; codec: MessageCodec; lastPong: number }> = new Map();
  private onMessage: ConnectionHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private status: NetworkStatus = "disconnected";
  private eventSeq: number = 0;
  private eventHistory: NetworkMessage[] = [];
  private maxHistorySize: number = 200;
  private syncedGame: Game | null = null;
  private syncHandler: ((event: Record<string, unknown>) => void) | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private heartbeatConfig: HeartbeatConfig;

  constructor(hostId: string, config: HostConfig) {
    this.hostId = hostId;
    this.port = config.port;
    this.roomManager = new RoomManager();
    this.heartbeatConfig = config.heartbeat ?? DEFAULT_HEARTBEAT;

    const room = this.roomManager.createRoom(hostId, config.maxPlayers, config.roomCode);
    this.roomCode = room.roomCode;
  }

  onConnection(handler: ConnectionHandler): void {
    this.onMessage = handler;
  }

  onStatus(handler: StatusHandler): void {
    this.onStatusChange = handler;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server = new WebSocketServer({ port: this.port });

      this.server.on("connection", (ws) => {
        this.handleConnection(ws);
      });

      this.server.on("error", reject);

      this.server.on("listening", () => {
        this.setStatus("connected");
        this.startHeartbeat();
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.stopHeartbeat();

      if (this.syncedGame && this.syncHandler) {
        this.syncedGame.eventBus.off("*", this.syncHandler);
        this.syncedGame = null;
        this.syncHandler = null;
      }

      for (const [clientId, client] of this.clients) {
        client.ws.close();
      }
      this.clients.clear();
      this.eventHistory.length = 0;
      this.eventSeq = 0;

      this.roomManager.closeRoom(this.roomCode);

      if (this.server) {
        this.server.close(() => {
          this.setStatus("disconnected");
          resolve();
        });
      } else {
        this.setStatus("disconnected");
        resolve();
      }
    });
  }

  syncGame(game: Game): void {
    this.syncedGame = game;
    this.syncHandler = (event: Record<string, unknown>): void => {
      this.eventSeq++;
      const seq = this.eventSeq;
      const msg: NetworkMessage = {
        type: "game_sync",
        payload: {
          eventType: event.type,
          eventData: event.data,
          eventId: (event as Record<string, unknown>).id,
          target: (event as Record<string, unknown>).target,
          source: (event as Record<string, unknown>).source,
          stackDepth: (event as Record<string, unknown>).stackDepth,
          seq,
        },
        timestamp: (event as Record<string, unknown>).timestamp as number ?? Date.now(),
        seq,
      };
      this.addToHistory(msg);
      this.broadcast(msg);
    };
    game.eventBus.on("*", this.syncHandler);
  }

  broadcast(message: NetworkMessage): void {
    const encoded = MessageCodec.encode(message);
    for (const [clientId, client] of this.clients) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(encoded);
        }
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  sendTo(playerId: string, message: NetworkMessage): void {
    const encoded = MessageCodec.encode(message);
    for (const [clientId, client] of this.clients) {
      if (client.playerId === playerId) {
        try {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.send(encoded);
          }
        } catch {
          this.removeClient(clientId);
        }
        return;
      }
    }
  }

  getConnectedPlayers(): string[] {
    return Array.from(this.clients.values()).map((c) => c.playerId);
  }

  getPlayerCount(): number {
    return this.clients.size;
  }

  getStatus(): NetworkStatus {
    return this.status;
  }

  handleAckMessage(clientId: string, lastReceivedSeq: number): void {
    const missedEvents = this.eventHistory.filter((msg) => (msg.seq ?? 0) > lastReceivedSeq);
    const client = this.clients.get(clientId);
    if (!client || client.ws.readyState !== WebSocket.OPEN) return;

    for (const msg of missedEvents) {
      try {
        client.ws.send(MessageCodec.encode(msg));
      } catch {
        this.removeClient(clientId);
        return;
      }
    }
  }

  private startHeartbeat(): void {
    this.heartbeatTimer = setInterval(() => {
      this.checkHeartbeats();

      const ping: NetworkMessage = {
        type: "ping",
        payload: { serverTime: Date.now() },
        timestamp: Date.now(),
      };
      this.broadcastMessage(ping);
    }, this.heartbeatConfig.interval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private checkHeartbeats(): void {
    const now = Date.now();
    const timeout = this.heartbeatConfig.timeout;
    for (const [clientId, client] of this.clients) {
      if (now - client.lastPong > timeout) {
        this.removeClient(clientId);
      }
    }
  }

  private broadcastMessage(message: NetworkMessage): void {
    const encoded = MessageCodec.encode(message);
    for (const [clientId, client] of this.clients) {
      try {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(encoded);
        }
      } catch {
        this.removeClient(clientId);
      }
    }
  }

  private addToHistory(message: NetworkMessage): void {
    this.eventHistory.push(message);
    while (this.eventHistory.length > this.maxHistorySize) {
      this.eventHistory.shift();
    }
  }

  getEventHistoryCount(): number {
    return this.eventHistory.length;
  }

  getCurrentSeq(): number {
    return this.eventSeq;
  }

  private setStatus(status: NetworkStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const codec = new MessageCodec();

    const client = { ws, playerId: "", codec, lastPong: Date.now() };
    this.clients.set(clientId, client);

    ws.on("message", (data: Buffer | string) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      const messages = codec.feed(text);

      for (const msg of messages) {
        const msgWithSender = { ...msg, senderId: clientId };

        if (msg.type === "pong") {
          const entry = this.clients.get(clientId);
          if (entry) {
            entry.lastPong = Date.now();
          }
          continue;
        }

        if (msg.type === "ack") {
          const lastSeq = msg.payload.lastSeq as number | undefined;
          if (typeof lastSeq === "number") {
            this.handleAckMessage(clientId, lastSeq);
          }
          continue;
        }

        if (msg.type === "join_request") {
          this.handleJoinRequest(clientId, ws, msg);
          continue;
        }

        if (this.onMessage) {
          this.onMessage(msgWithSender, client.playerId || clientId);
        }
      }
    });

    ws.on("close", () => {
      const playerId = this.clients.get(clientId)?.playerId;
      this.clients.delete(clientId);

      if (playerId) {
        this.roomManager.removePlayer(this.roomCode, playerId);

        const leaveMsg: NetworkMessage = {
          type: "player_left",
          payload: { playerId, roomCode: this.roomCode },
          timestamp: Date.now(),
        };

        this.broadcast(leaveMsg);

        if (this.onMessage) {
          this.onMessage(leaveMsg, playerId);
        }
      }
    });

    ws.on("error", () => {
      this.removeClient(clientId);
    });
  }

  private handleJoinRequest(clientId: string, ws: WebSocket, msg: NetworkMessage): void {
    const playerId = (msg.payload.playerId as string) || clientId;
    const playerName = (msg.payload.playerName as string) || playerId;
    const requestRoomCode = (msg.payload.roomCode as string) || this.roomCode;

    let response: NetworkMessage;

    if (requestRoomCode !== this.roomCode) {
      response = {
        type: "join_rejected",
        payload: { reason: "房间码不匹配" },
        timestamp: Date.now(),
      };
      ws.send(MessageCodec.encode(response));
      ws.close();
      return;
    }

    try {
      this.roomManager.addPlayer(this.roomCode, playerId, playerName);
    } catch (err) {
      response = {
        type: "join_rejected",
        payload: { reason: err instanceof Error ? err.message : "加入失败" },
        timestamp: Date.now(),
      };
      ws.send(MessageCodec.encode(response));
      ws.close();
      return;
    }

    const client = this.clients.get(clientId);
    if (client) {
      client.playerId = playerId;
    }

    response = {
      type: "join_accepted",
      payload: {
        roomCode: this.roomCode,
        hostId: this.hostId,
        players: this.roomManager.getRoom(this.roomCode)?.players ?? [],
      },
      timestamp: Date.now(),
    };
    ws.send(MessageCodec.encode(response));

    const joinMsg: NetworkMessage = {
      type: "player_joined",
      payload: { playerId, playerName, roomCode: this.roomCode },
      timestamp: Date.now(),
    };
    this.broadcast(joinMsg);

    if (this.onMessage) {
      this.onMessage(joinMsg, playerId);
    }
  }

  private removeClient(clientId: string): void {
    const client = this.clients.get(clientId);
    if (!client) return;

    client.ws.close();

    if (client.playerId) {
      this.roomManager.setPlayerConnected(this.roomCode, client.playerId, false);
    }

    this.clients.delete(clientId);
  }
}