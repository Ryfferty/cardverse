import { describe, it, expect, beforeEach } from "vitest";
import { Game } from "./engine";
import { EventType } from "@cardverse/shared";
import type {
  GameConfig,
  ZoneDefinition,
  ResourceDefinition,
  PhaseDefinition,
  PlayerState,
  EventResponse,
} from "@cardverse/shared";

function createConfig(overrides?: Partial<GameConfig>): GameConfig {
  return {
    deckId: "test_deck",
    playerCount: 4,
    ...overrides,
  };
}

const deckZoneDef: ZoneDefinition = {
  id: "deck",
  name: "Deck",
  visibility: "none",
  ordered: true,
  maxSize: 52,
  faceDown: true,
  owner: "global",
};

const discardZoneDef: ZoneDefinition = {
  id: "discard",
  name: "Discard",
  visibility: "all",
  ordered: false,
  maxSize: 200,
  faceDown: false,
  owner: "global",
};

const handZoneDef: ZoneDefinition = {
  id: "hand",
  name: "Hand",
  visibility: "owner",
  ordered: true,
  maxSize: 10,
  faceDown: false,
  owner: "player",
};

const healthDef: ResourceDefinition = {
  id: "health",
  name: "Health",
  defaultValue: 3,
  min: 0,
  max: 5,
};

const manaDef: ResourceDefinition = {
  id: "mana",
  name: "Mana",
  defaultValue: 1,
  min: 0,
  max: 10,
  regenPerTurn: 1,
};

const testPhases: PhaseDefinition[] = [
  { id: "prepare", name: "准备", auto: true },
  { id: "draw", name: "摸牌", auto: true },
  { id: "play", name: "出牌", auto: false },
  { id: "discard", name: "弃牌", auto: true },
  { id: "end", name: "结束", auto: true },
];

function setupTwoPlayerGame(): Game {
  const game = Game.create(createConfig());

  game.initZones([deckZoneDef, discardZoneDef]);
  game.initResources([healthDef, manaDef]);

  const p1 = game.addPlayer("p1", "Alice");
  const p2 = game.addPlayer("p2", "Bob");

  game.initPlayerZones("p1", [handZoneDef]);
  game.initPlayerZones("p2", [handZoneDef]);

  // Set up zones directly in state via StateManager setup methods
  game.state.setPlayerZone("p1", "hand", {
    definition: handZoneDef,
    cards: ["card1", "card2", "card3"],
    playerId: "p1",
  });
  game.state.setPlayerZone("p2", "hand", {
    definition: handZoneDef,
    cards: ["card4", "card5", "card6"],
    playerId: "p2",
  });

  game.state.setGlobalZone("deck", {
    definition: deckZoneDef,
    cards: ["card7", "card8", "card9"],
  });
  game.state.setGlobalZone("discard", {
    definition: discardZoneDef,
    cards: [],
  });

  game.state.updatePlayerHandCount("p1");
  game.state.updatePlayerHandCount("p2");

  // Init resources for both players
  game.resources.initResource("p1", "health");
  game.resources.initResource("p1", "mana");
  game.resources.initResource("p2", "health");
  game.resources.initResource("p2", "mana");

  return game;
}

