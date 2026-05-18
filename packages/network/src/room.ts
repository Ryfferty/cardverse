import type { RoomInfo, RoomPlayer } from "./types.js";

export class RoomManager {
  private static rooms: Map<string, RoomInfo> = new Map();

  static generateRoomCode(): string {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 4; i++) {
      code += chars[Math.floor(Math.random() * chars.length)];
    }
    if (this.rooms.has(code)) {
      return this.generateRoomCode();
    }
    return code;
  }

  static createRoom(hostId: string, maxPlayers: number, roomCode?: string): RoomInfo {
    const code = roomCode ?? this.generateRoomCode();
    if (this.rooms.has(code)) {
      throw new Error(`房间 ${code} 已存在`);
    }

    const room: RoomInfo = {
      roomCode: code,
      hostId,
      playerCount: 1,
      maxPlayers,
      players: [
        {
          playerId: hostId,
          name: hostId,
          connected: true,
          joinedAt: Date.now(),
        },
      ],
      gameStarted: false,
    };

    this.rooms.set(code, room);
    return room;
  }

  static getRoom(roomCode: string): RoomInfo | undefined {
    return this.rooms.get(roomCode);
  }

  static addPlayer(roomCode: string, playerId: string, name: string): RoomPlayer {
    const room = this.rooms.get(roomCode);
    if (!room) {
      throw new Error(`房间 ${roomCode} 不存在`);
    }
    if (room.gameStarted) {
      throw new Error(`房间 ${roomCode} 游戏已开始，无法加入`);
    }
    if (room.playerCount >= room.maxPlayers) {
      throw new Error(`房间 ${roomCode} 已满`);
    }
    if (room.players.some((p) => p.playerId === playerId)) {
      throw new Error(`玩家 ${playerId} 已在房间中`);
    }

    const player: RoomPlayer = {
      playerId,
      name,
      connected: true,
      joinedAt: Date.now(),
    };
    room.players.push(player);
    room.playerCount = room.players.length;

    return player;
  }

  static removePlayer(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    room.players = room.players.filter((p) => p.playerId !== playerId);
    room.playerCount = room.players.length;

    if (room.players.length === 0) {
      this.rooms.delete(roomCode);
    }
  }

  static setPlayerConnected(roomCode: string, playerId: string, connected: boolean): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;

    const player = room.players.find((p) => p.playerId === playerId);
    if (player) {
      player.connected = connected;
    }
  }

  static setGameStarted(roomCode: string, started: boolean): void {
    const room = this.rooms.get(roomCode);
    if (room) {
      room.gameStarted = started;
    }
  }

  static closeRoom(roomCode: string): void {
    this.rooms.delete(roomCode);
  }

  static listRooms(): RoomInfo[] {
    return Array.from(this.rooms.values());
  }

  static reset(): void {
    this.rooms.clear();
  }
}