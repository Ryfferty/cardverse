import {
  type GameState,
  type GameEvent,
  type PlayerState,
  type PlayerId,
  type ZoneState,
  type ZoneId,
  EventType,
} from "@cardverse/shared";

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
    // Hide other players' hand cards
    for (const [pid, player] of state.players) {
      if (pid !== playerId) {
        // Replace hand cards with count only
        const handZone = player.zones.get("hand");
        if (handZone) {
          handZone.cards = []; // Hide actual cards
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
        return player.zones.get(zoneId);
      }
    }
    // Fallback: check all player zones
    for (const [, player] of state.players) {
      const zone = player.zones.get(zoneId);
      if (zone) return zone;
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
        newState.winner = event.data.winner as string;
        newState.winCondition = event.data.winCondition as string;
        break;

      case EventType.TURN_START:
        newState.currentTurn = {
          playerId: event.data.playerId as string,
          phaseIndex: 0,
          phaseId: event.data.phaseId as string || "",
          turnNumber: newState.turnNumber,
        };
        break;

      case EventType.PHASE_START:
        if (newState.currentTurn) {
          newState.currentTurn.phaseIndex = event.data.phaseIndex as number || 0;
          newState.currentTurn.phaseId = event.data.phaseId as string || "";
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
        const player = newState.players.get(playerId as string);
        if (player) {
          const resource = player.resources.get(resourceId as string);
          if (resource) {
            resource.current = newValue as number;
          }
        }
        break;
      }

      // Card events affect zone state
      case EventType.CARD_PLAYED: {
        const { cardId, playerId } = event.data;
        const player = newState.players.get(playerId as string);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            const index = handZone.cards.indexOf(cardId as string);
            if (index !== -1) {
              handZone.cards.splice(index, 1);
            }
          }
        }
        break;
      }

      case EventType.CARD_DRAWN: {
        const { cardId, playerId } = event.data;
        const player = newState.players.get(playerId as string);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            handZone.cards.push(cardId as string);
          }
          player.handCount = handZone ? handZone.cards.length : player.handCount;
        }
        // Remove from deck
        const deckZone = newState.globalZones.get("deck");
        if (deckZone) {
          const index = deckZone.cards.indexOf(cardId as string);
          if (index !== -1) {
            deckZone.cards.splice(index, 1);
          }
        }
        break;
      }

      case EventType.CARD_DISCARDED: {
        const { cardId, playerId } = event.data;
        const player = newState.players.get(playerId as string);
        if (player) {
          const handZone = player.zones.get("hand");
          if (handZone) {
            const index = handZone.cards.indexOf(cardId as string);
            if (index !== -1) {
              handZone.cards.splice(index, 1);
            }
          }
          player.handCount = handZone ? handZone.cards.length : player.handCount;
        }
        // Add to discard pile
        const discardZone = newState.globalZones.get("discard");
        if (discardZone) {
          discardZone.cards.push(cardId as string);
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

        // Remove from source zone
        const sourceZone = StateManager.findZone(newState, fromZone as ZoneId, fromPlayer as PlayerId);
        if (sourceZone) {
          const index = sourceZone.cards.indexOf(cardId as string);
          if (index !== -1) {
            sourceZone.cards.splice(index, 1);
          }
        }

        // Add to target zone
        const targetZone = StateManager.findZone(newState, toZone as ZoneId, toPlayer as PlayerId);
        if (targetZone) {
          targetZone.cards.push(cardId as string);
        }

        // Update hand count if necessary
        if (fromZone === "hand" && fromPlayer) {
          const fromP = newState.players.get(fromPlayer as PlayerId);
          if (fromP) {
            const hand = fromP.zones.get("hand");
            fromP.handCount = hand ? hand.cards.length : fromP.handCount;
          }
        }
        if (toZone === "hand" && toPlayer) {
          const toP = newState.players.get(toPlayer as PlayerId);
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
        const targetPlayerId = event.target || event.data.playerId as string;
        const player = newState.players.get(targetPlayerId);
        if (player) {
          player.status = "dead";
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
