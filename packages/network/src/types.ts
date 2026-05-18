export interface NetworkMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  senderId?: string;
}

export interface RoomInfo {
  roomCode: string;
  hostId: string;
  playerCount: number;
  maxPlayers: number;
  players: RoomPlayer[];
  gameStarted: boolean;
}

export interface RoomPlayer {
  playerId: string;
  name: string;
  connected: boolean;
  joinedAt: number;
}

export interface HostConfig {
  port: number;
  maxPlayers: number;
  roomCode?: string;
}

export interface ClientConfig {
  host: string;
  port: number;
  playerName: string;
}

export type NetworkStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type ConnectionHandler = (message: NetworkMessage, clientId?: string) => void;

export type StatusHandler = (status: NetworkStatus) => void;

export { RoomManager } from "./room.js";