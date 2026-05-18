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
  type EventTypeValue,
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
   * Add a player. Must be called before start().
   */
  addPlayer(playerId: PlayerId, name: string): PlayerState {
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
    this.state.addPlayer(player);
    return player;
  }

  /**
   * Initialize zone definitions from the game config.
   */
  initZones(zoneDefs: ZoneDefinition[]): void {
    for (const def of zoneDefs) {
      if (def.owner === "global") {
        this.zones.addGlobalZone(def);
      }
    }
  }

  /**
   * Initialize zone definitions for a player.
   */
  initPlayerZones(playerId: PlayerId, zoneDefs: ZoneDefinition[]): void {
    for (const def of zoneDefs) {
      if (def.owner === "player") {
        this.zones.addPlayerZone(playerId, def);
      }
    }
  }

  /**
   * Initialize resource definitions.
   */
  initResources(resourceDefs: ResourceDefinition[]): void {
    for (const def of resourceDefs) {
      this.resources.registerDefinition(def);
    }
  }

  /**
   * Set up phases from definitions.
   */
  initPhases(phaseDefs: PhaseDefinition[]): void {
    this.phases.setPhases(phaseDefs);
  }

  /**
   * Start the game. Emits GAME_START event.
   */
  async start(): Promise<void> {
    const currentState = this.state.getCurrentState();
    if (currentState.players.size < 2) {
      throw new Error(`Need at least 2 players to start (have ${currentState.players.size})`);
    }

    await this.emitAndApply({
      type: EventType.GAME_START,
      data: { playerCount: currentState.players.size },
    });
  }

  /**
   * End the game. Emits GAME_END event.
   */
  async end(winner: string, winCondition: string): Promise<void> {
    await this.emitAndApply({
      type: EventType.GAME_END,
      data: { winner, winCondition },
    });
  }

  /**
   * Start a new turn for a player.
   */
  async startTurn(playerId: PlayerId): Promise<void> {
    const gameState = this.state.getCurrentState();
    const turnNumber = gameState.turnNumber + 1;

    await this.emitAndApply({
      type: EventType.TURN_START,
      source: playerId,
      data: { playerId, phaseId: this.phases.getCurrentPhase()?.id ?? "" },
    });

    this.phases.startTurn(playerId, turnNumber);

    await this.emitAndApply({
      type: EventType.PHASE_START,
      source: playerId,
      data: {
        phaseIndex: 0,
        phaseId: this.phases.getCurrentPhase()?.id ?? "",
      },
    });
  }

  /**
   * Advance to the next phase.
   */
  async nextPhase(gameStateOverride?: Record<string, unknown>): Promise<boolean> {
    const phase = this.phases.nextPhase(gameStateOverride);
    if (!phase) {
      return false;
    }

    await this.emitAndApply({
      type: EventType.PHASE_START,
      data: {
        phaseIndex: this.phases.getCurrentPhaseIndex(),
        phaseId: phase.id,
      },
    });
    return true;
  }

  /**
   * End the current turn.
   */
  async endTurn(): Promise<void> {
    const info = this.phases.getTurnInfo();
    if (!info) return;

    const playerIds = Array.from(this.state.getCurrentState().players.keys());
    if (playerIds.length > 0) {
      await this.resources.applyRegen(playerIds);
    }

    await this.emitAndApply({
      type: EventType.TURN_END,
      source: info.playerId,
      data: { playerId: info.playerId },
    });

    // Check for eliminated players
    for (const pid of playerIds) {
      const health = this.resources.getValue(pid, "health");
      if (health !== undefined && health <= 0) {
        const player = this.state.getCurrentState().players.get(pid);
        if (player && player.status === "alive") {
          await this.emitAndApply({
            type: EventType.PLAYER_ELIMINATED,
            target: pid,
            data: { playerId: pid },
          });
        }
      }
    }
  }

  /**
   * Play a card from a player's hand.
   */
  async playCard(
    playerId: PlayerId,
    cardInstanceId: CardInstanceId,
    targets?: PlayerId[]
  ): Promise<void> {
    await this.emitAndApply({
      type: EventType.CARD_PLAYED,
      source: playerId,
      data: { cardId: cardInstanceId, playerId, targets },
    });
  }

  /**
   * Draw cards for a player.
   */
  async drawCard(
    playerId: PlayerId,
    cardId: CardInstanceId
  ): Promise<void> {
    await this.emitAndApply({
      type: EventType.CARD_DRAWN,
      source: playerId,
      data: { cardId, playerId },
    });
  }

  /**
   * Respond to an event. Uses emitAndApply for state tracking.
   */
  async respondToEvent(eventId: string, response: EventResponse): Promise<void> {
    await this.emitAndApply({
      type: EventType.RESPONSE_GIVEN,
      source: response.playerId,
      data: { eventId, response },
    });
  }

  /**
   * Get current game state (full).
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
   * Emit an event through the full pipeline: push to stack, apply to state, then emit.
   * State is updated first so handlers see the latest data.
   */
  private async emitAndApply(
    eventData: Omit<GameEvent, "id" | "timestamp" | "stackDepth" | "type"> & { type: EventTypeValue }
  ): Promise<void> {
    const event = this.eventStack.push(eventData as Omit<GameEvent, "id" | "timestamp" | "stackDepth"> & { type: string });
    this.state.applyEvent(event);
    await this.eventBus.emit(event);
  }
}