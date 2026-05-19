import { describe, it, expect } from "vitest";
import { StateManager } from "./state";
import {
  type GameState,
  type GameEvent,
  type PlayerState,
  type ZoneDefinition,
  type ResourceDefinition,
  type EventTypeValue,
  EventType,
} from "@cardverse/shared";

describe("StateManager", () => {
  // Helper to create initial state
  const createInitialState = (): GameState => {
    // Zone definitions
    const deckZoneDef: ZoneDefinition = {
      id: "deck",
      name: "Deck",
      visibility: "none",
      ordered: true,
      faceDown: true,
      owner: "global",
    };

    const discardZoneDef: ZoneDefinition = {
      id: "discard",
      name: "Discard",
      visibility: "all",
      ordered: true,
      faceDown: false,
      owner: "global",
    };

    const handZoneDef: ZoneDefinition = {
      id: "hand",
      name: "Hand",
      visibility: "owner",
      ordered: true,
      faceDown: false,
      owner: "player",
    };

    // Resource definitions
    const _healthResDef: ResourceDefinition = {
      id: "health",
      name: "Health",
      defaultValue: 3,
      min: 0,
      max: 5,
    };

    const _manaResDef: ResourceDefinition = {
      id: "mana",
      name: "Mana",
      defaultValue: 1,
      min: 0,
      max: 10,
      regenPerTurn: 1,
    };

    // Create player 1
    const player1: PlayerState = {
      id: "player1",
      name: "Player 1",
      status: "alive",
      zones: new Map(),
      resources: new Map(),
      handCount: 3,
      faction: "team1",
    };

    player1.zones.set("hand", {
      definition: handZoneDef,
      cards: ["card1", "card2", "card3"],
      playerId: "player1",
    });

    player1.resources.set("health", {
      definitionId: "health",
      current: 3,
      min: 0,
      max: 5,
    });

    player1.resources.set("mana", {
      definitionId: "mana",
      current: 1,
      min: 0,
      max: 10,
    });

    // Create player 2
    const player2: PlayerState = {
      id: "player2",
      name: "Player 2",
      status: "alive",
      zones: new Map(),
      resources: new Map(),
      handCount: 3,
      faction: "team2",
    };

    player2.zones.set("hand", {
      definition: handZoneDef,
      cards: ["card4", "card5", "card6"],
      playerId: "player2",
    });

    player2.resources.set("health", {
      definitionId: "health",
      current: 3,
      min: 0,
      max: 5,
    });

    player2.resources.set("mana", {
      definitionId: "mana",
      current: 1,
      min: 0,
      max: 10,
    });

    // Create game state
    const globalZones = new Map();
    globalZones.set("deck", {
      definition: deckZoneDef,
      cards: ["card7", "card8", "card9", "card10"],
    });
    globalZones.set("discard", {
      definition: discardZoneDef,
      cards: [],
    });

    const players = new Map();
    players.set("player1", player1);
    players.set("player2", player2);

    return {
      gameId: "test-game",
      status: "waiting",
      players,
      globalZones,
      turnNumber: 1,
      eventLog: [],
    };
  };

  // Helper to create event
  const createEvent = (
    type: EventTypeValue,
    data: Record<string, unknown>,
    source?: string,
    target?: string
  ): GameEvent => ({
    id: `event-${Date.now()}-${Math.random()}`,
    type,
    source,
    target,
    data,
    timestamp: Date.now(),
    stackDepth: 0,
  });

  describe("Initialization", () => {
    it("should initialize with the given state", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const currentState = manager.getCurrentState();
      expect(currentState.gameId).toBe("test-game");
      expect(currentState.players.size).toBe(2);
      expect(currentState.globalZones.size).toBe(2);
    });

    it("should return a clone of the current state", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const state1 = manager.getCurrentState();
      const state2 = manager.getCurrentState();

      expect(state1).not.toBe(state2);
      expect(state1).toEqual(state2);
    });

    it("should initialize with empty event log", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const log = manager.getEventLog();
      expect(log).toEqual([]);
    });
  });

  describe("Game Lifecycle Events", () => {
    it("should handle GAME_START event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.GAME_START, {});
      const newState = manager.applyEvent(event);

      expect(newState.status).toBe("running");
      expect(manager.getEventLog()).toHaveLength(1);
    });

    it("should handle GAME_END event with winner", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.GAME_END, {
        winner: "player1",
        winCondition: "elimination",
      });
      const newState = manager.applyEvent(event);

      expect(newState.status).toBe("finished");
      expect(newState.winner).toBe("player1");
      expect(newState.winCondition).toBe("elimination");
    });
  });

  describe("Turn and Phase Events", () => {
    it("should handle TURN_START event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.TURN_START, {
        playerId: "player1",
        phaseId: "main",
      });
      const newState = manager.applyEvent(event);

      expect(newState.currentTurn?.playerId).toBe("player1");
      expect(newState.currentTurn?.phaseIndex).toBe(0);
      expect(newState.currentTurn?.phaseId).toBe("main");
      expect(newState.currentTurn?.turnNumber).toBe(1);
    });

    it("should handle PHASE_START event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      // First start turn
      manager.applyEvent(
        createEvent(EventType.TURN_START, {
          playerId: "player1",
          phaseId: "draw",
        })
      );

      // Then start phase
      const event = createEvent(EventType.PHASE_START, {
        phaseIndex: 1,
        phaseId: "main",
      });
      const newState = manager.applyEvent(event);

      expect(newState.currentTurn?.phaseIndex).toBe(1);
      expect(newState.currentTurn?.phaseId).toBe("main");
    });

    it("should handle TURN_END event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      // Start turn first
      manager.applyEvent(
        createEvent(EventType.TURN_START, {
          playerId: "player1",
          phaseId: "main",
        })
      );

      const event = createEvent(EventType.TURN_END, {});
      const newState = manager.applyEvent(event);

      expect(newState.turnNumber).toBe(2);
      expect(newState.currentTurn).toBeUndefined();
    });
  });

  describe("Resource Events", () => {
    it("should handle RESOURCE_CHANGED event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.RESOURCE_CHANGED, {
        playerId: "player1",
        resourceId: "health",
        newValue: 2,
      });
      const newState = manager.applyEvent(event);

      const player1 = newState.players.get("player1");
      expect(player1?.resources.get("health")?.current).toBe(2);
    });

    it("should not change state for non-existent player", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.RESOURCE_CHANGED, {
        playerId: "player99",
        resourceId: "health",
        newValue: 2,
      });
      const newState = manager.applyEvent(event);

      // State should be the same
      expect(newState.players.get("player1")?.resources.get("health")?.current).toBe(3);
    });

    it("should not change state for non-existent resource", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.RESOURCE_CHANGED, {
        playerId: "player1",
        resourceId: "nonexistent",
        newValue: 2,
      });
      const newState = manager.applyEvent(event);

      // State should be the same
      expect(newState.players.get("player1")?.resources.get("health")?.current).toBe(3);
    });
  });

  describe("Card Events", () => {
    it("should handle CARD_PLAYED event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.CARD_PLAYED, {
        cardId: "card1",
        playerId: "player1",
      });
      const newState = manager.applyEvent(event);

      const player1 = newState.players.get("player1");
      const handZone = player1?.zones.get("hand");
      expect(handZone?.cards).not.toContain("card1");
    });

    it("should handle CARD_DRAWN event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.CARD_DRAWN, {
        cardId: "card7",
        playerId: "player1",
      });
      const newState = manager.applyEvent(event);

      // Check card moved from deck to hand
      const deckZone = newState.globalZones.get("deck");
      expect(deckZone?.cards).not.toContain("card7");

      const player1 = newState.players.get("player1");
      const handZone = player1?.zones.get("hand");
      expect(handZone?.cards).toContain("card7");
      expect(player1?.handCount).toBe(4);
    });

    it("should handle CARD_DISCARDED event", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.CARD_DISCARDED, {
        cardId: "card1",
        playerId: "player1",
      });
      const newState = manager.applyEvent(event);

      // Check card moved from hand to discard
      const player1 = newState.players.get("player1");
      const handZone = player1?.zones.get("hand");
      expect(handZone?.cards).not.toContain("card1");
      expect(player1?.handCount).toBe(2);

      const discardZone = newState.globalZones.get("discard");
      expect(discardZone?.cards).toContain("card1");
    });

    it("should handle CARD_MOVED event between player zones", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.CARD_MOVED, {
        cardId: "card1",
        fromZone: "hand",
        toZone: "hand",
        fromPlayer: "player1",
        toPlayer: "player2",
      });
      const newState = manager.applyEvent(event);

      // Check card moved
      const player1 = newState.players.get("player1");
      const hand1 = player1?.zones.get("hand");
      expect(hand1?.cards).not.toContain("card1");
      expect(player1?.handCount).toBe(2);

      const player2 = newState.players.get("player2");
      const hand2 = player2?.zones.get("hand");
      expect(hand2?.cards).toContain("card1");
      expect(player2?.handCount).toBe(4);
    });

    it("should handle CARD_MOVED event from global to player zone", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.CARD_MOVED, {
        cardId: "card7",
        fromZone: "deck",
        toZone: "hand",
        toPlayer: "player1",
      });
      const newState = manager.applyEvent(event);

      const deck = newState.globalZones.get("deck");
      expect(deck?.cards).not.toContain("card7");

      const player1 = newState.players.get("player1");
      const hand = player1?.zones.get("hand");
      expect(hand?.cards).toContain("card7");
    });
  });

  describe("Player Events", () => {
    it("should handle PLAYER_ELIMINATED event with data.playerId", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.PLAYER_ELIMINATED, {
        playerId: "player2",
      });
      const newState = manager.applyEvent(event);

      const player2 = newState.players.get("player2");
      expect(player2?.status).toBe("dead");
    });

    it("should handle PLAYER_ELIMINATED event with target", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(
        EventType.PLAYER_ELIMINATED,
        {},
        undefined,
        "player2"
      );
      const newState = manager.applyEvent(event);

      const player2 = newState.players.get("player2");
      expect(player2?.status).toBe("dead");
    });
  });

  describe("Other Events", () => {
    it("should log but not modify state for DAMAGE_DEALT", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);
      const stateBefore = manager.getCurrentState();

      const event = createEvent(EventType.DAMAGE_DEALT, {
        damage: 1,
      });
      const newState = manager.applyEvent(event);

      expect(newState).toEqual(stateBefore);
      expect(manager.getEventLog()).toHaveLength(1);
    });

    it("should log but not modify state for DAMAGE_TAKEN", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.DAMAGE_TAKEN, {
        damage: 1,
      });
      manager.applyEvent(event);

      expect(manager.getEventLog()).toHaveLength(1);
    });

    it("should log but not modify state for HEAL_RECEIVED", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.HEAL_RECEIVED, {
        amount: 1,
      });
      manager.applyEvent(event);

      expect(manager.getEventLog()).toHaveLength(1);
    });

    it("should log but not modify state for RESPONSE_REQUESTED", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const event = createEvent(EventType.RESPONSE_REQUESTED, {
        requestId: "req1",
      });
      manager.applyEvent(event);

      expect(manager.getEventLog()).toHaveLength(1);
    });

    it("should handle unknown event types gracefully", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);
      const stateBefore = manager.getCurrentState();

      const event = createEvent("unknown:event" as EventTypeValue, {});
      const newState = manager.applyEvent(event);

      expect(newState).toEqual(stateBefore);
      expect(manager.getEventLog()).toHaveLength(1);
    });
  });

  describe("getStateForPlayer", () => {
    it("should hide other players' hand cards", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const filteredState = manager.getStateForPlayer("player1");

      // Player 1's hand should be visible
      const player1 = filteredState.players.get("player1");
      expect(player1?.zones.get("hand")?.cards).toEqual(["card1", "card2", "card3"]);

      // Player 2's hand should be hidden
      const player2 = filteredState.players.get("player2");
      expect(player2?.zones.get("hand")?.cards).toEqual([]);
    });

    it("should preserve opponent handCount for visibility", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const filteredState = manager.getStateForPlayer("player1");

      // Player 2's hand cards are hidden, but handCount remains
      const player2 = filteredState.players.get("player2");
      expect(player2?.zones.get("hand")?.cards).toEqual([]);
      expect(player2?.handCount).toBe(3);
    });

    it("should hide face-down global zones", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      const filteredState = manager.getStateForPlayer("player1");

      // Deck (face-down) should be hidden
      const deck = filteredState.globalZones.get("deck");
      expect(deck?.cards).toEqual([]);

      // Discard (face-up) should be visible
      const discard = filteredState.globalZones.get("discard");
      expect(discard?.cards).toEqual([]);
    });
  });

  describe("replay", () => {
    it("should replay events to reconstruct state", () => {
      const initialState = createInitialState();
      const events: GameEvent[] = [
        createEvent(EventType.GAME_START, {}),
        createEvent(EventType.TURN_START, {
          playerId: "player1",
          phaseId: "main",
        }),
        createEvent(EventType.RESOURCE_CHANGED, {
          playerId: "player1",
          resourceId: "health",
          newValue: 2,
        }),
      ];

      const replayedState = StateManager.replay(initialState, events);

      expect(replayedState.status).toBe("running");
      expect(replayedState.currentTurn?.playerId).toBe("player1");
      expect(replayedState.players.get("player1")?.resources.get("health")?.current).toBe(2);
    });

    it("should handle empty event list", () => {
      const initialState = createInitialState();
      const replayedState = StateManager.replay(initialState, []);

      expect(replayedState).toEqual(initialState);
    });

    it("should replay card events correctly", () => {
      const initialState = createInitialState();
      const events: GameEvent[] = [
        createEvent(EventType.CARD_PLAYED, {
          cardId: "card1",
          playerId: "player1",
        }),
        createEvent(EventType.CARD_DISCARDED, {
          cardId: "card2",
          playerId: "player1",
        }),
      ];

      const replayedState = StateManager.replay(initialState, events);

      const player1 = replayedState.players.get("player1");
      expect(player1?.zones.get("hand")?.cards).toEqual(["card3"]);
      expect(player1?.handCount).toBe(1);

      const discard = replayedState.globalZones.get("discard");
      expect(discard?.cards).toEqual(["card2"]);
    });
  });

  describe("Integration", () => {
    it("should handle a sequence of events correctly", () => {
      const initialState = createInitialState();
      const manager = new StateManager(initialState);

      // Sequence of events
      manager.applyEvent(createEvent(EventType.GAME_START, {}));
      manager.applyEvent(
        createEvent(EventType.TURN_START, {
          playerId: "player1",
          phaseId: "draw",
        })
      );
      manager.applyEvent(
        createEvent(EventType.PHASE_START, {
          phaseIndex: 0,
          phaseId: "draw",
        })
      );
      manager.applyEvent(
        createEvent(EventType.CARD_DRAWN, {
          cardId: "card7",
          playerId: "player1",
        })
      );
      manager.applyEvent(
        createEvent(EventType.PHASE_START, {
          phaseIndex: 1,
          phaseId: "main",
        })
      );
      manager.applyEvent(
        createEvent(EventType.RESOURCE_CHANGED, {
          playerId: "player1",
          resourceId: "mana",
          newValue: 2,
        })
      );
      manager.applyEvent(
        createEvent(EventType.CARD_PLAYED, {
          cardId: "card7",
          playerId: "player1",
        })
      );
      manager.applyEvent(createEvent(EventType.PHASE_END, {}));
      manager.applyEvent(createEvent(EventType.TURN_END, {}));

      const finalState = manager.getCurrentState();
      expect(finalState.status).toBe("running");
      expect(finalState.turnNumber).toBe(2);
      expect(finalState.currentTurn).toBeUndefined();
      expect(manager.getEventLog()).toHaveLength(9);
    });
  });
});
