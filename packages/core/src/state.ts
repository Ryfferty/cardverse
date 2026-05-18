import {
  type GameState,
  type GameEvent,
  type PlayerState,
  type PlayerId,
  type ZoneState,
  type ZoneId,
  EventType,
} from "@cardverse/shared";

function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") {
    console.warn(`StateManager: Expected ${field} to be string, got ${typeof value}`);
    return "";
  }
  return value;
}

function assertNumber(value: unknown, field: string): number {
  if (typeof value !== "number") {
    console.warn(`StateManager: Expected ${field} to be number, got ${typeof value}`);
    return 0;
  }
  return value;
}

/**
 * StateManager — manages game state via event log.
 * State is immutable: each applyEvent returns a new state.
 */
export class StateManager {
  private currentState: GameState;
  private eventLog: GameEvent[] = [];

  constructor(initialState: GameState) {
    this.currentState = structuredClone(initialState);
  }

  getCurrentState(): GameState {
    return structuredClone(this.currentState);
  }

  getEventLog(): GameEvent[] {
    return [...this.eventLog];
  }

  /**
   * Add a player during setup phase (before game starts).
   * Bypasses event sourcing for initialization.
   */
  addPlayer(player: PlayerState): void {
    this.currentState.players.set(player.id, player);
  }

  /**
   * Set a zone for a player during setup phase.
   */
  setPlayerZone(playerId: PlayerId, zoneId: string, zone: ZoneState): void {
    const player = this.currentState.players.get(playerId);
    if (player) {
      player.zones.set(zoneId, zone);
    }
  }

  /**
   * Set a global zone during setup phase.
   */
  setGlobalZone(zoneId: string, zone: ZoneState): void {
    this.currentState.globalZones.set(zoneId, zone);
  }

  /**
   * Update a player's hand count from their hand zone.
   */
  updatePlayerHandCount(playerId: PlayerId): void {
    const player = this.currentState.players.get(playerId);
    if (player) {
      const handZone = player.zones.get("hand");
      player.handCount = handZone ? handZone.cards.length : 0;
    }
  }

  /**
   * Apply an event, producing a new state.
   */
  applyEvent(event: GameEvent): GameState {
    this.eventLog.push(event);
    this.currentState = this.reduceState(this.currentState, event);
    return this.getCurrentState();
  }

  /**
   * Get state visible to a specific player (hide other players' hands, etc.)
   */
  getStateForPlayer(playerId: PlayerId): GameState {
    const state = this.getCurrentState();
    // Hide other players' hand cards but keep handCount visible
    for (const [pid, player] of state.players) {
      if (pid !== playerId) {
        const handZone = player.zones.get("hand");
        if (handZone) {
          handZone.cards = []; // Hide actual cards, handCount stays
        }
      }
    }
    // Hide global face-down zones
    for (const [, zone] of state.globalZones) {
      if (zone.definition.faceDown) {
        zone.cards = [];
      }
    }
    return state;
  }

  /**
   * Replay entire game from event log.
   */
  static replay(initialState: GameState, events: GameEvent[]): GameState {
    let state = structuredClone(initialState);
    for (const event of events) {
      state = StateManager.reduceStateStatic(state, event);
    }
    return state;
  }

  /**
   * Reduce: apply event to state, return new state.
   */
  private reduceState(state: GameState, event: GameEvent): GameState {
    return StateManager.reduceStateStatic(state, event);
  }

  /** Helper to find zone by ID, checking global then player zones. */
  private static findZone(
    state: GameState,
    zoneId: ZoneId,
    playerId?: PlayerId
  ): ZoneState | undefined {
    const globalZone = state.globalZones.get(zoneId);
    if (globalZone) return globalZone;
    if (playerId) {
      const player = state.players.get(playerId);
      if (player) {
        const zone = player.zones.get(zoneId);
        if (zone) return zone;
      }
    }
    // Fallback: check all player zones (log to catch ambiguous cases)
    for (const [pid, player] of state.players) {
      const zone = player.zones.get(zoneId);
      if (zone) {
        console.warn(
          `StateManager.findZone: zone "${zoneId}" found via fallback without explicit playerId. Found in player "${pid}".`
        );
        return zone;
      }
    }
    return undefined;
  }

