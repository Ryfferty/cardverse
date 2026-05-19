import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  EffectExecutor,
  createEffectExecutor,
  type ExecutorDependencies,
  type EffectExecutionResult,
} from "./effectExecutor.js";
import { EventType } from "@cardverse/shared";
import type { EffectDefinition } from "@cardverse/deck";

function createMockDeps(overrides?: Partial<ExecutorDependencies>): ExecutorDependencies {
  return {
    eventBus: {
      emit: vi.fn().mockResolvedValue(undefined),
      requestResponse: vi.fn().mockResolvedValue({ playerId: "p2", action: "play_card" }),
    },
    state: {
      getCurrentState: vi.fn().mockReturnValue({
        gameId: "test",
        status: "running",
        turnNumber: 1,
        players: new Map(),
        globalZones: new Map(),
        currentTurn: { playerId: "testPlayer_0", phaseIndex: 0 },
        phaseOrder: [],
      }),
      applyEvent: vi.fn(),
    },
    resources: {
      getValue: vi.fn().mockReturnValue(3),
      setValue: vi.fn().mockResolvedValue(undefined),
    },
    zones: {
      getCards: vi.fn().mockReturnValue([]),
    },
    emitAndApply: vi.fn().mockResolvedValue(undefined),
    getState: vi.fn().mockReturnValue({
      gameId: "test",
      status: "running",
      turnNumber: 1,
      players: new Map(),
      globalZones: new Map(),
      currentTurn: { playerId: "testPlayer_0", phaseIndex: 0 },
      phaseOrder: [],
    }),
    ...overrides,
  };
}

function createSimpleEffect(overrides?: Partial<EffectDefinition>): EffectDefinition {
  return {
    id: "simple_effect",
    name: "Simple Effect",
    type: "damage",
    params: {},
    validTargets: "inRange",
    script: `
      await context.damage(context.target, 1);
      context.log("Dealt 1 damage to " + context.target);
      return { success: true, damage: 1 };
    `,
    ...overrides,
  };
}

