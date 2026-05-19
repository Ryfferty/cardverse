// ============================================================
// CardVerse — Core Type Definitions
// ============================================================

// ---------- Card System ----------

/** Unique identifier for a card definition (e.g., "sha", "shan") */
export type CardDefinitionId = string;

/** Unique identifier for a card instance in a game */
export type CardInstanceId = string;

/** Unique identifier for a player in a game */
export type PlayerId = string;

/** Player role in Sanguosha-like games */
export type PlayerRole = "lord" | "loyalist" | "rebel" | "spy";

/** Role assignment for a player */
export interface RoleAssignment {
  playerId: PlayerId;
  role: PlayerRole;
  revealed: boolean;
}

/** Unique identifier for a zone */
export type ZoneId = string;

/** Unique identifier for a resource */
export type ResourceId = string;

/** Card types that a deck can define */
export type CardCategory = "basic" | "trick" | "equipment" | "judge" | string;

/** Definition of a card type (template) */
export interface CardDefinition {
  id: CardDefinitionId;
  name: string;
  category: CardCategory;
  description?: string;
  cost?: number;
  tags?: string[];
  /** Effect references for this card (resolved at runtime) */
  effects?: Array<{ id: string; [key: string]: unknown }>;
}

/** A concrete instance of a card in the game */
export interface CardInstance {
  instanceId: CardInstanceId;
  definitionId: CardDefinitionId;
  owner: PlayerId;
  zone: ZoneId;
  faceUp: boolean;
  /** Temporary modifiers applied to this card */
  modifiers: Modifier[];
}

/** Temporary modifier on a card or player */
export interface Modifier {
  id: string;
  source: string;
  property: string;
  value: number | string;
  expiresAt?: string; // phase or event when it expires
}

// ---------- Zone System ----------

/** Who can see the contents of a zone */
export type ZoneVisibility = "owner" | "all" | "none";

/** Zone definition from deck manifest */
export interface ZoneDefinition {
  id: ZoneId;
  name: string;
  visibility: ZoneVisibility;
  ordered: boolean;
  maxSize?: number;
  faceDown: boolean;
  owner: "player" | "global";
}

/** Runtime state of a zone */
export interface ZoneState {
  definition: ZoneDefinition;
  cards: CardInstanceId[];
  playerId?: PlayerId; // only for player-owned zones
}

// ---------- Resource System ----------

/** Resource definition from deck manifest */
export interface ResourceDefinition {
  id: ResourceId;
  name: string;
  defaultValue: number;
  min?: number;
  max?: number;
  regenPerTurn?: number;
}

/** Runtime state of a player resource */
export interface ResourceState {
  definitionId: ResourceId;
  current: number;
  min: number;
  max: number;
}

// ---------- Phase / Turn System ----------

/** Phase definition from deck manifest */
export interface PhaseDefinition {
  id: string;
  name: string;
  auto: boolean; // auto-execute or wait for player input
  condition?: string; // JS expression for dynamic phases
  subPhases?: PhaseDefinition[];
}

/** Current turn info */
export interface TurnInfo {
  playerId: PlayerId;
  phaseIndex: number;
  phaseId: string;
  subPhaseIndex?: number;
  turnNumber: number;
}

// ---------- Event System ----------

/** All built-in event types */
export const EventType = {
  // Game lifecycle
  GAME_START: "game:start",
  GAME_END: "game:end",
  // Turn lifecycle
  TURN_START: "turn:start",
  TURN_END: "turn:end",
  PHASE_START: "phase:start",
  PHASE_END: "phase:end",
  // Card actions
  CARD_PLAYED: "card:played",
  CARD_DRAWN: "card:drawn",
  CARD_DISCARDED: "card:discarded",
  CARD_MOVED: "card:moved",
  // Combat
  DAMAGE_DEALT: "damage:dealt",
  DAMAGE_TAKEN: "damage:taken",
  HEAL_RECEIVED: "heal:received",
  // Player
  PLAYER_ELIMINATED: "player:eliminated",
  // Response flow
  RESPONSE_REQUESTED: "response:requested",
  RESPONSE_GIVEN: "response:given",
  RESPONSE_TIMEOUT: "response:timeout",
  // Resource
  RESOURCE_CHANGED: "resource:changed",
} as const;

export type EventTypeValue = (typeof EventType)[keyof typeof EventType];

/** A game event.
 *  For custom event types, cast through `as EventTypeValue` or
 *  extend this interface to override the `type` field. */
export interface GameEvent {
  id: string;
  type: EventTypeValue;
  source?: PlayerId;
  target?: PlayerId;
  data: Record<string, unknown>;
  timestamp: number;
  /** If this event was caused by another event */
  parentEventId?: string;
  /** Stack depth for nested responses */
  stackDepth: number;
}

/** Response to an event */
export interface EventResponse {
  playerId: PlayerId;
  cardId?: CardInstanceId;
  action: string; // "play", "pass", etc.
  targets?: PlayerId[];
  data?: Record<string, unknown>;
}

// ---------- Player System ----------

export type PlayerStatus = "alive" | "dead" | "disconnected";

export interface PlayerState {
  id: PlayerId;
  name: string;
  status: PlayerStatus;
  zones: Map<ZoneId, ZoneState>;
  resources: Map<ResourceId, ResourceState>;
  /** Cards in hand (shortcut for hand zone) */
  handCount: number;
  /** Faction/team identifier */
  faction?: string;
}

// ---------- Game State ----------

export interface GameState {
  gameId: string;
  status: "waiting" | "setup" | "running" | "paused" | "finished";
  players: Map<PlayerId, PlayerState>;
  globalZones: Map<ZoneId, ZoneState>;
  currentTurn?: TurnInfo;
  turnNumber: number;
  eventLog: GameEvent[];
  winner?: string;
  winCondition?: string;
}

// ---------- Game Config ----------

export interface GameConfig {
  deckId: string;
  playerCount: number;
  /** Max steps before forced termination (default: 1000) */
  maxEffectSteps?: number;
  /** Response timeout in seconds */
  responseTimeout?: number;
  /** AI reconnect timeout in seconds */
  reconnectTimeout?: number;
}

// ---------- Effect Context ----------

export interface ModifierTarget {
  type: string;
  value: number;
  source: string;
  cardType?: string;
  expires: string;
}

export interface EffectContext {
  target: PlayerId | string;
  params: Record<string, unknown>;
  player: { id: PlayerId; name: string };
  event: GameEvent;
  requestResponse(target: PlayerId | string, data: Record<string, unknown>): Promise<boolean | null>;
  damage(target: PlayerId | string, amount: number): Promise<void>;
  getResource(playerId: PlayerId | string, resourceId: string): Promise<number>;
  setResource(playerId: PlayerId | string, resourceId: string, value: number): Promise<void>;
  addModifier(playerId: PlayerId | string, modifier: ModifierTarget): Promise<void>;
  log(message: string): void;
}
