export interface NetworkMessage {
  type: string;
  payload: Record<string, unknown>;
  timestamp: number;
  senderId?: string;
  seq?: number;
}

export interface AckMessage {
  lastReceivedSeq: number;
}

export interface HeartbeatConfig {
  interval: number;
  timeout: number;
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
  heartbeat?: HeartbeatConfig;
}

export interface ClientConfig {
  host: string;
  port: number;
  playerName: string;
}

export type NetworkStatus = "disconnected" | "connecting" | "connected" | "reconnecting";

export type ConnectionHandler = (message: NetworkMessage, clientId?: string) => void;

export type StatusHandler = (status: NetworkStatus) => void;