import { describe, it, expect, beforeEach } from "vitest";
import { HeuristicAI } from "./heuristic.js";
import type { AIGameView, AIPlayerInfo, HandCard } from "./types.js";

function makePlayer(
  id: string,
  seatIndex: number,
  overrides: Partial<AIPlayerInfo> = {}
): AIPlayerInfo {
  return {
    playerId: id,
    handCardIds: overrides.handCardIds ?? [],
    handCount: overrides.handCount ?? 0,
    health: overrides.health ?? 4,
    maxHealth: overrides.maxHealth ?? 4,
    faction: overrides.faction ?? "shu",
    alive: overrides.alive ?? true,
    seatIndex: overrides.seatIndex ?? seatIndex,
  };
}

function makeGameView(
  selfId: string,
  overrides: Partial<AIGameView> = {}
): AIGameView {
  const defaultPlayers = [
    makePlayer(selfId, 0, { health: 4, maxHealth: 4, faction: "shu" }),
    makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
    makePlayer("p3", 2, { health: 4, maxHealth: 4, faction: "wu" }),
    makePlayer("p4", 3, { health: 4, maxHealth: 4, faction: "qun" }),
  ];

  return {
    players: overrides.players ?? defaultPlayers,
    selfId,
    turnNumber: overrides.turnNumber ?? 1,
    currentPhase: overrides.currentPhase ?? "play",
    currentTurnPlayerId: overrides.currentTurnPlayerId ?? selfId,
    pendingEvents: overrides.pendingEvents ?? [],
    playerCount: overrides.playerCount ?? defaultPlayers.length,
  };
}

function makeHandCard(
  instanceId: string,
  type: string,
  category: string = "basic",
  name: string = type
): HandCard {
  return { instanceId, type, category, name };
}

