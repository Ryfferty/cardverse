import { describe, it, expect, beforeEach } from "vitest";
import { DeckLoader, DeckError } from "./loader";

function makeMinimalDeck(overrides?: Record<string, unknown>): Record<string, unknown> {
  return {
    manifest: {
      id: "test-deck",
      name: "Test Deck",
      version: "1.0.0",
      author: "Tester",
      description: "A test deck",
      minPlayers: 2,
      maxPlayers: 4,
      frameworkVersion: "1.0.0",
      tags: ["test"],
    },
    rules: {
      zones: [
        { id: "deck", name: "Deck", visibility: "none", ordered: true, faceDown: true, owner: "global" },
        { id: "hand", name: "Hand", visibility: "owner", ordered: true, faceDown: false, owner: "player" },
      ],
      phases: [
        { id: "draw", name: "Draw", auto: true },
        { id: "play", name: "Play", auto: false },
        { id: "end", name: "End", auto: true },
      ],
      resources: [
        { id: "health", name: "Health", defaultValue: 3, min: 0, max: 5 },
      ],
      turnOrder: "clockwise",
    },
    cards: [
      { id: "attack", name: "Attack", category: "basic" },
      { id: "defend", name: "Defend", category: "basic" },
    ],
    ...overrides,
  };
}

function makeFullDeck(): Record<string, unknown> {
  return {
    manifest: {
      id: "full-deck",
      name: "Full Deck",
      version: "2.0.0",
      author: "Author",
      description: "A complete deck",
      minPlayers: 2,
      maxPlayers: 6,
      frameworkVersion: "2.0.0",
      tags: ["card-game", "strategy"],
    },
    rules: {
      zones: [
        { id: "deck", name: "Deck", visibility: "none", ordered: true, faceDown: true, owner: "global" },
        { id: "hand", name: "Hand", visibility: "owner", ordered: true, faceDown: false, owner: "player" },
        { id: "discard", name: "Discard", visibility: "all", ordered: false, faceDown: false, owner: "global" },
      ],
      phases: [
        { id: "prepare", name: "Prepare", auto: true },
        { id: "draw", name: "Draw", auto: true },
        { id: "play", name: "Play", auto: false },
        { id: "discard", name: "Discard", auto: true },
        { id: "end", name: "End", auto: true },
      ],
      resources: [
        { id: "health", name: "Health", defaultValue: 3, min: 0, max: 5, regenPerTurn: 0 },
        { id: "mana", name: "Mana", defaultValue: 1, min: 0, max: 10, regenPerTurn: 1 },
      ],
      maxEffectSteps: 500,
      responseTimeout: 30,
      turnOrder: "clockwise",
    },
    cards: [
      {
        id: "fireball",
        name: "Fireball",
        category: "trick",
        description: "Deals damage",
        cost: 3,
        count: 4,
        effects: [
          { id: "deal_damage", name: "Deal Damage", type: "damage", params: { amount: 3 } },
        ],
      },
      {
        id: "heal",
        name: "Heal",
        category: "trick",
        description: "Restores HP",
        cost: 2,
        count: 3,
        effects: [
          { id: "restore_hp", name: "Restore HP", type: "heal", params: { amount: 2 } },
        ],
      },
      {
        id: "shield",
        name: "Shield",
        category: "equipment",
        description: "Blocks damage",
        count: 2,
        tags: ["defensive"],
      },
    ],
    winConditions: [
      { type: "last-standing" },
    ],
    drawConditions: [
      { type: "all-dead" },
    ],
    ui: {
      board: { type: "circular", playerAreas: { position: "auto", zones: [] }, sharedArea: { zones: [] } },
      cardTemplate: { front: { layout: "classic", fields: [{ id: "name", position: "top" }] }, back: {} },
    },
    characters: [
      {
        id: "hero",
        name: "Hero",
        faction: "good",
        hp: 30,
        maxHp: 30,
        skills: [
          { id: "bravery", name: "Bravery", type: "passive", description: "Takes less damage" },
        ],
      },
    ],
  };
}

