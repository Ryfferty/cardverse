import {
  type GameConfig,
  type GameState,
  type GameEvent,
  type PlayerState,
  type PlayerId,
  type ZoneDefinition,
  type ResourceDefinition,
  type PhaseDefinition,
  type CardDefinition,
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
import { EffectExecutor, type ExecutorDependencies, type EffectExecutionResult } from "./effectExecutor.js";
import type { EffectDefinition } from "@cardverse/deck";
import { RangeManager, type RangeModifiers } from "./range.js";

let gameIdCounter = 0;

export class Game {
  readonly config: GameConfig;
  readonly eventBus: EventBus;
  readonly eventStack: EventStack;
  readonly state: StateManager;
  readonly zones: ZoneManager;
  readonly phases: PhaseManager;
  readonly resources: ResourceManager;
  readonly effectExecutor: EffectExecutor;

  private maxEffectSteps: number;
  private responseTimeout: number;
  private reconnectTimeout: number;
  private effects: Map<string, EffectDefinition> = new Map();
  private cardDefinitions: Map<string, CardDefinition> = new Map();
  private playerSeats: Map<PlayerId, number> = new Map();
  private seatCounter = 0;

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
    this.effectExecutor = new EffectExecutor(this.createExecutorDeps());
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

    this.playerSeats.set(playerId, this.seatCounter++);

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
   * Auto-executes draw and discard phase logic.
   */
  async nextPhase(gameStateOverride?: Record<string, unknown>): Promise<boolean> {
    const oldPhase = this.phases.getCurrentPhase();
    const phase = this.phases.nextPhase(gameStateOverride);
    if (!phase) {
      return false;
    }

    const currentPlayerId = this.phases.getTurnInfo()?.playerId;

    if (oldPhase?.auto && currentPlayerId) {
      if (oldPhase.id === "draw") {
        await this.autoDrawPhase(currentPlayerId);
      }
      if (oldPhase.id === "discard") {
        await this.autoDiscardPhase(currentPlayerId);
      }
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

  private async autoDrawPhase(playerId: PlayerId): Promise<void> {
    await this.drawCards(playerId, 2);
  }

  private async autoDiscardPhase(playerId: PlayerId): Promise<void> {
    const handCards = this.getPlayerHandCards(playerId);
    const health = this.resources.getValue(playerId, "health") ?? 0;
    const excess = handCards.length - health;

    if (excess <= 0) return;

    const toDiscard = handCards.slice(0, excess);
    for (const cardId of toDiscard) {
      await this.discardCard(playerId, cardId);
    }
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
   * Automatically executes all effects defined on the card.
   */
  async playCard(
    playerId: PlayerId,
    cardInstanceId: CardInstanceId,
    targets?: PlayerId[]
  ): Promise<EffectExecutionResult[]> {
    const state = this.getState();
    const player = state.players.get(playerId);
    if (!player) throw new Error(`Player "${playerId}" not found`);

    const cardType = this.resolveCardType(cardInstanceId);

    if (cardType === "sha" && targets && targets.length > 0) {
      for (const target of targets) {
        if (!this.validateRange(playerId, target)) {
          throw new Error(
            `Target "${target}" is out of attack range of "${playerId}"`
          );
        }
      }
    }

    const event: GameEvent = {
      id: `card_played_${Date.now()}_${cardInstanceId}`,
      type: EventType.CARD_PLAYED,
      source: playerId,
      data: { cardId: cardInstanceId, playerId, targets, cardType },
      timestamp: Date.now(),
      stackDepth: 0,
    };

    await this.emitAndApply(event);

    const cardEffects = this.lookupEffects(cardInstanceId);
    if (cardEffects.length === 0) return [];

    return this.effectExecutor.executeCard(cardEffects, {
      playerId,
      playerName: player.name,
      targets,
      cardId: cardInstanceId,
      event,
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

  async drawCards(playerId: PlayerId, count: number): Promise<CardInstanceId[]> {
    const state = this.getState();
    const deckZone = state.globalZones.get("deck");
    if (!deckZone) return [];

    const drawn: CardInstanceId[] = [];
    for (let i = 0; i < count && deckZone.cards.length > 0; i++) {
      const cardId = deckZone.cards[0];
      deckZone.cards.splice(0, 1);
      drawn.push(cardId);
      await this.drawCard(playerId, cardId);
    }

    return drawn;
  }

  async discardCard(playerId: PlayerId, cardId: CardInstanceId): Promise<void> {
    await this.emitAndApply({
      type: EventType.CARD_DISCARDED,
      source: playerId,
      data: { cardId, playerId },
    });
  }

  getPlayerHandCards(playerId: PlayerId): CardInstanceId[] {
    const state = this.getState();
    const player = state.players.get(playerId);
    if (!player) return [];

    const handZone = player.zones.get("hand");
    return handZone ? [...handZone.cards] : [];
  }

  getPlayerHandCount(playerId: PlayerId): number {
    return this.getPlayerHandCards(playerId).length;
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

  getCardType(cardInstanceId: CardInstanceId): string {
    return this.resolveCardType(cardInstanceId);
  }

  getPlayerSeatIndex(playerId: PlayerId): number {
    return this.playerSeats.get(playerId) ?? -1;
  }

  getEquipmentCards(playerId: PlayerId): string[] {
    const state = this.getState();
    const player = state.players.get(playerId);
    if (!player) return [];

    const equipZone = player.zones.get("equipment");
    if (!equipZone) return [];

    return [...equipZone.cards];
  }

  getPlayerRangeModifiers(playerId: PlayerId): RangeModifiers {
    const equipCardIds = this.getEquipmentCards(playerId);
    const equipDefs = RangeManager.resolveEquipmentCards(equipCardIds, this.cardDefinitions);
    return RangeManager.getEquipmentModifiers(equipDefs);
  }

  getTotalPlayerCount(): number {
    return this.playerSeats.size;
  }

  validateRange(attackerId: PlayerId, targetId: PlayerId): boolean {
    const attackerSeat = this.getPlayerSeatIndex(attackerId);
    const targetSeat = this.getPlayerSeatIndex(targetId);
    if (attackerSeat < 0 || targetSeat < 0) return false;

    const totalPlayers = this.getTotalPlayerCount();
    const baseDistance = RangeManager.calculateDistance(attackerSeat, targetSeat, totalPlayers);
    const modifiers = this.getPlayerRangeModifiers(attackerId);

    return RangeManager.isInRange(
      baseDistance,
      modifiers.weaponRange,
      modifiers.mountOffense,
      modifiers.mountDefense
    );
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
   * Register effect definitions (from a loaded deck).
   */
  setEffects(effects: Map<string, EffectDefinition>): void {
    this.effects = effects;
  }

  setCardDefinitions(definitions: Map<string, CardDefinition>): void {
    this.cardDefinitions = definitions;
  }

  /**
   * Look up effects for a specific card instance.
   */
  private lookupEffects(cardInstanceId: CardInstanceId): EffectDefinition[] {
    const state = this.getState();
    for (const [, player] of state.players) {
      for (const [, zone] of player.zones) {
        const idx = zone.cards.indexOf(cardInstanceId);
        if (idx >= 0) return this.resolveEffects(cardInstanceId);
      }
    }
    for (const [, zone] of state.globalZones) {
      const idx = zone.cards.indexOf(cardInstanceId);
      if (idx >= 0) return this.resolveEffects(cardInstanceId);
    }
    return [];
  }

  private resolveEffects(cardInstanceId: CardInstanceId): EffectDefinition[] {
    const result: EffectDefinition[] = [];
    if (!this.effects) return result;
    for (const [, effect] of this.effects) {
      result.push(effect);
    }
    return result;
  }

  private resolveCardType(cardInstanceId: CardInstanceId): string {
    const defId = this.extractDefinitionId(cardInstanceId);
    const cardDef = this.cardDefinitions.get(defId);
    if (!cardDef) return "unknown";
    if (cardDef.category === "basic") return cardDef.id;
    if (cardDef.category === "equipment") return "equipment";
    return cardDef.id;
  }

  private extractDefinitionId(cardInstanceId: CardInstanceId): string {
    const parts = cardInstanceId.split("_");
    if (parts.length >= 2) return parts[1];
    return cardInstanceId;
  }

  /**
   * Create the ExecutorDependencies adapter from this Game instance.
   */
  private createExecutorDeps(): ExecutorDependencies {
    return {
      eventBus: {
        emit: (event) => this.eventBus.emit(event),
        requestResponse: (eventType, event, timeoutMs) =>
          this.eventBus.requestResponse(eventType, event, timeoutMs),
      },
      state: {
        getCurrentState: () => this.state.getCurrentState(),
        applyEvent: (event) => this.state.applyEvent(event),
      },
      resources: {
        getValue: (playerId, resourceId) =>
          this.resources.getValue(playerId, resourceId),
        setValue: async (playerId, resourceId, value) => {
          await this.resources.set(playerId, resourceId, value);
        },
      },
      zones: {
        getCards: (zoneId) => this.zones.getCards(zoneId),
      },
      emitAndApply: (eventData) =>
        this.emitAndApply(eventData as Omit<GameEvent, "id" | "timestamp" | "stackDepth"> & { type: string }),
      getState: () => this.state.getCurrentState(),
    };
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