describe("Game", () => {
  describe("create", () => {
    it("should create a new game in waiting status", () => {
      const game = Game.create(createConfig());
      const state = game.getState();

      expect(state.status).toBe("waiting");
      expect(state.players.size).toBe(0);
      expect(state.turnNumber).toBe(0);
      expect(state.eventLog).toEqual([]);
    });

    it("should have all subsystems initialized", () => {
      const game = Game.create(createConfig());

      expect(game.eventBus).toBeDefined();
      expect(game.eventStack).toBeDefined();
      expect(game.state).toBeDefined();
      expect(game.zones).toBeDefined();
      expect(game.phases).toBeDefined();
      expect(game.resources).toBeDefined();
    });
  });

  describe("addPlayer", () => {
    it("should add a player", () => {
      const game = Game.create(createConfig());
      const player = game.addPlayer("p1", "Alice");

      expect(player.id).toBe("p1");
      expect(player.name).toBe("Alice");
      expect(player.status).toBe("alive");
      expect(game.getState().players.size).toBe(1);
    });

    it("should add multiple players", () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");
      game.addPlayer("p3", "Charlie");

      expect(game.getState().players.size).toBe(3);
    });

    it("should throw when adding after game started", async () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");
      await game.start();

      expect(() => game.addPlayer("p3", "Charlie")).toThrow(
        "Cannot add players after game has started"
      );
    });
  });

  describe("init helpers", () => {
    it("should set up zones", () => {
      const game = Game.create(createConfig());
      game.initZones([deckZoneDef, discardZoneDef]);

      expect(game.zones.getZone("global:deck")).toBeDefined();
      expect(game.zones.getZone("global:discard")).toBeDefined();
    });

    it("should set up player zones", () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");
      game.initPlayerZones("p1", [handZoneDef]);

      expect(game.zones.getZone("player:p1:hand")).toBeDefined();
    });

    it("should set up resources", () => {
      const game = Game.create(createConfig());
      game.initResources([healthDef, manaDef]);

      expect(game.resources.getDefinition("health")).toEqual(healthDef);
      expect(game.resources.getDefinition("mana")).toEqual(manaDef);
    });

    it("should set up phases", () => {
      const game = Game.create(createConfig());
      game.initPhases(testPhases);

      expect(game.phases.getPhaseCount()).toBe(5);
      expect(game.phases.getCurrentPhase()?.id).toBe("prepare");
    });
  });

  describe("start", () => {
    it("should start the game", async () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");

      await game.start();

      expect(game.getState().status).toBe("running");
      expect(game.getEventLog()).toHaveLength(1);
    });

    it("should throw with less than 2 players", async () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");

      await expect(game.start()).rejects.toThrow("Need at least 2 players");
    });

    it("should throw with 0 players", async () => {
      const game = Game.create(createConfig());

      await expect(game.start()).rejects.toThrow("Need at least 2 players");
    });
  });

  describe("end", () => {
    it("should end the game with winner", async () => {
      const game = Game.create(createConfig());
      game.addPlayer("p1", "Alice");
      game.addPlayer("p2", "Bob");
      await game.start();

      await game.end("p1", "elimination");

      const state = game.getState();
      expect(state.status).toBe("finished");
      expect(state.winner).toBe("p1");
      expect(state.winCondition).toBe("elimination");
    });
  });

  describe("playCard", () => {
    it("should emit CARD_PLAYED event and remove card from hand", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      await game.playCard("p1", "card1", ["p2"]);

      // Check card was removed from hand
      const state = game.getState();
      const p1Hand = state.players.get("p1")?.zones.get("hand");
      expect(p1Hand?.cards).not.toContain("card1");
      expect(p1Hand?.cards).toEqual(["card2", "card3"]);
    });

    it("should include targets and cardType in event data", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      const cardDefs = new Map<string, import("@cardverse/shared").CardDefinition>();
      cardDefs.set("card1", { id: "sha", name: "杀", category: "basic" });
      game.setCardDefinitions(cardDefs);

      let capturedData: any;
      game.eventBus.on("*", async (event) => {
        if (event.type === EventType.CARD_PLAYED) {
          capturedData = event.data;
        }
      });

      await game.playCard("p1", "card1", ["p2"]);

      expect(capturedData).toBeDefined();
      expect(capturedData.cardId).toBe("card1");
      expect(capturedData.playerId).toBe("p1");
      expect(capturedData.targets).toEqual(["p2"]);
      expect(capturedData.cardType).toBeDefined();
    });

    it("should resolve cardType from card definitions", async () => {
      const game = setupTwoPlayerGame();
      const cardDefs = new Map<string, import("@cardverse/shared").CardDefinition>();
      cardDefs.set("sha", { id: "sha", name: "杀", category: "basic" });
      cardDefs.set("tao", { id: "tao", name: "桃", category: "basic" });
      cardDefs.set("shan", { id: "shan", name: "闪", category: "basic" });
      cardDefs.set("zhugeliannu", { id: "zhugeliannu", name: "诸葛连弩", category: "equipment" });
      cardDefs.set("nanman", { id: "nanman", name: "南蛮入侵", category: "trick" });
      game.setCardDefinitions(cardDefs);

      expect(game.getCardType("inst_sha_1")).toBe("sha");
      expect(game.getCardType("inst_tao_5")).toBe("tao");
      expect(game.getCardType("inst_shan_3")).toBe("shan");
      expect(game.getCardType("inst_zhugeliannu_1")).toBe("equipment");
      expect(game.getCardType("inst_nanman_1")).toBe("nanman");
      expect(game.getCardType("inst_unknown_1")).toBe("unknown");
    });
  });

  describe("drawCard", () => {
    it("should draw card from deck to hand", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      await game.drawCard("p1", "card7");

      const state = game.getState();
      const p1Hand = state.players.get("p1")?.zones.get("hand");
      expect(p1Hand?.cards).toContain("card7");

      const deck = state.globalZones.get("deck");
      expect(deck?.cards).not.toContain("card7");
    });
  });

  describe("respondToEvent", () => {
    it("should emit RESPONSE_GIVEN through event pipeline", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      let capturedType: any;
      game.eventBus.on("*", async (event) => {
        capturedType = event.type;
      });

      const response: EventResponse = {
        playerId: "p2",
        cardId: "card5",
        action: "play",
      };

      await game.respondToEvent("evt_123", response);

      expect(capturedType).toBe(EventType.RESPONSE_GIVEN);
      expect(game.getEventLog().length).toBeGreaterThanOrEqual(1);
    });

    it("should push response event to stack", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      const response: EventResponse = {
        playerId: "p2",
        action: "respond",
      };

      await game.respondToEvent("evt_123", response);

      expect(game.eventStack.size()).toBeGreaterThanOrEqual(1);
    });
  });

  describe("turn flow", () => {
    it("should start and end a complete turn", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      await game.startTurn("p1");

      const state = game.getState();
      expect(state.currentTurn).toBeDefined();
      expect(state.currentTurn?.playerId).toBe("p1");

      await game.nextPhase(); // prepare → draw
      expect(game.phases.getCurrentPhase()?.id).toBe("draw");

      await game.nextPhase(); // draw → play
      expect(game.phases.getCurrentPhase()?.id).toBe("play");

      await game.nextPhase(); // play → discard
      expect(game.phases.getCurrentPhase()?.id).toBe("discard");

      await game.nextPhase(); // discard → end
      expect(game.phases.getCurrentPhase()?.id).toBe("end");

      await game.nextPhase(); // end → complete
      expect(game.phases.isTurnComplete()).toBe(true);

      await game.endTurn();
      const finalState = game.getState();
      expect(finalState.turnNumber).toBeGreaterThanOrEqual(1);
    });

    it("should apply regen at end of turn", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      // Spend mana
      await game.resources.modify("p1", "mana", -1);
      expect(game.resources.getValue("p1", "mana")).toBe(0);

      await game.startTurn("p1");
      for (let i = 0; i < testPhases.length; i++) {
        await game.nextPhase();
      }
      await game.endTurn();

      // mana should have regenerated (regenPerTurn = 1)
      expect(game.resources.getValue("p1", "mana")).toBe(1);
      expect(game.resources.getValue("p2", "mana")).toBe(2);
    });
  });

  describe("getStateForPlayer", () => {
    it("should hide other players' hand cards", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      const p1View = game.getStateForPlayer("p1");

      // P1 can see own hand
      const p1Hand = p1View.players.get("p1")?.zones.get("hand");
      expect(p1Hand?.cards).toHaveLength(3);

      // P1 cannot see P2's hand cards
      const p2Hand = p1View.players.get("p2")?.zones.get("hand");
      expect(p2Hand?.cards).toEqual([]);

      // But handCount should still be visible
      expect(p1View.players.get("p2")?.handCount).toBe(3);
    });

    it("should hide face-down global zones", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      const p1View = game.getStateForPlayer("p1");
      const deck = p1View.globalZones.get("deck");
      expect(deck?.cards).toEqual([]); // face-down, hidden

      const discard = p1View.globalZones.get("discard");
      expect(discard?.cards).toEqual([]); // face-up but empty
    });
  });

  describe("error handling", () => {
    it("should handle playing card for non-existent player", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      // Playing card from non-existent player should throw
      await expect(game.playCard("p99", "card_x")).rejects.toThrow(
        'Player "p99" not found'
      );
    });

    it("should handle playing card not in hand", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      // Playing card not in hand — state shouldn't crash
      await game.playCard("p1", "nonexistent_card");

      const state = game.getState();
      const hand = state.players.get("p1")?.zones.get("hand");
      expect(hand?.cards).toHaveLength(3); // unchanged
    });
  });

  describe("range system", () => {
    it("should track seat indices", () => {
      const game = setupTwoPlayerGame();

      expect(game.getPlayerSeatIndex("p1")).toBe(0);
      expect(game.getPlayerSeatIndex("p2")).toBe(1);
      expect(game.getPlayerSeatIndex("nonexistent")).toBe(-1);
    });

    it("should return empty equipment for players with no equipment", () => {
      const game = setupTwoPlayerGame();

      expect(game.getEquipmentCards("p1")).toEqual([]);
    });

    it("should return default range modifiers with no equipment", () => {
      const game = setupTwoPlayerGame();

      const mod = game.getPlayerRangeModifiers("p1");
      expect(mod.weaponRange).toBe(1);
      expect(mod.mountOffense).toBe(0);
      expect(mod.mountDefense).toBe(0);
    });

    it("should validate range for adjacent players in 2-player game", () => {
      const game = setupTwoPlayerGame();

      expect(game.validateRange("p1", "p2")).toBe(true);
      expect(game.validateRange("p2", "p1")).toBe(true);
    });

    it("should validate range for adjacent players in 4-player game", () => {
      const game = Game.create(createConfig({ playerCount: 4 }));
      game.addPlayer("p1", "Player1");
      game.addPlayer("p2", "Player2");
      game.addPlayer("p3", "Player3");
      game.addPlayer("p4", "Player4");

      expect(game.validateRange("p1", "p2")).toBe(true);
      expect(game.validateRange("p1", "p4")).toBe(true);
      expect(game.validateRange("p2", "p3")).toBe(true);
    });

    it("should fail range validation for opposite players in 4-player game", () => {
      const game = Game.create(createConfig({ playerCount: 4 }));
      game.addPlayer("p1", "Player1");
      game.addPlayer("p2", "Player2");
      game.addPlayer("p3", "Player3");
      game.addPlayer("p4", "Player4");

      expect(game.validateRange("p1", "p3")).toBe(false);
      expect(game.validateRange("p2", "p4")).toBe(false);
    });

    it("should not apply range validation for non-sha cards", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      game.initZones([deckZoneDef, discardZoneDef]);
      game.initPlayerZones("p1", [handZoneDef]);

      const cardDefs = new Map<string, import("@cardverse/shared").CardDefinition>();
      cardDefs.set("tao", { id: "tao", name: "桃", category: "basic" });
      game.setCardDefinitions(cardDefs);

      await game.start();

      await expect(
        game.playCard("p1", "inst_tao_1", ["p1"])
      ).resolves.toBeDefined();
    });

    it("should throw when sha target is out of range", async () => {
      const game = Game.create(createConfig({ playerCount: 4 }));
      game.addPlayer("p1", "Player1");
      game.addPlayer("p2", "Player2");
      game.addPlayer("p3", "Player3");
      game.addPlayer("p4", "Player4");

      game.initPhases(testPhases);
      game.initZones([deckZoneDef, discardZoneDef]);
      for (const pid of ["p1", "p2", "p3", "p4"]) {
        game.initPlayerZones(pid, [handZoneDef]);
      }

      const cardDefs = new Map<string, import("@cardverse/shared").CardDefinition>();
      cardDefs.set("sha", { id: "sha", name: "杀", category: "basic" });
      game.setCardDefinitions(cardDefs);

      await game.start();

      await expect(
        game.playCard("p1", "inst_sha_1", ["p3"])
      ).rejects.toThrow("out of attack range");
    });

    it("should allow sha against adjacent target", async () => {
      const game = Game.create(createConfig({ playerCount: 4 }));
      game.addPlayer("p1", "Player1");
      game.addPlayer("p2", "Player2");
      game.addPlayer("p3", "Player3");
      game.addPlayer("p4", "Player4");

      game.initPhases(testPhases);
      game.initZones([deckZoneDef, discardZoneDef]);
      for (const pid of ["p1", "p2", "p3", "p4"]) {
        game.initPlayerZones(pid, [handZoneDef]);
      }

      const cardDefs = new Map<string, import("@cardverse/shared").CardDefinition>();
      cardDefs.set("sha", { id: "sha", name: "杀", category: "basic" });
      game.setCardDefinitions(cardDefs);

      await game.start();

      await expect(
        game.playCard("p1", "inst_sha_1", ["p2"])
      ).resolves.toBeDefined();
    });
  });

  describe("integration", () => {
    it("should simulate a 2-turn game", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);

      // Start game
      await game.start();
      expect(game.getState().status).toBe("running");

      // === TURN 1: Player 1 ===
      await game.startTurn("p1");

      // Draw phase: p1 draws a card
      await game.drawCard("p1", "card7");
      expect(game.getState().players.get("p1")?.zones.get("hand")?.cards).toContain("card7");

      // Play phase: p1 plays card1 targeting p2
      await game.playCard("p1", "card1", ["p2"]);

      // P2 responds
      const response: EventResponse = {
        playerId: "p2",
        cardId: "card4",
        action: "play",
      };
      await game.respondToEvent("evt_1", response);

      // Advance through rest of phases
      while (await game.nextPhase()) { /* advance */ }
      expect(game.phases.isTurnComplete()).toBe(true);

      // End turn
      await game.endTurn();

      const finalState = game.getState();

      // P1 played one card, drew one
      const p1Final = finalState.players.get("p1");
      expect(p1Final?.zones.get("hand")?.cards).toHaveLength(3); // 3 - 1(played) + 1(drawn) = 3

      // P2 hasn't been eliminated
      expect(p1Final?.status).toBe("alive");

      // Event log should have entries
      expect(game.getEventLog().length).toBeGreaterThan(5);

      // Verify event log contains key events
      const logTypes = game.getEventLog().map((e) => e.type);
      expect(logTypes).toContain(EventType.GAME_START);
      expect(logTypes).toContain(EventType.CARD_PLAYED);
      expect(logTypes).toContain(EventType.CARD_DRAWN);
      expect(logTypes).toContain(EventType.TURN_START);
      expect(logTypes).toContain(EventType.TURN_END);
      expect(logTypes).toContain(EventType.RESPONSE_GIVEN);
    });

    it("should handle player elimination", async () => {
      const game = setupTwoPlayerGame();
      game.initPhases(testPhases);
      await game.start();

      // Deal lethal damage to p2
      await game.resources.set("p2", "health", 0);
      await game.resources.modify("p2", "health", -1); // clamped to 0

      await game.startTurn("p1");
      while (await game.nextPhase()) { /* advance */ }
      await game.endTurn();

      const state = game.getState();
      const p2 = state.players.get("p2");
      expect(p2?.status).toBe("dead");

      // Should have PLAYER_ELIMINATED event
      const logTypes = game.getEventLog().map((e) => e.type);
      expect(logTypes).toContain(EventType.PLAYER_ELIMINATED);
    });
  });
});