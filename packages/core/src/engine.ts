import {
  type GameConfig,
  type GameState,
  type GameEvent,
  type PlayerState,
  type PlayerId,
  type ZoneDefinition,
  type ResourceDefinition,
  type PhaseDefinition,
  type EventResponse,
  type CardInstanceId,
  EventType,
  DEFAULT_MAX_EFFECT_STEPS,
  DEFAULT_RESPONSE_TIMEOUT,
  DEFAULT_RECONNECT_TIMEOUT,
} from "@cardverse/shared";
import { EventBus, EventStack, type EventHandler } from "./events.js";
import { StateManager } from "./state.js";
import { ZoneManager } from "./zones.js";
import { PhaseManager } from "./phases.js";
import { ResourceManager } from "./resources.js";

let gameIdCounter = 0;

/**
 * Game — the main engine class.
 * Orchestrates all subsystems: events, state, zones, phases, resources.
 */
export class Game {
  readonly config: GameConfig;
  readonly eventBus: EventBus;
  readonly eventStack: EventStack;
  readonly state: StateManager;
  readonly zones: ZoneManager;
  readonly phases: PhaseManager;
  readonly resources: ResourceManager;

  private maxEffectSteps: number;
  private responseTimeout: number;
  private reconnectTimeout: number;

  private constructor(config: GameConfig, initialState: GameState) {
    this.config = config;
    this.maxEffectSteps = config.maxEffectSteps ?? DEFAULT_MAX_EFFECT_STEPS;
    this.responseTimeout = config.responseTimeout ?? DEFAULT_RESPONSE_TIMEOUT;
    this.reconnectTimeout = config.reconnectTimeout ?? DEFAULT_RECONNECT_TIMEOUT;

    this.eventBus = new EventBus();
    this.eventStack = new EventStack();
    this.state = new StateManager(initialState);
    this.zones = new ZoneManager();
    this.phases = new PhaseManager();
    this.resources = new ResourceManager(this.eventBus);
  }

  /**
   * Create a new game instance.
   */
  static create(config: GameConfig): Game {
    const gameId = `game_${++gameIdCounter}_${Date.now()}`;
    const initialState: GameState = {
      gameId,
      status: "waiting",
      players: new Map(),
      globalZones: new Map(),
      turnNumber: 0,
      eventLog: [],
    };
    return new Game(config, initialState);
  }

  /**
   * Add a player to the game.
   */
  addPlayer(playerId: PlayerId, name: string): void {
    const currentState = this.state.getCurrentState();
    if (currentState.status !== "waiting") {
      throw new Error("Cannot add players after game has started");
    }

    const player: PlayerState = {
      id: playerId,
      name,
      status: "alive",
      zones: new Map(),
      resources: new Map(),
      handCount: 0,
    };
    currentState.players.set(playerId, player);
    // Update the internal state (bypassing event log for setup)
    (this.state as any).currentState = currentState;
  }

  /**
   * Start the game.
   */
  async start(): Promise<void> {
    const currentState = this.state.getCurrentState();
    if (currentState.players.size < 2) {
      throw new Error("Need at least 2 players to start");
    }

    const event: Omit<GameEvent, "id" | "timestamp" | "stackDepth"> = {
      type: EventType.GAME_START,
      data: { playerCount: currentState.players.size },
    };
    await this.emitAndApply(event);
  }

  /**
   * End the game with a result.
   */
  async end(winner: string, winCondition: string): Promise<void> {
    await this.emitAndApply({
      type: EventType.GAME_END,
      data: { winner, winCondition },
    });
  }

  /**
   * Play a card.
   */
  async playCard(
    playerId: PlayerId,
    cardInstanceId: CardInstanceId,
    targets?: PlayerId[]
  ): Promise<void> {
    await this.emitAndApply({
      type: EventType.CARD_PLAYED,
      source: playerId,
      data: { cardInstanceId, targets },
    });
  }

  /**
   * Respond to an event (e.g., play "shan" in response to "sha").
   */
  respondToEvent(eventId: string, response: EventResponse): void {
    this.eventBus.emit({
      id: `resp_${Date.now()}`,
      type: EventType.RESPONSE_GIVEN,
      source: response.playerId,
      target: undefined,
      data: { eventId, response },
      timestamp: Date.now(),
      stackDepth: 0,
    });
  }

  /**
   * Get current game state.
   */
  getState(): GameState {
    return this.state.getCurrentState();
  }

  /**
   * Get state visible to a specific player.
   */
  getStateForPlayer(playerId: PlayerId): GameState {
    return this.state.getStateForPlayer(playerId);
  }

  /**
   * Get the full event log.
   */
  getEventLog(): GameEvent[] {
    return this.state.getEventLog();
  }

  /**
   * Register an event handler.
   */
  on(eventType: string, handler: EventHandler): void {
    this.eventBus.on(eventType, handler);
  }

  /**
   * Remove an event handler.
   */
  off(eventType: string, handler: EventHandler): void {
    this.eventBus.off(eventType, handler);
  }

  /**
   * Emit an event, apply it to state, and push to stack.
   */
  private async emitAndApply(
    eventData: Omit<GameEvent, "id" | "timestamp" | "stackDepth">
  ): Promise<void> {
    const event = this.eventStack.push(eventData);
    await this.eventBus.emit(event);
    this.state.applyEvent(event);
  }
}
