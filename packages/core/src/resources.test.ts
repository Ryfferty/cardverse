import { describe, it, expect, beforeEach } from "vitest";
import { ResourceManager } from "./resources";
import { EventBus } from "./events";
import type { ResourceDefinition, ResourceState } from "@cardverse/shared";

describe("ResourceManager", () => {
  let manager: ResourceManager;
  let eventBus: EventBus;

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

  const energyDef: ResourceDefinition = {
    id: "energy",
    name: "Energy",
    defaultValue: 0,
    min: 0,
    max: 999,
    regenPerTurn: 2,
  };

  beforeEach(() => {
    eventBus = new EventBus();
    manager = new ResourceManager(eventBus);
  });

  describe("registerDefinition", () => {
    it("should register a resource definition", () => {
      manager.registerDefinition(healthDef);
      const def = manager.getDefinition("health");
      expect(def).toEqual(healthDef);
    });

    it("should register multiple definitions", () => {
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);
      expect(manager.getDefinition("health")).toBeDefined();
      expect(manager.getDefinition("mana")).toBeDefined();
    });
  });

  describe("initResource", () => {
    it("should initialize a resource for a player", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");

      const val = manager.getValue("player1", "health");
      expect(val).toBe(3);
    });

    it("should use default value from definition", () => {
      manager.registerDefinition(manaDef);
      manager.initResource("player1", "mana");

      const val = manager.getValue("player1", "mana");
      expect(val).toBe(1);
    });

    it("should not initialize if definition not registered", () => {
      manager.initResource("player1", "health");
      expect(manager.getValue("player1", "health")).toBeUndefined();
    });

    it("should initialize for multiple players", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      manager.initResource("player2", "health");

      expect(manager.getValue("player1", "health")).toBe(3);
      expect(manager.getValue("player2", "health")).toBe(3);
    });

    it("should initialize multiple resources for same player", () => {
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);
      manager.initResource("player1", "health");
      manager.initResource("player1", "mana");

      expect(manager.getValue("player1", "health")).toBe(3);
      expect(manager.getValue("player1", "mana")).toBe(1);
    });
  });

  describe("getValue", () => {
    it("should return undefined for non-initialized resource", () => {
      expect(manager.getValue("player1", "health")).toBeUndefined();
    });

    it("should return undefined for unknown player", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      expect(manager.getValue("player99", "health")).toBeUndefined();
    });

    it("should return correct value after initialization", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      expect(manager.getValue("player1", "health")).toBe(3);
    });
  });

  describe("getResource", () => {
    it("should return full resource state", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");

      const state = manager.getResource("player1", "health");
      expect(state).toBeDefined();
      expect(state?.definitionId).toBe("health");
      expect(state?.current).toBe(3);
      expect(state?.min).toBe(0);
      expect(state?.max).toBe(5);
    });

    it("should return undefined for non-initialized resource", () => {
      expect(manager.getResource("player1", "health")).toBeUndefined();
    });
  });

  describe("modify", () => {
    beforeEach(() => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
    });

    it("should increase resource value", async () => {
      const result = await manager.modify("player1", "health", 1);
      expect(result).toBe(4);
      expect(manager.getValue("player1", "health")).toBe(4);
    });

    it("should decrease resource value", async () => {
      const result = await manager.modify("player1", "health", -1);
      expect(result).toBe(2);
      expect(manager.getValue("player1", "health")).toBe(2);
    });

    it("should clamp to minimum", async () => {
      const result = await manager.modify("player1", "health", -10);
      expect(result).toBe(0);
      expect(manager.getValue("player1", "health")).toBe(0);
    });

    it("should clamp to maximum", async () => {
      const result = await manager.modify("player1", "health", 10);
      expect(result).toBe(5);
      expect(manager.getValue("player1", "health")).toBe(5);
    });

    it("should throw for non-existent resource", async () => {
      await expect(manager.modify("player1", "mana", 1)).rejects.toThrow("not initialized");
    });

    it("should emit RESOURCE_CHANGED event", async () => {
      let capturedEvent: any = null;
      eventBus.on("*", async (event) => {
        capturedEvent = event;
      });

      await manager.modify("player1", "health", 1);

      expect(capturedEvent).toBeDefined();
      expect(capturedEvent.type).toBe("resource:changed");
      expect(capturedEvent.data.playerId).toBe("player1");
      expect(capturedEvent.data.resourceId).toBe("health");
      expect(capturedEvent.data.oldValue).toBe(3);
      expect(capturedEvent.data.newValue).toBe(4);
      expect(capturedEvent.data.delta).toBe(1);
    });

    it("should use provided source in event", async () => {
      let capturedSource: any;
      eventBus.on("*", async (event) => {
        capturedSource = event.source;
      });

      await manager.modify("player1", "health", 1, "spell:fireball");
      expect(capturedSource).toBe("spell:fireball");
    });

    it("should use 'system' as default source", async () => {
      let capturedSource: any;
      eventBus.on("*", async (event) => {
        capturedSource = event.source;
      });

      await manager.modify("player1", "health", 1);
      expect(capturedSource).toBe("system");
    });

    it("should handle zero delta", async () => {
      const result = await manager.modify("player1", "health", 0);
      expect(result).toBe(3);
    });
  });

  describe("set", () => {
    beforeEach(() => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
    });

    it("should set to absolute value", async () => {
      const result = await manager.set("player1", "health", 1);
      expect(result).toBe(1);
      expect(manager.getValue("player1", "health")).toBe(1);
    });

    it("should clamp to bounds when setting", async () => {
      // Setting beyond max
      await manager.set("player1", "health", 100);
      expect(manager.getValue("player1", "health")).toBe(5);

      // Setting below min
      await manager.set("player1", "health", -100);
      expect(manager.getValue("player1", "health")).toBe(0);
    });
  });

  describe("applyRegen", () => {
    it("should apply regen to all players with regenPerTurn", async () => {
      manager.registerDefinition(manaDef);
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "mana");
      manager.initResource("player2", "mana");
      manager.initResource("player1", "health"); // health has no regenPerTurn

      await manager.applyRegen(["player1", "player2"]);

      // mana has regenPerTurn=1, health has none
      expect(manager.getValue("player1", "mana")).toBe(2); // 1 + 1
      expect(manager.getValue("player2", "mana")).toBe(2); // 1 + 1
      expect(manager.getValue("player1", "health")).toBe(3); // unchanged
    });

    it("should not go above max with regen", async () => {
      const limitedDef: ResourceDefinition = {
        id: "shield",
        name: "Shield",
        defaultValue: 0,
        min: 0,
        max: 2,
        regenPerTurn: 5,
      };
      manager.registerDefinition(limitedDef);
      manager.initResource("player1", "shield");

      await manager.applyRegen(["player1"]);
      expect(manager.getValue("player1", "shield")).toBe(2); // clamped to max
    });

    it("should skip players with zero regen", async () => {
      const zeroRegen: ResourceDefinition = {
        id: "stamina",
        name: "Stamina",
        defaultValue: 3,
        min: 0,
        max: 10,
        regenPerTurn: 0,
      };
      manager.registerDefinition(zeroRegen);
      manager.initResource("player1", "stamina");

      await manager.applyRegen(["player1"]);
      expect(manager.getValue("player1", "stamina")).toBe(3); // unchanged
    });
  });

  describe("getDefinitions", () => {
    it("should return all definitions", () => {
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);
      const defs = manager.getDefinitions();
      expect(defs.size).toBe(2);
      expect(defs.get("health")).toEqual(healthDef);
      expect(defs.get("mana")).toEqual(manaDef);
    });

    it("should return a copy, not original", () => {
      manager.registerDefinition(healthDef);
      const defs = manager.getDefinitions();
      defs.clear();
      expect(manager.getDefinitions().size).toBe(1);
    });
  });

  describe("getDefinition", () => {
    it("should return definition by ID", () => {
      manager.registerDefinition(healthDef);
      expect(manager.getDefinition("health")).toEqual(healthDef);
    });

    it("should return undefined for unknown ID", () => {
      expect(manager.getDefinition("nonexistent")).toBeUndefined();
    });
  });

  describe("isInitialized", () => {
    it("should return true after initialization", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      expect(manager.isInitialized("player1", "health")).toBe(true);
    });

    it("should return false before initialization", () => {
      manager.registerDefinition(healthDef);
      expect(manager.isInitialized("player1", "health")).toBe(false);
    });

    it("should return false for unknown player", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      expect(manager.isInitialized("player2", "health")).toBe(false);
    });
  });

  describe("resetToDefault", () => {
    it("should reset to default value", async () => {
      manager.registerDefinition(manaDef);
      manager.initResource("player1", "mana");
      await manager.resetToDefault("player1", "mana");

      expect(manager.getValue("player1", "mana")).toBe(1);
    });

    it("should reset after modifying", async () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      await manager.modify("player1", "health", -2);

      await manager.resetToDefault("player1", "health");
      expect(manager.getValue("player1", "health")).toBe(3);
    });

    it("should return undefined for non-initialized resource", async () => {
      const result = await manager.resetToDefault("player1", "health");
      expect(result).toBeUndefined();
    });

    it("should return undefined for unknown definition", async () => {
      manager.initResource("player1", "health");
      const result = await manager.resetToDefault("player1", "health");
      expect(result).toBeUndefined();
    });

    it("should emit RESOURCE_CHANGED event on resetToDefault", async () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      await manager.modify("player1", "health", -2);

      let capturedEvent: any = null;
      eventBus.on("*", async (event) => {
        if (event.data?.resourceId === "health" && event.source === "reset") {
          capturedEvent = event;
        }
      });

      await manager.resetToDefault("player1", "health");
      expect(capturedEvent).toBeDefined();
      expect(capturedEvent.type).toBe("resource:changed");
      expect(capturedEvent.data.newValue).toBe(3);
    });
  });

  describe("getPlayerResourceCount", () => {
    it("should return 0 for player with no resources", () => {
      expect(manager.getPlayerResourceCount("player1")).toBe(0);
    });

    it("should return correct count", () => {
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);
      manager.initResource("player1", "health");
      manager.initResource("player1", "mana");

      expect(manager.getPlayerResourceCount("player1")).toBe(2);
    });

    it("should not count other players' resources", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");

      expect(manager.getPlayerResourceCount("player2")).toBe(0);
    });
  });

  describe("getPlayerResources", () => {
    it("should return all resources for a player", () => {
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);
      manager.initResource("player1", "health");
      manager.initResource("player1", "mana");

      const resources = manager.getPlayerResources("player1");
      expect(resources.size).toBe(2);
      expect(resources.get("health")?.current).toBe(3);
      expect(resources.get("mana")?.current).toBe(1);
    });

    it("should return empty map for uninitialized player", () => {
      const resources = manager.getPlayerResources("player1");
      expect(resources.size).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all resources and definitions", () => {
      manager.registerDefinition(healthDef);
      manager.initResource("player1", "health");
      manager.clear();

      expect(manager.getDefinitions().size).toBe(0);
      expect(manager.getValue("player1", "health")).toBeUndefined();
    });
  });

  describe("integration", () => {
    it("should simulate full resource lifecycle", async () => {
      // Register definitions
      manager.registerDefinition(healthDef);
      manager.registerDefinition(manaDef);

      // Initialize for two players
      manager.initResource("p1", "health");
      manager.initResource("p1", "mana");
      manager.initResource("p2", "health");
      manager.initResource("p2", "mana");

      expect(manager.getPlayerResourceCount("p1")).toBe(2);
      expect(manager.getPlayerResourceCount("p2")).toBe(2);

      // Damage p1
      await manager.modify("p1", "health", -1);
      expect(manager.getValue("p1", "health")).toBe(2);

      // Heal p1
      await manager.modify("p1", "health", 1);
      expect(manager.getValue("p1", "health")).toBe(3);

      // Spend mana
      await manager.set("p1", "mana", 0);
      expect(manager.getValue("p1", "mana")).toBe(0);

      // Apply regen (mana +1)
      await manager.applyRegen(["p1", "p2"]);
      expect(manager.getValue("p1", "mana")).toBe(1);
      expect(manager.getValue("p2", "mana")).toBe(2);

      // Lethal damage
      await manager.modify("p2", "health", -10);
      expect(manager.getValue("p2", "health")).toBe(0); // clamped to min

      // Reset to defaults and clear
      await manager.resetToDefault("p1", "health");
      expect(manager.getValue("p1", "health")).toBe(3);

      manager.clear();
      expect(manager.getPlayerResourceCount("p1")).toBe(0);
    });
  });
});