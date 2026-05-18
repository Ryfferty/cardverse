import { createServer } from "node:net";
import type { Socket, Server } from "node:net";
import type { HostConfig, NetworkMessage, ConnectionHandler, NetworkStatus, StatusHandler } from "./types.js";
import { RoomManager } from "./room.js";
import { MessageCodec } from "./codec.js";

export class HostServer {
  readonly roomCode: string;
  readonly hostId: string;
  readonly port: number;
  private server: Server;
  private clients: Map<string, { socket: Socket; playerId: string; codec: MessageCodec }> = new Map();
  private onMessage: ConnectionHandler | null = null;
  private onStatusChange: StatusHandler | null = null;
  private status: NetworkStatus = "disconnected";

  constructor(hostId: string, config: HostConfig) {
    this.hostId = hostId;
    this.port = config.port;

    const room = RoomManager.createRoom(hostId, config.maxPlayers, config.roomCode);
    this.roomCode = room.roomCode;

    this.server = createServer((socket) => {
      this.handleConnection(socket);
    });
  }

  onConnection(handler: ConnectionHandler): void {
    this.onMessage = handler;
  }

  onStatus(handler: StatusHandler): void {
    this.onStatusChange = handler;
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.once("error", reject);

      this.server.listen(this.port, () => {
        this.setStatus("connected");
        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      for (const [clientId, client] of this.clients) {
        client.socket.destroy();
      }
      this.clients.clear();

      RoomManager.closeRoom(this.roomCode);

      this.server.close(() => {
        this.setStatus("disconnected");
        resolve();
      });
    });
  }

  broadcast(message: NetworkMessage): void {
    const encoded = MessageCodec.encode(message);
    for (const [clientId, client] of this.clients) {
      try {
        client.socket.write(encoded);
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
          client.socket.write(encoded);
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

  private handleConnection(socket: Socket): void {
    const clientId = `client_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const codec = new MessageCodec();

    const client = { socket, playerId: "", codec };
    this.clients.set(clientId, client);

    socket.on("data", (data: Buffer) => {
      const messages = codec.feed(data.toString("utf-8"));

      for (const msg of messages) {
        const msgWithSender = { ...msg, senderId: clientId };

        if (msg.type === "join_request") {
          this.handleJoinRequest(clientId, socket, msg);
          continue;
        }

        if (this.onMessage) {
          this.onMessage(msgWithSender, client.playerId || clientId);
        }
      }
    });

    socket.on("close", () => {
      const playerId = this.clients.get(clientId)?.playerId;
      this.clients.delete(clientId);

      if (playerId) {
        RoomManager.removePlayer(this.roomCode, playerId);

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

    socket.on("error", () => {
      this.removeClient(clientId);
    });
  }

  private handleJoinRequest(clientId: string, socket: Socket, msg: NetworkMessage): void {
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
      socket.write(MessageCodec.encode(response));
      socket.destroy();
      return;
    }

    try {
      RoomManager.addPlayer(this.roomCode, playerId, playerName);
    } catch (err) {
      response = {
        type: "join_rejected",
        payload: { reason: err instanceof Error ? err.message : "加入失败" },
        timestamp: Date.now(),
      };
      socket.write(MessageCodec.encode(response));
      socket.destroy();
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
        players: RoomManager.getRoom(this.roomCode)?.players ?? [],
      },
      timestamp: Date.now(),
    };
    socket.write(MessageCodec.encode(response));

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

    client.socket.destroy();

    if (client.playerId) {
      RoomManager.setPlayerConnected(this.roomCode, client.playerId, false);
    }

    this.clients.delete(clientId);
  }
}