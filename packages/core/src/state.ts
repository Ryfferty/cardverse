import {
  type GameState,
  type GameEvent,
  type PlayerState,
  type PlayerId,
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
          phaseId: "",
          turnNumber: newState.turnNumber,
        };
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
      case EventType.CARD_MOVED: {
        const { cardId, fromZone, toZone } = event.data;
        // Remove from source zone
        // Add to target zone
        // Implementation delegated to subagent
        break;
      }

      case EventType.PLAYER_ELIMINATED: {
        const player = newState.players.get(event.target!);
        if (player) {
          player.status = "dead";
        }
        break;
      }

      // Other events are logged but don't auto-modify state
      default:
        break;
    }

    return newState;
  }
}
