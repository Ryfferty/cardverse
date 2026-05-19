import { describe, it, expect } from "vitest";
import { RangeManager } from "./range.js";
import type { CardDefinition } from "@cardverse/shared";

function makeCard(opts: Partial<CardDefinition>): CardDefinition {
  return {
    id: opts.id ?? "test",
    name: opts.name ?? "Test",
    category: "equipment",
    tags: opts.tags ?? [],
  };
}

describe("RangeManager", () => {
  describe("calculateDistance", () => {
    it("should return 1 for 2-player game regardless of seat", () => {
      expect(RangeManager.calculateDistance(0, 1, 2)).toBe(1);
      expect(RangeManager.calculateDistance(1, 0, 2)).toBe(1);
    });

    it("should return 1 between adjacent seats in 4-player game", () => {
      expect(RangeManager.calculateDistance(0, 1, 4)).toBe(1);
      expect(RangeManager.calculateDistance(3, 0, 4)).toBe(1);
    });

    it("should return 2 between opposite seats in 4-player game", () => {
      expect(RangeManager.calculateDistance(0, 2, 4)).toBe(2);
      expect(RangeManager.calculateDistance(1, 3, 4)).toBe(2);
    });

    it("should consider the shorter direction", () => {
      // In 6-player game, seat 0 to seat 4: clockwise 4, counterclockwise 2
      expect(RangeManager.calculateDistance(0, 4, 6)).toBe(2);
    });

    it("should return 1 for same seat", () => {
      expect(RangeManager.calculateDistance(0, 0, 4)).toBe(1);
    });
  });

  describe("isInRange", () => {
    it("should return true when distance <= weapon range", () => {
      // base distance 1, weapon range 1, no mounts → 1 <= 1
      expect(RangeManager.isInRange(1, 1, 0, 0)).toBe(true);
    });

    it("should return false when distance > weapon range", () => {
      // base distance 2, weapon range 1, no mounts → 2 > 1
      expect(RangeManager.isInRange(2, 1, 0, 0)).toBe(false);
    });

    it("should consider mount offense (-1 horse)", () => {
      // base distance 2, weapon range 1, mountOffense 1 → 2 - 1 = 1 <= 1
      expect(RangeManager.isInRange(2, 1, 1, 0)).toBe(true);
    });

    it("should consider mount defense (+1 horse)", () => {
      // base distance 1, weapon range 1, mountDefense 1 → 1 + 1 = 2 > 1
      expect(RangeManager.isInRange(1, 1, 0, 1)).toBe(false);
    });

    it("should combine mount defense and offense", () => {
      // base distance 2, weapon range 2, mountOffense 1, mountDefense 0
      // effective = 2 + 0 - 1 = 1 <= 2 → true
      expect(RangeManager.isInRange(2, 2, 1, 0)).toBe(true);

      // base distance 2, weapon range 2, mountOffense 0, mountDefense 1
      // effective = 2 + 1 - 0 = 3 > 2 → false
      expect(RangeManager.isInRange(2, 2, 0, 1)).toBe(false);
    });
  });

  describe("getEquipmentModifiers", () => {
    it("should return default weapon range 1 with no equipment", () => {
      const mod = RangeManager.getEquipmentModifiers([]);
      expect(mod.weaponRange).toBe(1);
      expect(mod.mountOffense).toBe(0);
      expect(mod.mountDefense).toBe(0);
    });

    it("should parse weapon range from tags", () => {
      const cards: CardDefinition[] = [
        makeCard({
          id: "qinglong",
          tags: ["weapon", "range-3", "pursuit"],
        }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.weaponRange).toBe(3);
    });

    it("should take the highest weapon range", () => {
      const cards: CardDefinition[] = [
        makeCard({ id: "w1", tags: ["weapon", "range-2"] }),
        makeCard({ id: "w2", tags: ["weapon", "range-4"] }),
        makeCard({ id: "w3", tags: ["weapon", "range-3"] }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.weaponRange).toBe(4);
    });

    it("should detect +1 horse (mountDefense)", () => {
      const cards: CardDefinition[] = [
        makeCard({
          id: "plus1horse",
          tags: ["mount", "defense", "range+1"],
        }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.mountDefense).toBe(1);
      expect(mod.mountOffense).toBe(0);
    });

    it("should detect -1 horse (mountOffense)", () => {
      const cards: CardDefinition[] = [
        makeCard({
          id: "minus1horse",
          tags: ["mount", "offense", "range-1"],
        }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.mountOffense).toBe(1);
      expect(mod.mountDefense).toBe(0);
    });

    it("should combine multiple mounts", () => {
      const cards: CardDefinition[] = [
        makeCard({ id: "d1", tags: ["mount", "defense", "range+1"] }),
        makeCard({ id: "d2", tags: ["mount", "defense"] }),
        makeCard({ id: "o1", tags: ["mount", "offense"] }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.mountDefense).toBe(2);
      expect(mod.mountOffense).toBe(1);
    });

    it("should ignore non-equipment tags", () => {
      const cards: CardDefinition[] = [
        makeCard({ id: "some", tags: ["basic", "type-sha"] }),
      ];
      const mod = RangeManager.getEquipmentModifiers(cards);
      expect(mod.mountDefense).toBe(0);
      expect(mod.mountOffense).toBe(0);
      expect(mod.weaponRange).toBe(1);
    });
  });

  describe("resolveEquipmentCards", () => {
    it("should extract definition ID from instance IDs", () => {
      const cardDefs = new Map<string, CardDefinition>();
      cardDefs.set("zhugeliannu", makeCard({
        id: "zhugeliannu",
        tags: ["weapon", "range-2"],
      }));

      const result = RangeManager.resolveEquipmentCards(
        ["inst_zhugeliannu_1", "inst_zhugeliannu_2"],
        cardDefs
      );
      expect(result.length).toBe(2);
      expect(result[0].tags).toContain("range-2");
    });

    it("should skip non-equipment category cards", () => {
      const cardDefs = new Map<string, CardDefinition>();
      cardDefs.set("sha", { id: "sha", name: "杀", category: "basic" });

      const result = RangeManager.resolveEquipmentCards(
        ["inst_sha_1"],
        cardDefs
      );
      expect(result.length).toBe(0);
    });

    it("should skip unknown definition IDs", () => {
      const cardDefs = new Map<string, CardDefinition>();

      const result = RangeManager.resolveEquipmentCards(
        ["inst_unknown_1"],
        cardDefs
      );
      expect(result.length).toBe(0);
    });
  });
});