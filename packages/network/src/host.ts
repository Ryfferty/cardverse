import { WebSocketServer, WebSocket } from "ws";
import type { Game } from "@cardverse/core";
import type { GameEvent } from "@cardverse/shared";
import type { HostConfig, NetworkMessage, ConnectionHandler, NetworkStatus, StatusHandler } from "./types.js";
import { RoomManager } from "./room.js";
import { MessageCodec } from "./codec.js";

export class HostServer {
  readonly roomCode: string;
  readonly hostId: string;
  readonly port: number;
  private server: WebSocketServer | null = null;
  private roomManager: RoomManager;
  private clients: Map<string, { ws: WebSocket; playerId: string; codec: MessageCodec }> = new Map();
  private onMessage: ConnectionHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private status: NetworkStatus = "disconnected";
  private syncUnsubscribe: (() => void) | null = null;
  private eventLog: NetworkMessage[] = [];
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  constructor(hostId: string, config: HostConfig) {
    this.hostId = hostId;
    this.port = config.port;
    this.roomManager = new RoomManager();

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
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    if (this.syncUnsubscribe) {
      this.syncUnsubscribe();
      this.syncUnsubscribe = null;
    }

    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }

    return new Promise((resolve) => {
      for (const [_clientId, client] of this.clients) {
        client.ws.close();
      }
      this.clients.clear();

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
    if (this.syncUnsubscribe) {
      this.syncUnsubscribe();
    }

    const handler = (event: GameEvent): void => {
      const msg: NetworkMessage = {
        type: "game_sync",
        payload: {
          eventType: event.type,
          eventData: event.data,
          eventId: event.id,
          target: event.target,
          source: event.source,
          stackDepth: event.stackDepth,
          seq: this.eventLog.length,
        },
        timestamp: event.timestamp,
      };
      this.eventLog.push(msg);
      this.broadcast(msg);
    };

    game.eventBus.on("*", handler);

    this.syncUnsubscribe = () => {
      game.eventBus.off("*", handler);
    };
  }

  startHeartbeat(intervalMs: number = 15000): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }

    this.heartbeatInterval = setInterval(() => {
      const ping: NetworkMessage = {
        type: "ping",
        payload: { seq: this.eventLog.length },
        timestamp: Date.now(),
      };
      this.broadcast(ping);
    }, intervalMs);
  }

  getEventLogSince(sinceSeq: number): NetworkMessage[] {
    if (sinceSeq < 0 || sinceSeq >= this.eventLog.length) return [];
    return this.eventLog.slice(sinceSeq);
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

  private setStatus(status: NetworkStatus): void {
    this.status = status;
    if (this.onStatusChange) {
      this.onStatusChange(status);
    }
  }

  private handleConnection(ws: WebSocket): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const codec = new MessageCodec();

    const client = { ws, playerId: "", codec };
    this.clients.set(clientId, client);

    ws.on("message", (data: Buffer | string) => {
      const text = typeof data === "string" ? data : data.toString("utf-8");
      const messages = codec.feed(text);

      for (const msg of messages) {
        const msgWithSender = { ...msg, senderId: clientId };

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
    const lastSeq = (msg.payload.lastSeq as number) ?? -1;

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

    const isReconnect = this.roomManager.getRoom(this.roomCode)?.players.some(
      (p) => p.playerId === playerId
    ) ?? false;

    if (isReconnect) {
      this.roomManager.setPlayerConnected(this.roomCode, playerId, true);

      const existingClient = Array.from(this.clients.values()).find((c) => c.playerId === playerId);
      if (existingClient) {
        existingClient.ws.close();
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
          isReconnect: true,
        },
        timestamp: Date.now(),
      };
      ws.send(MessageCodec.encode(response));

      if (lastSeq >= 0 && this.eventLog.length > lastSeq) {
        const missedEvents = this.getEventLogSince(lastSeq);
        for (const event of missedEvents) {
          try {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(MessageCodec.encode(event));
            }
          } catch {
            break;
          }
        }
      }
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