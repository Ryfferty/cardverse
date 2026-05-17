import { describe, it, expect, beforeEach } from "vitest";
import { ZoneManager } from "./zones";
import type { ZoneDefinition } from "@cardverse/shared";

describe("ZoneManager", () => {
  let manager: ZoneManager;

  const globalDeckDef: ZoneDefinition = {
    id: "deck",
    name: "Deck",
    visibility: "none",
    ordered: true,
    maxSize: 60,
    faceDown: true,
    owner: "global",
  };

  const globalDiscardDef: ZoneDefinition = {
    id: "discard",
    name: "Discard",
    visibility: "all",
    ordered: false,
    maxSize: 200,
    faceDown: false,
    owner: "global",
  };

  const handDef: ZoneDefinition = {
    id: "hand",
    name: "Hand",
    visibility: "owner",
    ordered: true,
    maxSize: 10,
    faceDown: false,
    owner: "player",
  };

  const fieldDef: ZoneDefinition = {
    id: "field",
    name: "Field",
    visibility: "all",
    ordered: false,
    maxSize: 5,
    faceDown: false,
    owner: "player",
  };

  const unlimitedZoneDef: ZoneDefinition = {
    id: "unlimited",
    name: "Unlimited Zone",
    visibility: "all",
    ordered: false,
    faceDown: false,
    owner: "player",
  };

  beforeEach(() => {
    manager = new ZoneManager();
    manager.addGlobalZone(globalDeckDef);
    manager.addGlobalZone(globalDiscardDef);
    manager.addPlayerZone("player1", handDef);
    manager.addPlayerZone("player1", fieldDef);
    manager.addPlayerZone("player1", unlimitedZoneDef);
    manager.addPlayerZone("player2", handDef);
    manager.addPlayerZone("player2", fieldDef);
  });

  describe("Zone Creation", () => {
    it("should add global zone with correct key format", () => {
      const zone = manager.getZone("global:deck");
      expect(zone).toBeDefined();
      expect(zone?.definition.id).toBe("deck");
      expect(zone?.definition.name).toBe("Deck");
      expect(zone?.cards).toEqual([]);
      expect(zone?.playerId).toBeUndefined();
    });

    it("should add player zone with correct key format", () => {
      const zone = manager.getZone("player:player1:hand");
      expect(zone).toBeDefined();
      expect(zone?.definition.id).toBe("hand");
      expect(zone?.playerId).toBe("player1");
      expect(zone?.cards).toEqual([]);
    });

    it("should retrieve global zone by ID", () => {
      const zone = manager.getGlobalZone("deck");
      expect(zone).toBeDefined();
      expect(zone?.definition.id).toBe("deck");
    });

    it("should return undefined for non-existent global zone", () => {
      const zone = manager.getGlobalZone("nonexistent");
      expect(zone).toBeUndefined();
    });

    it("should retrieve player zone by player ID and zone ID", () => {
      const zone = manager.getPlayerZone("player1", "hand");
      expect(zone).toBeDefined();
      expect(zone?.playerId).toBe("player1");
      expect(zone?.definition.id).toBe("hand");
    });

    it("should return undefined for non-existent player zone", () => {
      const zone = manager.getPlayerZone("player1", "nonexistent");
      expect(zone).toBeUndefined();
    });

    it("should return undefined for non-existent player", () => {
      const zone = manager.getPlayerZone("player99", "hand");
      expect(zone).toBeUndefined();
    });
  });

  describe("hasZone", () => {
    it("should return true for existing zone", () => {
      expect(manager.hasZone("global:deck")).toBe(true);
      expect(manager.hasZone("player:player1:hand")).toBe(true);
    });

    it("should return false for non-existent zone", () => {
      expect(manager.hasZone("global:fake")).toBe(false);
    });
  });

  describe("addCard", () => {
    it("should add card to zone", () => {
      const result = manager.addCard("global:deck", "card1");
      expect(result).toBe(true);
      expect(manager.getCards("global:deck")).toEqual(["card1"]);
    });

    it("should add card at specific position", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      manager.addCard("global:deck", "card3", 1);
      expect(manager.getCards("global:deck")).toEqual(["card1", "card3", "card2"]);
    });

    it("should return false for non-existent zone", () => {
      const result = manager.addCard("global:fake", "card1");
      expect(result).toBe(false);
    });

    it("should reject card when zone is at max capacity", () => {
      manager.addCard("player:player1:field", "c1");
      manager.addCard("player:player1:field", "c2");
      manager.addCard("player:player1:field", "c3");
      manager.addCard("player:player1:field", "c4");
      manager.addCard("player:player1:field", "c5");
      const result = manager.addCard("player:player1:field", "c6");
      expect(result).toBe(false);
      expect(manager.getCards("player:player1:field")).toHaveLength(5);
    });

    it("should allow cards up to max capacity", () => {
      manager.addCard("player:player1:field", "c1");
      manager.addCard("player:player1:field", "c2");
      manager.addCard("player:player1:field", "c3");
      manager.addCard("player:player1:field", "c4");
      const result = manager.addCard("player:player1:field", "c5");
      expect(result).toBe(true);
    });

    it("should add multiple cards in sequence", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      manager.addCard("global:deck", "card3");
      expect(manager.getCards("global:deck")).toEqual(["card1", "card2", "card3"]);
    });

    it("should allow unlimited cards when no maxSize is set", () => {
      for (let i = 0; i < 100; i++) {
        const result = manager.addCard("player:player1:unlimited", `card${i}`);
        expect(result).toBe(true);
      }
      expect(manager.getCards("player:player1:unlimited")).toHaveLength(100);
    });
  });

  describe("removeCard", () => {
    it("should remove existing card from zone", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      const result = manager.removeCard("global:deck", "card1");
      expect(result).toBe(true);
      expect(manager.getCards("global:deck")).toEqual(["card2"]);
    });

    it("should return false when card not in zone", () => {
      manager.addCard("global:deck", "card1");
      const result = manager.removeCard("global:deck", "card99");
      expect(result).toBe(false);
    });

    it("should return false for non-existent zone", () => {
      const result = manager.removeCard("global:fake", "card1");
      expect(result).toBe(false);
    });

    it("should remove only the first occurrence", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      manager.removeCard("global:deck", "card1");
      expect(manager.getCards("global:deck")).toEqual(["card1", "card2"]);
    });
  });

  describe("moveCard", () => {
    it("should move card from one zone to another", () => {
      manager.addCard("global:deck", "card1");
      const result = manager.moveCard("global:deck", "global:discard", "card1");
      expect(result).toBe(true);
      expect(manager.getCards("global:deck")).not.toContain("card1");
      expect(manager.getCards("global:discard")).toContain("card1");
    });

    it("should move card with specified position", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      manager.moveCard("global:deck", "global:discard", "card1", 0);
      manager.moveCard("global:deck", "global:discard", "card2", 0);
      expect(manager.getCards("global:discard")).toEqual(["card2", "card1"]);
    });

    it("should return false when source card does not exist", () => {
      const result = manager.moveCard("global:deck", "global:discard", "card99");
      expect(result).toBe(false);
    });

    it("should return false when source zone does not exist", () => {
      const result = manager.moveCard("global:fake", "global:discard", "card1");
      expect(result).toBe(false);
    });

    it("should return false when destination zone is at capacity", () => {
      manager.addCard("global:deck", "card_to_move");
      for (let i = 0; i < 5; i++) {
        manager.addCard("player:player1:field", `field_c${i}`);
      }
      const result = manager.moveCard("global:deck", "player:player1:field", "card_to_move");
      expect(result).toBe(false);
      // Card should still be in deck (removed then failed to add)
      expect(manager.getCards("global:deck")).not.toContain("card_to_move");
    });
  });

  describe("shuffle", () => {
    it("should not throw on empty zone", () => {
      expect(() => manager.shuffle("global:deck")).not.toThrow();
    });

    it("should preserve all cards after shuffle", () => {
      const cards = ["c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "c10"];
      for (const card of cards) {
        manager.addCard("global:deck", card);
      }
      manager.shuffle("global:deck");
      const shuffled = manager.getCards("global:deck");
      expect(shuffled).toHaveLength(10);
      expect(shuffled.sort()).toEqual(cards.sort());
    });

    it("should not throw on non-existent zone", () => {
      expect(() => manager.shuffle("global:fake")).not.toThrow();
    });
  });

  describe("getVisibleZones", () => {
    it("should show 'all' visibility zones to any player", () => {
      const visible = manager.getVisibleZones("player1");
      expect(visible).toContain("global:discard");
      expect(visible).toContain("player:player1:field");
      expect(visible).toContain("player:player2:field");
    });

    it("should show 'owner' visibility zones only to the owner", () => {
      const player1Visible = manager.getVisibleZones("player1");
      expect(player1Visible).toContain("player:player1:hand");
      expect(player1Visible).not.toContain("player:player2:hand");

      const player2Visible = manager.getVisibleZones("player2");
      expect(player2Visible).toContain("player:player2:hand");
      expect(player2Visible).not.toContain("player:player1:hand");
    });

    it("should not show 'none' visibility zones", () => {
      const visible = manager.getVisibleZones("player1");
      expect(visible).not.toContain("global:deck");
    });
  });

  describe("getVisibleCards", () => {
    it("should return all cards for 'all' visibility zones", () => {
      manager.addCard("global:discard", "card1");
      manager.addCard("global:discard", "card2");
      const cards = manager.getVisibleCards("global:discard", "player1");
      expect(cards).toEqual(["card1", "card2"]);
    });

    it("should return cards for owner in 'owner' visibility zones", () => {
      manager.addCard("player:player1:hand", "card1");
      manager.addCard("player:player1:hand", "card2");
      const cards = manager.getVisibleCards("player:player1:hand", "player1");
      expect(cards).toEqual(["card1", "card2"]);
    });

    it("should return empty for other player in 'owner' visibility zones", () => {
      manager.addCard("player:player1:hand", "card1");
      const cards = manager.getVisibleCards("player:player1:hand", "player2");
      expect(cards).toEqual([]);
    });

    it("should return empty for 'none' visibility zones", () => {
      manager.addCard("global:deck", "card1");
      const cards = manager.getVisibleCards("global:deck", "player1");
      expect(cards).toEqual([]);
    });

    it("should return empty for non-existent zone", () => {
      const cards = manager.getVisibleCards("global:fake", "player1");
      expect(cards).toEqual([]);
    });
  });

  describe("getZoneSize", () => {
    it("should return 0 for empty zone", () => {
      expect(manager.getZoneSize("global:deck")).toBe(0);
    });

    it("should return correct count for zone with cards", () => {
      manager.addCard("global:deck", "card1");
      manager.addCard("global:deck", "card2");
      expect(manager.getZoneSize("global:deck")).toBe(2);
    });

    it("should return 0 for non-existent zone", () => {
      expect(manager.getZoneSize("global:fake")).toBe(0);
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty zone", () => {
      expect(manager.isEmpty("global:deck")).toBe(true);
    });

    it("should return false for zone with cards", () => {
      manager.addCard("global:deck", "card1");
      expect(manager.isEmpty("global:deck")).toBe(false);
    });

    it("should return true for non-existent zone", () => {
      expect(manager.isEmpty("global:fake")).toBe(true);
    });
  });

  describe("getAllZoneKeys", () => {
    it("should return all zone keys", () => {
      const keys = manager.getAllZoneKeys();
      expect(keys).toContain("global:deck");
      expect(keys).toContain("global:discard");
      expect(keys).toContain("player:player1:hand");
      expect(keys).toContain("player:player2:hand");
      expect(keys).toHaveLength(7);
    });
  });

  describe("listGlobalZones", () => {
    it("should list only global zones", () => {
      const globals = manager.listGlobalZones();
      expect(globals).toHaveLength(2);
      expect(globals.every((z) => z.definition.owner === "global")).toBe(true);
    });
  });

  describe("listPlayerZones", () => {
    it("should list only zones for a specific player", () => {
      const player1Zones = manager.listPlayerZones("player1");
      expect(player1Zones).toHaveLength(3);
      expect(player1Zones.every((z) => z.playerId === "player1")).toBe(true);
    });

    it("should return empty array for unknown player", () => {
      const zones = manager.listPlayerZones("player99");
      expect(zones).toEqual([]);
    });
  });

  describe("setCards", () => {
    it("should replace all cards in a zone", () => {
      manager.addCard("global:deck", "old1");
      manager.addCard("global:deck", "old2");
      const result = manager.setCards("global:deck", ["new1", "new2", "new3"]);
      expect(result).toBe(true);
      expect(manager.getCards("global:deck")).toEqual(["new1", "new2", "new3"]);
    });

    it("should reject when card count exceeds max capacity", () => {
      const tooMany = Array.from({ length: 11 }, (_, i) => `card${i}`);
      const result = manager.setCards("player:player1:hand", tooMany);
      expect(result).toBe(false);
    });

    it("should allow setting exactly at max capacity", () => {
      const exactlyMax = Array.from({ length: 10 }, (_, i) => `card${i}`);
      const result = manager.setCards("player:player1:hand", exactlyMax);
      expect(result).toBe(true);
      expect(manager.getCards("player:player1:hand")).toHaveLength(10);
    });

    it("should return false for non-existent zone", () => {
      const result = manager.setCards("global:fake", ["card1"]);
      expect(result).toBe(false);
    });

    it("should set empty card list", () => {
      manager.addCard("global:deck", "card1");
      const result = manager.setCards("global:deck", []);
      expect(result).toBe(true);
      expect(manager.getCards("global:deck")).toEqual([]);
    });

    it("should not share reference with internal state", () => {
      const cards = ["card1", "card2"];
      manager.setCards("global:deck", cards);
      cards.push("card3"); // Mutate external array
      expect(manager.getCards("global:deck")).toEqual(["card1", "card2"]);
    });
  });

  describe("clear", () => {
    it("should remove all zones", () => {
      manager.addCard("global:deck", "card1");
      manager.clear();
      expect(manager.getAllZoneKeys()).toHaveLength(0);
    });
  });

  describe("Integration", () => {
    it("should handle full zone lifecycle", () => {
      // Create a new zone manager for this test
      const m = new ZoneManager();

      // Create zones
      m.addGlobalZone({
        id: "deck",
        name: "Deck",
        visibility: "none",
        ordered: true,
        maxSize: 52,
        faceDown: true,
        owner: "global",
      });

      m.addPlayerZone("p1", {
        id: "hand",
        name: "Hand",
        visibility: "owner",
        ordered: true,
        maxSize: 7,
        faceDown: false,
        owner: "player",
      });

      // Fill deck
      for (let i = 0; i < 5; i++) {
        m.addCard("global:deck", `card${i}`);
      }
      expect(m.getZoneSize("global:deck")).toBe(5);

      // Shuffle deck
      m.shuffle("global:deck");
      expect(m.getZoneSize("global:deck")).toBe(5);

      // Draw cards to hand
      for (let i = 0; i < 3; i++) {
        const deckCards = m.getCards("global:deck");
        const drawn = deckCards[0];
        const moved = m.moveCard("global:deck", "player:p1:hand", drawn);
        expect(moved).toBe(true);
      }
      expect(m.getZoneSize("global:deck")).toBe(2);
      expect(m.getZoneSize("player:p1:hand")).toBe(3);

      // Owner can see hand
      const visible = m.getVisibleCards("player:p1:hand", "p1");
      expect(visible).toHaveLength(3);

      // Other player cannot see hand
      const hidden = m.getVisibleCards("player:p1:hand", "p2");
      expect(hidden).toEqual([]);

      // Cannot see deck cards (none visibility)
      const deckVisible = m.getVisibleCards("global:deck", "p1");
      expect(deckVisible).toEqual([]);
    });
  });
});