describe("DeckLoader", () => {
  let loader: DeckLoader;

  beforeEach(() => {
    loader = new DeckLoader();
  });

  describe("loadFromJson", () => {
    it("should load a minimal valid deck", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);

      expect(deck.manifest.id).toBe("test-deck");
      expect(deck.manifest.name).toBe("Test Deck");
      expect(deck.rules.zones).toHaveLength(2);
      expect(deck.rules.phases).toHaveLength(3);
      expect(deck.rules.resources).toHaveLength(1);
      expect(deck.cards.size).toBe(2);
      expect(deck.cards.get("attack")?.name).toBe("Attack");
    });

    it("should throw DeckError on validation failure", () => {
      expect(() => loader.loadFromJson({})).toThrow(DeckError);
    });

    it("should throw DeckError when manifest.id is missing", () => {
      const json = makeMinimalDeck();
      (json.manifest as Record<string, unknown>).id = "";

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should throw DeckError when rules are missing", () => {
      const json = makeMinimalDeck();
      delete json.rules;

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should include validation error messages in exception", () => {
      const json = makeMinimalDeck();
      (json.manifest as Record<string, unknown>).id = "";
      delete json.rules;

      let caught: DeckError | null = null;
      try {
        loader.loadFromJson(json);
      } catch (e) {
        caught = e as DeckError;
      }
      expect(caught).toBeInstanceOf(DeckError);
      expect(caught!.message).toContain("Deck validation failed");
    });

    it("should handle missing optional cards array", () => {
      const json = makeMinimalDeck();
      delete json.cards;

      const deck = loader.loadFromJson(json);
      expect(deck.cards.size).toBe(0);
      expect(deck.instances).toEqual([]);
    });

    it("should reject cards as non-array", () => {
      const json = makeMinimalDeck();
      json.cards = "not-an-array" as unknown as Record<string, unknown>[];

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should skip cards with empty id", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({ name: "No ID" });

      const deck = loader.loadFromJson(json);
      expect(deck.cards.size).toBe(2); // only original 2 with valid ids
    });
  });

  describe("loadFromPath", () => {
    it("should throw DeckError for non-existent file", async () => {
      await expect(loader.loadFromPath("/nonexistent/deck.json"))
        .rejects.toThrow(DeckError);
    });

    it("should include path in error message for non-existent file", async () => {
      try {
        await loader.loadFromPath("/nonexistent/deck.json");
      } catch (e) {
        expect((e as DeckError).message).toContain("/nonexistent/deck.json");
      }
    });

    it("should throw DeckError for non-JSON file", async () => {
      const path = "/tmp/test-not-json.txt";
      const fs = await import("node:fs/promises");
      await fs.writeFile(path, "this is not json at all");

      try {
        await loader.loadFromPath(path);
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DeckError);
        expect((e as DeckError).message).toContain("Invalid JSON");
      } finally {
        await fs.unlink(path).catch(() => {});
      }
    });

    it("should throw DeckError for JSON array (not object)", async () => {
      const path = "/tmp/test-array.json";
      const fs = await import("node:fs/promises");
      await fs.writeFile(path, "[1, 2, 3]");

      try {
        await loader.loadFromPath(path);
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DeckError);
        expect((e as DeckError).message).toContain("must contain a JSON object");
      } finally {
        await fs.unlink(path).catch(() => {});
      }
    });

    it("should load a valid deck from file", async () => {
      const path = "/tmp/test-valid-deck.json";
      const fs = await import("node:fs/promises");
      const json = makeMinimalDeck();
      await fs.writeFile(path, JSON.stringify(json));

      try {
        const deck = await loader.loadFromPath(path);
        expect(deck.manifest.id).toBe("test-deck");
        expect(deck.cards.size).toBe(2);
      } finally {
        await fs.unlink(path).catch(() => {});
      }
    });

    it("should handle invalid deck in valid JSON file", async () => {
      const path = "/tmp/test-invalid-deck.json";
      const fs = await import("node:fs/promises");
      await fs.writeFile(path, JSON.stringify({ some: "data" }));

      try {
        await loader.loadFromPath(path);
        expect.unreachable("should have thrown");
      } catch (e) {
        expect(e).toBeInstanceOf(DeckError);
        expect((e as DeckError).message).toContain("validation failed");
      } finally {
        await fs.unlink(path).catch(() => {});
      }
    });
  });

  describe("validate", () => {
    it("should return valid result for valid deck", () => {
      const result = loader.validate(makeMinimalDeck());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it("should return invalid result for empty object", () => {
      const result = loader.validate({});
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should return warnings for missing author", () => {
      const json = makeMinimalDeck();
      delete (json.manifest as Record<string, unknown>).author;

      const result = loader.validate(json);
      expect(result.valid).toBe(true);
      expect(result.warnings.length).toBeGreaterThan(0);
    });
  });

  describe("card instantiation", () => {
    it("should create instances with count field", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({
        id: "multi", name: "Multi", category: "basic", count: 3,
      });

      const deck = loader.loadFromJson(json);
      expect(deck.instances).toBeDefined();
      const multiInstances = deck.instances!.filter((i) => i.definitionId === "multi");
      expect(multiInstances).toHaveLength(3);
    });

    it("should default count to 1 when not specified", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);

      const attackInstances = deck.instances!.filter((i) => i.definitionId === "attack");
      expect(attackInstances).toHaveLength(1);
    });

    it("should create instances with unique IDs", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[])[0] = {
        id: "basic", name: "Basic", category: "basic", count: 5,
      };

      const deck = loader.loadFromJson(json);
      const basicIds = deck.instances!.filter((i) => i.definitionId === "basic").map((i) => i.instanceId);
      const uniqueIds = new Set(basicIds);
      expect(uniqueIds.size).toBe(5);
    });

    it("should handle count of 0", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({
        id: "zero", name: "Zero", category: "basic", count: 0,
      });

      const deck = loader.loadFromJson(json);
      const zeroInstances = deck.instances!.filter((i) => i.definitionId === "zero");
      expect(zeroInstances).toHaveLength(0);
    });

    it("should clamp very large counts to 999", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({
        id: "horde", name: "Horde", category: "basic", count: 5000,
      });

      const deck = loader.loadFromJson(json);
      const hordeInstances = deck.instances!.filter((i) => i.definitionId === "horde");
      expect(hordeInstances).toHaveLength(999);
    });

    it("should set initial zone to deck and faceUp to false", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);

      for (const inst of deck.instances!) {
        expect(inst.zone).toBe("deck");
        expect(inst.faceUp).toBe(false);
        expect(inst.modifiers).toEqual([]);
        expect(inst.owner).toBe("");
      }
    });

    it("should return empty instances array when no cards defined", () => {
      const json = makeMinimalDeck();
      delete json.cards;

      const deck = loader.loadFromJson(json);
      expect(deck.instances).toEqual([]);
    });
  });

  describe("full deck load", () => {
    it("should parse all sections of a full deck", () => {
      const json = makeFullDeck();
      const deck = loader.loadFromJson(json);

      // Manifest
      expect(deck.manifest.id).toBe("full-deck");
      expect(deck.manifest.version).toBe("2.0.0");

      // Rules
      expect(deck.rules.zones).toHaveLength(3);
      expect(deck.rules.phases).toHaveLength(5);
      expect(deck.rules.resources).toHaveLength(2);
      expect(deck.rules.maxEffectSteps).toBe(500);
      expect(deck.rules.responseTimeout).toBe(30);

      // Cards
      expect(deck.cards.size).toBe(3);
      expect(deck.cards.get("fireball")?.cost).toBe(3);
      expect(deck.cards.get("fireball")?.category).toBe("trick");
      expect(deck.cards.get("shield")?.tags).toEqual(["defensive"]);

      // Effects
      expect(deck.effects.size).toBe(2);
      expect(deck.effects.get("deal_damage")?.type).toBe("damage");
      expect(deck.effects.get("restore_hp")?.params).toEqual({ amount: 2 });

      // Win/Draw conditions
      expect(deck.winConditions).toHaveLength(1);
      expect(deck.winConditions[0].type).toBe("last-standing");
      expect(deck.drawConditions).toHaveLength(1);

      // Characters
      expect(deck.characters).toHaveLength(1);
      expect(deck.characters![0].name).toBe("Hero");
      expect(deck.characters![0].skills).toHaveLength(1);

      // Instances
      const fireballInstances = deck.instances!.filter((i) => i.definitionId === "fireball");
      expect(fireballInstances).toHaveLength(4);

      const healInstances = deck.instances!.filter((i) => i.definitionId === "heal");
      expect(healInstances).toHaveLength(3);

      const shieldInstances = deck.instances!.filter((i) => i.definitionId === "shield");
      expect(shieldInstances).toHaveLength(2);

      expect(deck.instances).toHaveLength(9);
    });

    it("should handle deck without characters", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);
      expect(deck.characters).toBeUndefined();
    });

    it("should handle deck without win/draw conditions", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);
      expect(deck.winConditions).toEqual([]);
      expect(deck.drawConditions).toEqual([]);
    });

    it("should supply default UI when none provided", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);
      expect(deck.ui.board.type).toBe("circular");
      expect(deck.ui.cardTemplate.front.layout).toBe("classic");
    });

    it("should parse manifest tags", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);
      expect(deck.manifest.tags).toEqual(["test"]);
    });
  });

  describe("error handling", () => {
    it("should throw DeckError for missing manifest in parseDeck", () => {
      // Validated deck but we test internal parsing by loading json with empty manifest object
      const json = makeMinimalDeck();
      delete json.manifest;

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should throw DeckError for missing rules in parseDeck", () => {
      const json = makeMinimalDeck();
      delete json.rules;

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should reject cards as non-array object", () => {
      const json = makeMinimalDeck();
      json.cards = { not: "an array" } as unknown as Record<string, unknown>[];

      expect(() => loader.loadFromJson(json)).toThrow(DeckError);
    });

    it("should return empty effects for cards without effects", () => {
      const json = makeMinimalDeck();
      const deck = loader.loadFromJson(json);
      expect(deck.effects.size).toBe(0);
    });

    it("DeckError should have correct name", () => {
      const err = new DeckError("test");
      expect(err.name).toBe("DeckError");
      expect(err.message).toBe("test");
      expect(err).toBeInstanceOf(Error);
    });
  });

  describe("CardDefinition parsing", () => {
    it("should use card id as fallback name", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({ id: "no_name", category: "basic" });

      const deck = loader.loadFromJson(json);
      expect(deck.cards.get("no_name")?.name).toBe("no_name");
    });

    it("should default category to basic", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({ id: "no_cat", name: "No Category" });

      const deck = loader.loadFromJson(json);
      expect(deck.cards.get("no_cat")?.category).toBe("basic");
    });

    it("should parse description and cost", () => {
      const json = makeMinimalDeck();
      (json.cards as Record<string, unknown>[]).push({
        id: "detailed", name: "Detailed", category: "trick", description: "desc", cost: 5,
      });

      const deck = loader.loadFromJson(json);
      const card = deck.cards.get("detailed")!;
      expect(card.description).toBe("desc");
      expect(card.cost).toBe(5);
    });
  });
});