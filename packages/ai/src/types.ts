import type { PlayerId, CardInstanceId, GameEvent, EventResponse } from "@cardverse/shared";

export interface HandCard {
  instanceId: CardInstanceId;
  type: string;
  category: string;
  name: string;
  tags?: string[];
}

export interface AIPlayerInfo {
  playerId: PlayerId;
  handCardIds: CardInstanceId[];
  handCount: number;
  health: number;
  maxHealth: number;
  faction: string;
  alive: boolean;
  seatIndex: number;
}

export interface AIGameView {
  players: AIPlayerInfo[];
  selfId: PlayerId;
  turnNumber: number;
  currentPhase: string;
  currentTurnPlayerId: PlayerId;
  pendingEvents: GameEvent[];
  playerCount: number;
}

export interface AIAction {
  type: "playCard" | "respond" | "discard" | "pass" | "endTurn";
  cardId?: CardInstanceId;
  targets?: PlayerId[];
  response?: EventResponse;
  data?: Record<string, unknown>;
}

export interface AIAdapter {
  readonly name: string;

  decideAction(gameView: AIGameView): Promise<AIAction>;

  decideResponse(gameView: AIGameView, event: GameEvent): Promise<EventResponse | null>;

  onGameStart(gameView: AIGameView): Promise<void>;

  onGameEnd(gameView: AIGameView, winner: PlayerId): Promise<void>;
}