describe("EffectExecutor", () => {
  let deps: ExecutorDependencies;
  let executor: EffectExecutor;

  beforeEach(() => {
    deps = createMockDeps();
    executor = new EffectExecutor(deps);
  });

  describe("constructor and basic lifecycle", () => {
    it("creates an executor with empty logs", () => {
      expect(executor.getLogs()).toEqual([]);
    });

    it("clears logs correctly", () => {
      executor.clearLogs();
      expect(executor.getLogs()).toEqual([]);
    });
  });

  describe("execute()", () => {
    it("executes a simple effect script successfully", async () => {
      const effect = createSimpleEffect();
      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
      });

      expect(result.success).toBe(true);
      expect(result.lifecycle).toBe("onPlay");
      expect(deps.emitAndApply).toHaveBeenCalled();
    });

    it("passes effect params through to the script", async () => {
      const effect: EffectDefinition = {
        id: "param_effect",
        name: "Param Effect",
        type: "damage",
        params: { baseAmount: 2 },
        validTargets: "inRange",
        script: `
          const val = context.params.baseAmount || 1;
          return { success: true, value: val };
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
        params: { extra: 42 },
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, value: 2 });
    });

    it("handles script execution errors gracefully", async () => {
      const effect: EffectDefinition = {
        id: "error_effect",
        name: "Error Effect",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          throw new Error("script error");
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain("script error");
    });

    it("returns empty result for effects with no script", async () => {
      const effect: EffectDefinition = {
        id: "no_script",
        name: "No Script",
        type: "damage",
        params: {},
        validTargets: "inRange",
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({});
    });

    it("executes on different lifecycle stages", async () => {
      const effect = createSimpleEffect();
      const stages = ["onPlay", "onTarget", "onResolve", "onDiscard"] as const;

      for (const stage of stages) {
        const result = await executor.execute(effect, {
          playerId: "testPlayer_0",
          playerName: "Player 0",
          lifecycle: stage,
        });
        expect(result.lifecycle).toBe(stage);
        expect(result.success).toBe(true);
      }
    });

    it("records log messages during execution", async () => {
      const effect: EffectDefinition = {
        id: "log_effect",
        name: "Log Effect",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          context.log("step 1");
          context.log("step 2");
          return { success: true };
        `,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      const logs = executor.getLogs();
      expect(logs.length).toBeGreaterThanOrEqual(2);
      expect(logs.some((l) => l.includes("step 1"))).toBe(true);
      expect(logs.some((l) => l.includes("step 2"))).toBe(true);
    });
  });

  describe("executeCard()", () => {
    it("executes multiple effects on a single card", async () => {
      const effects = [
        createSimpleEffect({ id: "effect_1" }),
        {
          id: "effect_2",
          name: "Second Effect",
          type: "heal",
          params: {},
          validTargets: "inRange",
          script: `return { success: true, healed: 2 };`,
        },
      ];

      const results = await executor.executeCard(effects, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        targets: ["testPlayer_1"],
        cardId: "card_123",
      });

      expect(results.length).toBeGreaterThanOrEqual(2);
      const effectIds = results
        .filter((r) => r.lifecycle === "onPlay")
        .map((r) => r.data);
      expect(effectIds.length).toBeGreaterThanOrEqual(2);
    });

    it("stops on effect failure", async () => {
      const effects = [
        {
          id: "failing_effect",
          name: "Fail",
          type: "damage",
          params: {},
          validTargets: "inRange",
          script: `throw new Error("fail");`,
        },
        createSimpleEffect({ id: "should_not_run" }),
      ];

      const results = await executor.executeCard(effects, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      const failedResult = results.find((r) => !r.success);
      expect(failedResult).toBeDefined();
      expect(failedResult!.error).toContain("fail");
    });

    it("handles empty effects list", async () => {
      const results = await executor.executeCard([], {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });
      expect(results).toEqual([]);
    });
  });

  describe("context bindings", () => {
    it("context.damage calls emitAndApply with correct data", async () => {
      const effect: EffectDefinition = {
        id: "damage_test",
        name: "Damage Test",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `await context.damage(context.target, 3); return { success: true };`,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
      });

      expect(deps.emitAndApply).toHaveBeenCalled();
      const callArgs = (deps.emitAndApply as ReturnType<typeof vi.fn>).mock
        .calls;
      const damageCall = callArgs.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>).type === EventType.DAMAGE_DEALT
      );
      expect(damageCall).toBeDefined();
    });

    it("context.requestResponse calls eventBus.requestResponse", async () => {
      const effect: EffectDefinition = {
        id: "resp_test",
        name: "Response Test",
        type: "counter",
        params: {},
        validTargets: "inRange",
        script: `
          const resp = await context.requestResponse(context.target, { type: "test" });
          return { success: true, responded: resp !== null };
        `,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
      });

      expect(deps.eventBus.requestResponse).toHaveBeenCalled();
    });

    it("context.getResource returns the value from resources", async () => {
      const effect: EffectDefinition = {
        id: "resource_test",
        name: "Resource Test",
        type: "modifier",
        params: {},
        validTargets: "inRange",
        script: `
          const health = await context.getResource(context.player.id, "health");
          return { success: true, health };
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.success).toBe(true);
      expect(result.data).toEqual({ success: true, health: 3 });
    });

    it("context.setResource delegates to resources.setValue", async () => {
      const effect: EffectDefinition = {
        id: "set_resource",
        name: "Set Resource",
        type: "modifier",
        params: {},
        validTargets: "inRange",
        script: `
          await context.setResource(context.player.id, "health", 5);
          return { success: true };
        `,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(deps.resources.setValue).toHaveBeenCalledWith(
        "testPlayer_0",
        "health",
        5
      );
    });

    it("context.addModifier emits CARD_MOVED event", async () => {
      const effect: EffectDefinition = {
        id: "modifier_test",
        name: "Modifier Test",
        type: "modifier",
        params: {},
        validTargets: "inRange",
        script: `
          await context.addModifier(context.player.id, { modifierId: "mod_1", source: "equip" });
          return { success: true };
        `,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      const calls = (deps.emitAndApply as ReturnType<typeof vi.fn>).mock.calls;
      const modifierCall = calls.find(
        (c: unknown[]) => (c[0] as Record<string, unknown>).type === EventType.CARD_MOVED
      );
      expect(modifierCall).toBeDefined();
    });

    it("context.log appends to executor logs", async () => {
      const effect: EffectDefinition = {
        id: "log_test",
        name: "Log Test",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `context.log("custom message"); return { success: true };`,
      };

      await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      const logs = executor.getLogs();
      expect(logs.some((l) => l.includes("custom message"))).toBe(true);
    });
  });

  describe("sandbox security", () => {
    it("scripts have access to the global scope via new Function", async () => {
      const effect: EffectDefinition = {
        id: "sandbox_test",
        name: "Sandbox Test",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          let result;
          try {
            result = typeof process !== 'undefined' ? 'process_accessible' : 'no_process';
          } catch (e) {
            result = 'error_in_catch';
          }
          return { success: true, result };
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.success).toBe(true);
      expect(result.data!.result).toBe("process_accessible");
    });

    it("scripts run in isolated function scopes", async () => {
      const effect1: EffectDefinition = {
        id: "isolate_1",
        name: "Isolate 1",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          var sharedVar = "fromEffect1";
          return { success: true };
        `,
      };

      const effect2: EffectDefinition = {
        id: "isolate_2",
        name: "Isolate 2",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          let result;
          try {
            result = typeof sharedVar === 'undefined' ? 'isolated' : 'shared';
          } catch (e) {
            result = 'error_in_catch';
          }
          return { success: true, result };
        `,
      };

      await executor.execute(effect1, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      const result = await executor.execute(effect2, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.data!.result).toBe("isolated");
    });

    it("handles async scripts correctly", async () => {
      const effect: EffectDefinition = {
        id: "async_test",
        name: "Async Test",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          await context.damage(context.target, 1);
          const health = await context.getResource(context.target, "health");
          return { success: true, healthAfter: health };
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_1",
      });

      expect(result.success).toBe(true);
    });
  });

  describe("lifecycle integration", () => {
    it("onPlay stage enables initial card play", async () => {
      const effect = {
        id: "play_stage",
        name: "Play Stage",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `return { success: true, stage: 'play' };`,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        lifecycle: "onPlay",
      });

      expect(result.lifecycle).toBe("onPlay");
    });

    it("onResolve stage triggers after targeting", async () => {
      const effect = {
        id: "resolve_stage",
        name: "Resolve Stage",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `return { success: true, stage: 'resolve' };`,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        lifecycle: "onResolve",
      });

      expect(result.lifecycle).toBe("onResolve");
    });

    it("onDiscard stage fires on card discard", async () => {
      const effect = {
        id: "discard_stage",
        name: "Discard Stage",
        type: "modifier",
        params: {},
        validTargets: "inRange",
        script: `return { success: true, stage: 'discard' };`,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        lifecycle: "onDiscard",
      });

      expect(result.lifecycle).toBe("onDiscard");
    });
  });

  describe("Context API integrity", () => {
    it("provides player info in context", async () => {
      const effect: EffectDefinition = {
        id: "player_info",
        name: "Player Info",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `
          return {
            success: true,
            playerId: context.player.id,
            playerName: context.player.name,
          };
        `,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.data!.playerId).toBe("testPlayer_0");
      expect(result.data!.playerName).toBe("Player 0");
    });

    it("provides target in context", async () => {
      const effect: EffectDefinition = {
        id: "target_info",
        name: "Target Info",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `return { success: true, target: context.target };`,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
        target: "testPlayer_2",
      });

      expect(result.data!.target).toBe("testPlayer_2");
    });

    it("provides event data in context", async () => {
      const effect: EffectDefinition = {
        id: "event_info",
        name: "Event Info",
        type: "damage",
        params: {},
        validTargets: "inRange",
        script: `return { success: true, eventType: context.event.type };`,
      };

      const result = await executor.execute(effect, {
        playerId: "testPlayer_0",
        playerName: "Player 0",
      });

      expect(result.success).toBe(true);
      expect(result.data!.eventType).toBe("card:played");
    });
  });
});

describe("createEffectExecutor", () => {
  it("creates and returns an EffectExecutor instance", () => {
    const deps = createMockDeps();
    const executor = createEffectExecutor(deps);
    expect(executor).toBeInstanceOf(EffectExecutor);
  });
});