import { describe, it, expect, beforeEach } from "vitest";
import { PhaseManager } from "./phases";
import type { PhaseDefinition } from "@cardverse/shared";

describe("PhaseManager", () => {
  let manager: PhaseManager;

  const standardPhases: PhaseDefinition[] = [
    { id: "prepare", name: "准备阶段", auto: true },
    { id: "judge", name: "判定阶段", auto: true },
    { id: "draw", name: "摸牌阶段", auto: true },
    { id: "play", name: "出牌阶段", auto: false },
    { id: "discard", name: "弃牌阶段", auto: true },
    { id: "end", name: "结束阶段", auto: true },
  ];

  const dynamicPhases: PhaseDefinition[] = [
    { id: "prepare", name: "准备阶段", auto: true },
    {
      id: "extra_draw",
      name: "额外摸牌阶段",
      auto: true,
      condition: "hasExtraDraw",
    },
    { id: "draw", name: "摸牌阶段", auto: true },
    {
      id: "bonus_phase",
      name: "奖励阶段",
      auto: false,
      condition: "bonusUnlocked",
    },
    { id: "play", name: "出牌阶段", auto: false },
    { id: "discard", name: "弃牌阶段", auto: true },
    { id: "end", name: "结束阶段", auto: true },
  ];
  describe("setPhases", () => {
    it("should set phases and reset index", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      expect(manager.getPhaseCount()).toBe(6);
      expect(manager.getCurrentPhaseIndex()).toBe(0);
      expect(manager.getCurrentPhase()?.id).toBe("prepare");
    });

    it("should replace previously set phases", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      manager.setPhases([
        { id: "custom", name: "自定义阶段", auto: true },
      ]);
      expect(manager.getPhaseCount()).toBe(1);
      expect(manager.getCurrentPhaseIndex()).toBe(0);
    });
  });

  describe("getCurrentPhase", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should return the first phase initially", () => {
      expect(manager.getCurrentPhase()?.id).toBe("prepare");
    });

    it("should return undefined when past all phases", () => {
      for (let i = 0; i < standardPhases.length; i++) {
        manager.skipPhase();
      }
      expect(manager.getCurrentPhase()).toBeUndefined();
      expect(manager.isTurnComplete()).toBe(true);
    });
  });

  describe("startTurn", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should set player ID and turn number", () => {
      manager.startTurn("player1", 3);
      expect(manager.getCurrentPhaseIndex()).toBe(0);
      const info = manager.getTurnInfo();
      expect(info?.playerId).toBe("player1");
      expect(info?.turnNumber).toBe(3);
      expect(info?.phaseId).toBe("prepare");
    });

    it("should reset current index on new turn", () => {
      manager.startTurn("player1", 1);
      manager.skipPhase();
      manager.skipPhase();
      expect(manager.getCurrentPhaseIndex()).toBe(2);
      manager.startTurn("player2", 2);
      expect(manager.getCurrentPhaseIndex()).toBe(0);
      expect(manager.getCurrentPhase()?.id).toBe("prepare");
    });
  });

  describe("getTurnInfo", () => {
    it("should return undefined when no phases set", () => {
      manager = new PhaseManager();
      expect(manager.getTurnInfo()).toBeUndefined();
    });

    it("should return correct turn info", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      manager.startTurn("player1", 5);
      const info = manager.getTurnInfo();
      expect(info).toBeDefined();
      expect(info?.playerId).toBe("player1");
      expect(info?.turnNumber).toBe(5);
      expect(info?.phaseIndex).toBe(0);
      expect(info?.phaseId).toBe("prepare");
    });
  });

  describe("nextPhase", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should advance to the next phase", () => {
      const next = manager.nextPhase();
      expect(next?.id).toBe("judge");
      expect(manager.getCurrentPhaseIndex()).toBe(1);
    });

    it("should return undefined when no more phases", () => {
      for (let i = 0; i < standardPhases.length - 1; i++) {
        manager.nextPhase();
      }
      const last = manager.nextPhase();
      expect(last).toBeUndefined();
    });

    it("should skip phases whose condition evaluates to false", () => {
      manager.setPhases(dynamicPhases);
      // prepare (index 0) → extra_draw (index 1, condition: hasExtraDraw)
      // Should skip extra_draw if condition is false
      const next = manager.nextPhase({ hasExtraDraw: false });
      expect(next?.id).toBe("draw");
      expect(manager.getCurrentPhaseIndex()).toBe(2);
    });

    it("should not skip phases whose condition evaluates to true", () => {
      manager.setPhases(dynamicPhases);
      const next = manager.nextPhase({ hasExtraDraw: true });
      expect(next?.id).toBe("extra_draw");
      expect(manager.getCurrentPhaseIndex()).toBe(1);
    });

    it("should advance through multiple conditional phases", () => {
      manager.setPhases(dynamicPhases);
      // prepare (0) → extra_draw(1) → draw(2) → bonus_phase(3) → play(4)
      manager.nextPhase({ hasExtraDraw: false }); // skip to draw (2)
      expect(manager.getCurrentPhase()?.id).toBe("draw");

      manager.nextPhase({ bonusUnlocked: false }); // skip to play (4)
      expect(manager.getCurrentPhase()?.id).toBe("play");
      expect(manager.getCurrentPhaseIndex()).toBe(4);
    });
  });

  describe("skipPhase", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should skip the current phase and advance", () => {
      const result = manager.skipPhase();
      expect(result).toBe(true);
      expect(manager.getCurrentPhaseIndex()).toBe(1);
      expect(manager.getCurrentPhase()?.id).toBe("judge");
    });

    it("should return false when no phases left", () => {
      for (let i = 0; i < standardPhases.length; i++) {
        manager.skipPhase();
      }
      const result = manager.skipPhase();
      expect(result).toBe(false);
    });

    it("should skip multiple phases", () => {
      manager.skipPhase();
      manager.skipPhase();
      expect(manager.getCurrentPhase()?.id).toBe("draw");
    });

    it("should skip conditional phases that evaluate false", () => {
      manager.setPhases(dynamicPhases);
      // prepare(0) → skip → judge(1) → draw(2) → skip(false) → play(4)
      manager.skipPhase(); // prepare → judge
      manager.skipPhase(); // judge → draw
      manager.skipPhase({ extraDrawEnabled: false }); // draw → skip extra_draw(condition false) → skip bonus_phase(condition false) → play
      expect(manager.getCurrentPhase()?.id).toBe("play");
      expect(manager.getCurrentPhaseIndex()).toBe(4);
    });

    it("should not skip conditional phases that evaluate true", () => {
      manager.setPhases(dynamicPhases);
      // Start from prepare(0), skipPhase with gameState → arrives at extra_draw(1) (condition true)
      manager.skipPhase({ hasExtraDraw: true });
      expect(manager.getCurrentPhase()?.id).toBe("extra_draw");
      expect(manager.getCurrentPhaseIndex()).toBe(1);
    });
  });

  describe("isTurnComplete", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should return false at start of turn", () => {
      expect(manager.isTurnComplete()).toBe(false);
    });

    it("should return true after all phases", () => {
      for (let i = 0; i < standardPhases.length; i++) {
        manager.skipPhase();
      }
      expect(manager.isTurnComplete()).toBe(true);
    });

    it("should return false in the middle of turn", () => {
      manager.skipPhase();
      manager.skipPhase();
      expect(manager.isTurnComplete()).toBe(false);
    });
  });

  describe("getAllPhases", () => {
    it("should return all phases as a copy", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      const phases = manager.getAllPhases();
      expect(phases).toHaveLength(standardPhases.length);
      expect(phases).toEqual(standardPhases);
      expect(phases).not.toBe(standardPhases);
    });

    it("should return empty array when no phases set", () => {
      manager = new PhaseManager();
      expect(manager.getAllPhases()).toEqual([]);
    });
  });

  describe("getPhaseCount", () => {
    it("should return correct count", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      expect(manager.getPhaseCount()).toBe(6);
    });

    it("should return 0 when no phases set", () => {
      manager = new PhaseManager();
      expect(manager.getPhaseCount()).toBe(0);
    });
  });

  describe("reset", () => {
    it("should clear all phases and reset state", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      manager.startTurn("player1", 3);
      manager.skipPhase();
      manager.reset();

      expect(manager.getPhaseCount()).toBe(0);
      expect(manager.getCurrentPhaseIndex()).toBe(0);
      expect(manager.getCurrentPhase()).toBeUndefined();
      expect(manager.isTurnComplete()).toBe(true);
    });
  });

  describe("goToPhase", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should jump to the specified phase index", () => {
      const phase = manager.goToPhase(3);
      expect(phase?.id).toBe("play");
      expect(manager.getCurrentPhaseIndex()).toBe(3);
    });

    it("should return undefined for negative index", () => {
      const phase = manager.goToPhase(-1);
      expect(phase).toBeUndefined();
    });

    it("should return undefined for out-of-bounds index", () => {
      const phase = manager.goToPhase(999);
      expect(phase).toBeUndefined();
    });

    it("should jump to last phase", () => {
      const phase = manager.goToPhase(standardPhases.length - 1);
      expect(phase?.id).toBe("end");
    });
  });

  describe("getRemainingPhases", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(dynamicPhases);
    });

    it("should return all phases after current", () => {
      manager.goToPhase(3); // bonus_phase with condition
      const remaining = manager.getRemainingPhases({ bonusUnlocked: false, hasExtraDraw: false });
      const ids = remaining.map((p) => p.id);
      expect(ids).toEqual(["play", "discard", "end"]);
    });

    it("should include remaining phases that match condition", () => {
      manager.goToPhase(2); // draw (before bonus_phase)
      const remaining = manager.getRemainingPhases({ bonusUnlocked: true });
      const ids = remaining.map((p) => p.id);
      expect(ids).toContain("bonus_phase");
      expect(ids).toContain("play");
    });

    it("should return empty when no phases remain", () => {
      manager.goToPhase(dynamicPhases.length - 1);
      const remaining = manager.getRemainingPhases();
      expect(remaining).toEqual([]);
    });

    it("should include all phases when no gameState provided", () => {
      manager.goToPhase(0);
      const remaining = manager.getRemainingPhases();
      const ids = remaining.map((p) => p.id);
      // Without gameState, all phases are included (can't evaluate conditions)
      expect(ids).toContain("extra_draw");
      expect(ids).toContain("draw");
      expect(ids).toContain("bonus_phase");
      expect(ids).toContain("play");
      expect(ids).toContain("discard");
      expect(ids).toContain("end");
    });
  });

  describe("hasPhase", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should return true for existing phase", () => {
      expect(manager.hasPhase("draw")).toBe(true);
      expect(manager.hasPhase("play")).toBe(true);
    });

    it("should return false for non-existent phase", () => {
      expect(manager.hasPhase("nonexistent")).toBe(false);
    });
  });

  describe("getPhaseById", () => {
    beforeEach(() => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
    });

    it("should return phase by ID", () => {
      const phase = manager.getPhaseById("draw");
      expect(phase?.name).toBe("摸牌阶段");
    });

    it("should return undefined for non-existent ID", () => {
      const phase = manager.getPhaseById("fake");
      expect(phase).toBeUndefined();
    });
  });

  describe("hasActivePhase", () => {
    it("should return true when phases set and index valid", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      expect(manager.hasActivePhase()).toBe(true);
    });

    it("should return false when no phases set", () => {
      manager = new PhaseManager();
      expect(manager.hasActivePhase()).toBe(false);
    });

    it("should return false when past last phase", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      for (let i = 0; i < standardPhases.length; i++) {
        manager.nextPhase();
      }
      expect(manager.hasActivePhase()).toBe(false);
    });
  });

  describe("Integration", () => {
    it("should simulate a full two-turn game flow", () => {
      manager = new PhaseManager();

      // Define phases for the game
      const gamePhases: PhaseDefinition[] = [
        { id: "prepare", name: "准备", auto: true },
        { id: "judge", name: "判定", auto: true },
        { id: "draw", name: "摸牌", auto: true },
        {
          id: "extra_draw",
          name: "额外摸牌",
          auto: true,
          condition: "extraDrawEnabled",
        },
        { id: "play", name: "出牌", auto: false },
        { id: "discard", name: "弃牌", auto: true },
        { id: "end", name: "结束", auto: true },
      ];

      manager.setPhases(gamePhases);

      // Turn 1: Player 1, no extra draw
      manager.startTurn("p1", 1);
      expect(manager.getCurrentPhase()?.id).toBe("prepare");

      manager.nextPhase(); // prepare → judge
      expect(manager.getCurrentPhase()?.id).toBe("judge");

      manager.nextPhase(); // judge → draw
      expect(manager.getCurrentPhase()?.id).toBe("draw");

      manager.nextPhase({ extraDrawEnabled: false }); // draw → skip extra_draw → play
      expect(manager.getCurrentPhase()?.id).toBe("play");

      manager.nextPhase(); // play → discard
      expect(manager.getCurrentPhase()?.id).toBe("discard");

      manager.nextPhase(); // discard → end
      expect(manager.getCurrentPhase()?.id).toBe("end");

      manager.nextPhase(); // end → complete
      expect(manager.isTurnComplete()).toBe(true);

      // Turn 2: Player 2, with extra draw
      manager.startTurn("p2", 2);
      expect(manager.getCurrentPhase()?.id).toBe("prepare");

      manager.nextPhase({ extraDrawEnabled: true }); // prepare → judge
      expect(manager.getCurrentPhase()?.id).toBe("judge");

      manager.nextPhase({ extraDrawEnabled: true }); // judge → draw
      expect(manager.getCurrentPhase()?.id).toBe("draw");

      manager.nextPhase({ extraDrawEnabled: true }); // draw → extra_draw (condition: extraDrawEnabled true)
      expect(manager.getCurrentPhase()?.id).toBe("extra_draw");

      // Check remaining phases from extra_draw
      const remaining = manager.getRemainingPhases({ extraDrawEnabled: true });
      const remainingIds = remaining.map((p) => p.id);
      expect(remainingIds).toEqual(["play", "discard", "end"]);

      // Skip to discard
      manager.skipPhase({ extraDrawEnabled: true }); // extra_draw → play
      manager.skipPhase({ extraDrawEnabled: true }); // play → discard
      expect(manager.getCurrentPhase()?.id).toBe("discard");

      // Jump to end with goToPhase
      const endPhase = manager.goToPhase(gamePhases.length - 1);
      expect(endPhase?.id).toBe("end");
    });

    it("should handle the reset and reuse cycle", () => {
      manager = new PhaseManager();
      manager.setPhases(standardPhases);
      manager.startTurn("p1", 1);
      manager.skipPhase();
      manager.skipPhase();

      // Reset
      manager.reset();
      expect(manager.getPhaseCount()).toBe(0);

      // Reuse
      manager.setPhases(standardPhases);
      manager.startTurn("p2", 1);
      expect(manager.getCurrentPhase()?.id).toBe("prepare");
    });
  });
});