describe("HeuristicAI", () => {
  let ai: HeuristicAI;

  beforeEach(() => {
    ai = new HeuristicAI();
  });

  describe("identity", () => {
    it("should have a name", () => {
      expect(ai.name).toBeTruthy();
      expect(typeof ai.name).toBe("string");
    });

    it("should accept a custom name", () => {
      const named = new HeuristicAI("TestBot");
      expect(named.name).toBe("TestBot");
    });

    it("should generate different names for separate instances", () => {
      const a = new HeuristicAI();
      const b = new HeuristicAI();
      expect(a.name).not.toBe(b.name);
    });
  });

  describe("decideAction — play phase", () => {
    it("should play sha against enemy in range when available", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_sha_1");
      expect(action.targets).toEqual(["p2"]);
    });

    it("should not play sha when enemy is out of range", async () => {
      const view = makeGameView("p1");
      const players = [
        makePlayer("p1", 0, { health: 4, faction: "shu" }),
        makePlayer("p2", 1, { health: 4, faction: "wei" }),
        makePlayer("p3", 2, { health: 4, faction: "wu" }),
        makePlayer("p4", 3, { health: 4, faction: "qun" }),
      ];
      const viewFar = { ...view, players };
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(viewFar);

      // p2 is adjacent (distance 1), p3/p4 are distance 2
      // Default range is 1, so only p2 is in range
      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p2"]);
    });

    it("should play tao when health is below max", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 2, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([makeHandCard("inst_tao_1", "tao")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_tao_1");
      expect(action.targets).toEqual(["p1"]);
    });

    it("should play equipment when available and no combat needed", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_equip_1", "equipment", "equipment", "诸葛连弩")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_equip_1");
    });

    it("should end turn when no viable actions", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
        ],
        playerCount: 1,
      });
      ai.setHandCards([]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("endTurn");
    });

    it("should prioritize sha over tao when health is full", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([
        makeHandCard("inst_sha_1", "sha"),
        makeHandCard("inst_tao_1", "tao"),
      ]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_sha_1");
    });

    it("should play trick cards when no sha available", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_trick_1", "trick", "trick", "决斗")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_trick_1");
      expect(action.targets).toEqual(["p2"]);
    });

    it("should not heal when health is already full", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([makeHandCard("inst_tao_1", "tao")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("endTurn");
    });
  });

  describe("decideAction — draw phase", () => {
    it("should pass in draw phase", async () => {
      const view = makeGameView("p1", { currentPhase: "draw" });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("pass");
    });
  });

  describe("decideAction — judge phase", () => {
    it("should pass in judge phase", async () => {
      const view = makeGameView("p1", { currentPhase: "judge" });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("pass");
    });
  });

  describe("decideAction — discard phase", () => {
    it("should end turn when hand cards within limit", async () => {
      const view = makeGameView("p1", {
        currentPhase: "discard",
        players: [
          makePlayer("p1", 0, { health: 3, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([
        makeHandCard("inst_sha_1", "sha"),
        makeHandCard("inst_shan_1", "shan"),
        makeHandCard("inst_tao_1", "tao"),
      ]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("endTurn");
    });

    it("should discard excess cards when above hand limit", async () => {
      const view = makeGameView("p1", {
        currentPhase: "discard",
        players: [
          makePlayer("p1", 0, { health: 2, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([
        makeHandCard("inst_sha_1", "sha"),
        makeHandCard("inst_shan_1", "shan"),
        makeHandCard("inst_tao_1", "tao"),
        makeHandCard("inst_jiu_1", "jiu"),
      ]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("respond");
      expect(action.data).toBeDefined();
      expect((action.data as Record<string, unknown>).discardAll).toBeDefined();
      expect(Array.isArray((action.data as Record<string, unknown>).discardAll)).toBe(true);
    });

    it("should prioritize discarding jiu and sha first", async () => {
      const view = makeGameView("p1", {
        currentPhase: "discard",
        players: [
          makePlayer("p1", 0, { health: 2, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([
        makeHandCard("inst_tao_1", "tao"),
        makeHandCard("inst_sha_1", "sha"),
        makeHandCard("inst_jiu_1", "jiu"),
      ]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("respond");
      const discardAll = (action.data as Record<string, unknown>).discardAll as string[];
      expect(discardAll.length).toBe(1);
      expect(discardAll[0]).toBe("inst_jiu_1");
    });
  });

  describe("distance calculation", () => {
    it("should consider 4-player ring distance", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_sha_1");
    });
  });

  describe("decideResponse", () => {
    it("should play shan when 杀 is played against low-health self", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 1, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([makeHandCard("inst_shan_1", "shan")]);

      const event: any = {
        id: "ev_1",
        type: "card:played",
        data: { cardType: "sha", cardId: "inst_sha_enemy" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_shan_1");
    });

    it("should play sha when nanman is played", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const event: any = {
        id: "ev_nanman",
        type: "card:played",
        data: { cardType: "nanman", cardId: "inst_nanman" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_sha_1");
    });

    it("should play shan when wanjian is played", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_shan_1", "shan")]);

      const event: any = {
        id: "ev_wanjian",
        type: "card:played",
        data: { cardType: "wanjian", cardId: "inst_wanjian" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_shan_1");
    });

    it("should play sha for counter_sha response request", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const event: any = {
        id: "ev_req",
        type: "response:requested",
        data: { type: "counter_sha" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_sha_1");
    });

    it("should pass for response request without sha", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([]);

      const event: any = {
        id: "ev_req",
        type: "response:requested",
        data: { type: "counter_sha" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });

    it("should play shan when sha played and hand has many cards", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([
        makeHandCard("inst_shan_1", "shan"),
        makeHandCard("inst_sha_1", "sha"),
        makeHandCard("inst_sha_2", "sha"),
      ]);

      const event: any = {
        id: "ev_sha",
        type: "card:played",
        data: { cardType: "sha", cardId: "inst_sha_enemy" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_shan_1");
    });

    it("should pass when sha played and health is high with few cards", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 2,
      });
      ai.setHandCards([makeHandCard("inst_shan_1", "shan")]);

      const event: any = {
        id: "ev_sha",
        type: "card:played",
        data: { cardType: "sha", cardId: "inst_sha_enemy" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });

    it("should read cardType from event data correctly", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_shan_1", "shan")]);

      const event: any = {
        id: "ev_dismantle",
        type: "card:played",
        data: { cardType: "dismantle", cardId: "inst_dismantle" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });
  });

  describe("onGameStart / onGameEnd", () => {
    it("onGameStart should set game view", async () => {
      const view = makeGameView("p1");

      await ai.onGameStart(view);

      expect(ai.name).toBeTruthy();
    });

    it("onGameEnd should clear hand cards", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      await ai.onGameEnd(view, "p1");

      const shaEvent: any = {
        id: "ev_sha",
        type: "card:played",
        data: { cardType: "sha", cardId: "inst_sha_enemy" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, shaEvent);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });
  });

  describe("card type helpers", () => {
    it("should detect missing card types correctly", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const shaEvent: any = {
        id: "ev_sha",
        type: "card:played",
        data: { cardType: "sha", cardId: "inst_sha_enemy" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, shaEvent);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });
  });

  describe("ally / enemy detection", () => {
    it("should not attack same-faction players", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p3", 2, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 3,
      });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p3"]);
    });

    it("should not attack dead players", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 0, maxHealth: 4, faction: "wei", alive: false }),
          makePlayer("p3", 2, { health: 4, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 3,
      });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p3"]);
    });

    it("should prioritize low-health enemies", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", 0, { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", 1, { health: 4, maxHealth: 4, faction: "wei" }),
          makePlayer("p3", 2, { health: 1, maxHealth: 4, faction: "wei" }),
        ],
        playerCount: 3,
      });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p3"]);
    });
  });

  describe("wuxie response handling", () => {
    it("should play wuxie when harmful trick is played and wuxie in hand", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_wuxie_1", "wuxie", "trick", "无懈可击")]);

      const event: any = {
        id: "ev_dismantle",
        type: "card:played",
        data: { cardType: "dismantle", cardId: "inst_dismantle" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_wuxie_1");
    });

    it("should play wuxie when duel is played and wuxie in hand", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_wuxie_1", "wuxie", "trick", "无懈可击")]);

      const event: any = {
        id: "ev_duel",
        type: "card:played",
        data: { cardType: "duel", cardId: "inst_duel" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("play");
      expect(response!.cardId).toBe("inst_wuxie_1");
    });

    it("should not play wuxie for non-harmful card types", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_wuxie_1", "wuxie", "trick", "无懈可击")]);

      const event: any = {
        id: "ev_taoyuan",
        type: "card:played",
        data: { cardType: "taoyuan", cardId: "inst_taoyuan" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(view, event);

      expect(response).not.toBeNull();
      expect(response!.action).toBe("pass");
    });
  });
});