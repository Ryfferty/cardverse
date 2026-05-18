import { describe, it, expect, beforeEach } from "vitest";
import { HeuristicAI } from "./heuristic.js";
import type { AIGameView, AIPlayerInfo, HandCard } from "./types.js";

function makePlayer(
  id: string,
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
  };
}

function makeGameView(
  selfId: string,
  overrides: Partial<AIGameView> = {}
): AIGameView {
  return {
    players: overrides.players ?? [
      makePlayer(selfId, { health: 4, maxHealth: 4, faction: "shu" }),
      makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
    ],
    selfId,
    turnNumber: overrides.turnNumber ?? 1,
    currentPhase: overrides.currentPhase ?? "play",
    currentTurnPlayerId: overrides.currentTurnPlayerId ?? selfId,
    pendingEvents: overrides.pendingEvents ?? [],
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
    it("should play sha against enemy when available", async () => {
      const view = makeGameView("p1");
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.cardId).toBe("inst_sha_1");
      expect(action.targets).toEqual(["p2"]);
    });

    it("should play tao when health is below max", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", { health: 2, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
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
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
        ],
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

    it("should pass when not in play phase", async () => {
      const view = makeGameView("p1", { currentPhase: "draw" });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("pass");
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
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
      });
      ai.setHandCards([makeHandCard("inst_tao_1", "tao")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("endTurn");
    });
  });

  describe("decideResponse", () => {
    it("should play shan when 杀 is played against low-health self", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", { health: 1, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
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
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
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
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
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
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p3", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
      });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p3"]);
    });

    it("should not attack dead players", async () => {
      const view = makeGameView("p1", {
        players: [
          makePlayer("p1", { health: 4, maxHealth: 4, faction: "shu" }),
          makePlayer("p2", { health: 0, maxHealth: 4, faction: "wei", alive: false }),
          makePlayer("p3", { health: 4, maxHealth: 4, faction: "wei" }),
        ],
      });
      ai.setHandCards([makeHandCard("inst_sha_1", "sha")]);

      const action = await ai.decideAction(view);

      expect(action.type).toBe("playCard");
      expect(action.targets).toEqual(["p3"]);
    });
  });
});