  private static reduceStateStatic(state: GameState, event: GameEvent): GameState {
    // Deep clone for immutability
    const newState = structuredClone(state);

    switch (event.type) {
      case EventType.GAME_START:
        newState.status = "running";
        break;

      case EventType.GAME_END:
        newState.status = "finished";
        newState.winner = assertString(event.data.winner, "winner");
        newState.winCondition = assertString(event.data.winCondition, "winCondition");
        break;

      case EventType.TURN_START:
        newState.currentTurn = {
          playerId: assertString(event.data.playerId, "playerId"),
          phaseIndex: 0,
          phaseId: assertString(event.data.phaseId, "phaseId") || "",
          turnNumber: newState.turnNumber,
        };
        break;

      case EventType.PHASE_START:
        if (newState.currentTurn) {
          newState.currentTurn.phaseIndex = assertNumber(event.data.phaseIndex, "phaseIndex") || 0;
          newState.currentTurn.phaseId = assertString(event.data.phaseId, "phaseId") || "";
        }
        break;

      case EventType.PHASE_END:
        // Phase end doesn't modify state beyond logging
        break;

      case EventType.TURN_END:
        newState.turnNumber++;
        newState.currentTurn = undefined;
        break;

      case EventType.RESOURCE_CHANGED: {
        const { playerId, resourceId, newValue } = event.data;
        const pid = assertString(playerId, "playerId");
        const player = newState.players.get(pid);
        if (player) {
          const resource = player.resources.get(assertString(resourceId, "resourceId"));
          if (resource) {
            resource.current = assertNumber(newValue, "newValue");
          } else {
            console.warn(`StateManager: RESOURCE_CHANGED for unknown resource ${String(resourceId)}`);
          }
        } else {
          console.warn(`StateManager: RESOURCE_CHANGED for unknown player ${pid}`);
        }
        break;
      }

      case EventType.CARD_PLAYED: {
        const { cardId, playerId } = event.data;
        const pid = assertString(playerId, "playerId");
        const player = newState.players.get(pid);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            const index = handZone.cards.indexOf(assertString(cardId, "cardId"));
            if (index !== -1) {
              handZone.cards.splice(index, 1);
            }
          }
        } else {
          console.warn(`StateManager: CARD_PLAYED for unknown player ${pid}`);
        }
        break;
      }

      case EventType.CARD_DRAWN: {
        const { cardId, playerId } = event.data;
        const pid = assertString(playerId, "playerId");
        const cid = assertString(cardId, "cardId");
        const player = newState.players.get(pid);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            handZone.cards.push(cid);
          }
          player.handCount = handZone ? handZone.cards.length : player.handCount;
        } else {
          console.warn(`StateManager: CARD_DRAWN for unknown player ${pid}`);
        }
        const deckZone = newState.globalZones.get("deck");
        if (deckZone) {
          const index = deckZone.cards.indexOf(cid);
          if (index !== -1) {
            deckZone.cards.splice(index, 1);
          }
        }
        break;
      }

      case EventType.CARD_DISCARDED: {
        const { cardId, playerId } = event.data;
        const pid = assertString(playerId, "playerId");
        const cid = assertString(cardId, "cardId");
        const player = newState.players.get(pid);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            const index = handZone.cards.indexOf(cid);
            if (index !== -1) {
              handZone.cards.splice(index, 1);
            }
          }
          player.handCount = handZone ? handZone.cards.length : player.handCount;
        } else {
          console.warn(`StateManager: CARD_DISCARDED for unknown player ${pid}`);
        }
        const discardZone = newState.globalZones.get("discard");
        if (discardZone) {
          discardZone.cards.push(cid);
        }
        break;
      }

      case EventType.CARD_MOVED: {
        const {
          cardId,
          fromZone,
          toZone,
          fromPlayer,
          toPlayer
        } = event.data;

        const cid = assertString(cardId, "cardId");
        const fz = assertString(fromZone, "fromZone") as ZoneId;
        const tz = assertString(toZone, "toZone") as ZoneId;
        const fp = fromPlayer ? (assertString(fromPlayer, "fromPlayer") as PlayerId) : undefined;
        const tp = toPlayer ? (assertString(toPlayer, "toPlayer") as PlayerId) : undefined;

        // Remove from source zone — verify card exists first
        const sourceZone = StateManager.findZone(newState, fz, fp);
        if (sourceZone) {
          const index = sourceZone.cards.indexOf(cid);
          if (index === -1) break; // Card not in source, don't add to target
          sourceZone.cards.splice(index, 1);
        } else {
          break;
        }

        // Add to target zone
        const targetZone = StateManager.findZone(newState, tz, tp);
        if (targetZone) {
          targetZone.cards.push(cid);
        }

        // Update hand count if necessary
        if (fz === "hand" && fp) {
          const fromP = newState.players.get(fp);
          if (fromP) {
            const hand = fromP.zones.get("hand");
            fromP.handCount = hand ? hand.cards.length : fromP.handCount;
          }
        }
        if (tz === "hand" && tp) {
          const toP = newState.players.get(tp);
          if (toP) {
            const hand = toP.zones.get("hand");
            toP.handCount = hand ? hand.cards.length : toP.handCount;
          }
        }
        break;
      }

      case EventType.DAMAGE_DEALT:
      case EventType.DAMAGE_TAKEN:
        // Damage is logged, state updated via RESOURCE_CHANGED
        break;

      case EventType.HEAL_RECEIVED:
        // Heal is logged, state updated via RESOURCE_CHANGED
        break;

      case EventType.RESPONSE_REQUESTED:
      case EventType.RESPONSE_GIVEN:
      case EventType.RESPONSE_TIMEOUT:
        // Response events are logged but don't modify state directly
        break;

      case EventType.PLAYER_ELIMINATED: {
        const targetPlayerId = event.target || assertString(event.data.playerId, "playerId");
        const player = newState.players.get(targetPlayerId);
        if (player) {
          player.status = "dead";
        } else {
          console.warn(`StateManager: PLAYER_ELIMINATED for unknown player ${targetPlayerId}`);
        }
        break;
      }

      // All events are logged, some may trigger other handlers
      default:
        break;
    }

    return newState;
  }
}
