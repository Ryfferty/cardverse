import { describe, it, expect, beforeEach } from "vitest";
import { DeckValidator } from "./validator";
import type { ValidationResult } from "./types";

function validDeck(overrides?: Record<string, unknown>): Record<string, unknown> {
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
        { id: "deck", visibility: "none", ordered: true, faceDown: true, owner: "global" },
        { id: "hand", visibility: "owner", ordered: true, faceDown: false, owner: "player" },
      ],
      phases: [
        { id: "draw", name: "Draw", auto: true },
        { id: "play", name: "Play", auto: false },
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

function expectValid(result: ValidationResult): void {
  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
}

function expectError(result: ValidationResult, code: string): void {
  expect(result.errors.some((e) => e.code === code)).toBe(true);
}

function expectWarning(result: ValidationResult, code: string): void {
  expect(result.warnings.some((w) => w.code === code)).toBe(true);
}

describe("DeckValidator", () => {
  let validator: DeckValidator;

  beforeEach(() => {
    validator = new DeckValidator();
  });

  describe("manifest", () => {
    it("should pass a valid manifest", () => {
      const result = validator.validate(validDeck());
      expectValid(result);
    });

    it("should error on missing manifest", () => {
      const result = validator.validate({});
      expect(result.valid).toBe(false);
      expectError(result, "MANIFEST_MISSING");
    });

    it("should error on manifest as non-object", () => {
      const result = validator.validate({ manifest: "string" });
      expectError(result, "MANIFEST_MISSING");
    });

    it("should error on missing id", () => {
      const result = validator.validate(validDeck({
        manifest: { name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_ID");
    });

    it("should error on empty id", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "", name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_ID");
    });

    it("should error on missing name", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_NAME");
    });

    it("should error on missing version", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", minPlayers: 2, maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_VERSION");
    });

    it("should warn on missing author", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
      }));
      expect(result.valid).toBe(true);
      expectWarning(result, "MANIFEST_MISSING_AUTHOR");
    });

    it("should error on minPlayers < 1", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", version: "1.0.0", minPlayers: 0, maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_MIN_PLAYERS");
    });

    it("should error on minPlayers NaN", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", version: "1.0.0", minPlayers: "abc", maxPlayers: 4 },
      }));
      expectError(result, "MANIFEST_INVALID_MIN_PLAYERS");
    });

    it("should error on maxPlayers < minPlayers", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", version: "1.0.0", minPlayers: 4, maxPlayers: 2 },
      }));
      expectError(result, "MANIFEST_INVALID_MAX_PLAYERS");
    });

    it("should warn on non-array tags", () => {
      const result = validator.validate(validDeck({
        manifest: {
          id: "deck", name: "Test", version: "1.0.0",
          minPlayers: 2, maxPlayers: 4, tags: "not-array",
        },
      }));
      expect(result.valid).toBe(true); // warning only
      expectWarning(result, "MANIFEST_INVALID_TAGS");
    });
  });

  describe("rules", () => {
    it("should error on missing rules", () => {
      const json = validDeck();
      delete json.rules;
      const result = validator.validate(json);
      expectError(result, "RULES_MISSING");
    });

    it("should error on rules as non-object", () => {
      const result = validator.validate(validDeck({ rules: "string" }));
      expectError(result, "RULES_MISSING");
    });

    it("should error on missing zones", () => {
      const json = validDeck();
      delete (json.rules as Record<string, unknown>).zones;
      const result = validator.validate(json);
      expectError(result, "RULES_MISSING_ZONES");
    });

    it("should error on empty zones array", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "RULES_MISSING_ZONES");
    });

    it("should error on missing phases", () => {
      const json = validDeck();
      delete (json.rules as Record<string, unknown>).phases;
      const result = validator.validate(json);
      expectError(result, "RULES_MISSING_PHASES");
    });

    it("should error on non-array resources", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          resources: "not-array",
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "RULES_INVALID_RESOURCES");
    });

    it("should warn on unknown turn order", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "random",
        },
      }));
      expect(result.valid).toBe(true);
      expectWarning(result, "RULES_UNKNOWN_TURN_ORDER");
    });

    it("should accept valid turn orders", () => {
      for (const order of ["clockwise", "counterclockwise", "custom"]) {
        const result = validator.validate(validDeck({
          rules: {
            zones: [{ id: "deck", owner: "global" }],
            phases: [{ id: "play", name: "Play" }],
            turnOrder: order,
          },
        }));
        expect(result.valid).toBe(true);
      }
    });

    it("should warn on non-number maxEffectSteps", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
          maxEffectSteps: "abc",
        },
      }));
      expectWarning(result, "RULES_INVALID_MAX_EFFECT_STEPS");
    });

    it("should warn on non-number responseTimeout", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
          responseTimeout: "abc",
        },
      }));
      expectWarning(result, "RULES_INVALID_RESPONSE_TIMEOUT");
    });
  });

  describe("zones", () => {
    it("should error on zone missing id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ visibility: "none", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "ZONE_MISSING_ID");
    });

    it("should error on duplicate zone id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [
            { id: "deck", owner: "global" },
            { id: "deck", owner: "global" },
          ],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "ZONE_DUPLICATE_ID");
    });

    it("should warn on unknown visibility", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", visibility: "everyone", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          turnOrder: "clockwise",
        },
      }));
      expectWarning(result, "ZONE_UNKNOWN_VISIBILITY");
    });
  });

  describe("phases", () => {
    it("should error on phase missing id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ name: "Play" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "PHASE_MISSING_ID");
    });

    it("should error on duplicate phase id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [
            { id: "play", name: "Play" },
            { id: "play", name: "Play 2" },
          ],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "PHASE_DUPLICATE_ID");
    });

    it("should warn on phase missing name", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", auto: true }],
          turnOrder: "clockwise",
        },
      }));
      expectWarning(result, "PHASE_MISSING_NAME");
    });
  });

  describe("resources", () => {
    it("should error on resource missing id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          resources: [{ name: "Health" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "RESOURCE_MISSING_ID");
    });

    it("should error on duplicate resource id", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          resources: [
            { id: "health", defaultValue: 3 },
            { id: "health", defaultValue: 5 },
          ],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "RESOURCE_DUPLICATE_ID");
    });

    it("should error on non-number defaultValue", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          resources: [{ id: "health", defaultValue: "abc" }],
          turnOrder: "clockwise",
        },
      }));
      expectError(result, "RESOURCE_INVALID_DEFAULT");
    });

    it("should warn on min > max", () => {
      const result = validator.validate(validDeck({
        rules: {
          zones: [{ id: "deck", owner: "global" }],
          phases: [{ id: "play", name: "Play" }],
          resources: [{ id: "health", defaultValue: 3, min: 5, max: 0 }],
          turnOrder: "clockwise",
        },
      }));
      expectWarning(result, "RESOURCE_MIN_GT_MAX");
    });
  });

  describe("cards", () => {
    it("should error on non-array cards", () => {
      const result = validator.validate(validDeck({ cards: "not-array" }));
      expectError(result, "CARDS_NOT_ARRAY");
    });

    it("should warn on card missing id", () => {
      const result = validator.validate(validDeck({
        cards: [{ name: "No ID", category: "basic" }],
      }));
      expectWarning(result, "CARD_MISSING_ID");
    });

    it("should error on duplicate card id", () => {
      const result = validator.validate(validDeck({
        cards: [
          { id: "dup", name: "First", category: "basic" },
          { id: "dup", name: "Second", category: "basic" },
        ],
      }));
      expectError(result, "CARD_DUPLICATE_ID");
    });

    it("should warn on card missing name", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "noname", category: "basic" }],
      }));
      expectWarning(result, "CARD_MISSING_NAME");
    });

    it("should warn on card missing category", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "nocat", name: "No Category" }],
      }));
      expectWarning(result, "CARD_MISSING_CATEGORY");
    });

    it("should warn on negative cost", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "neg", name: "Neg Cost", category: "basic", cost: -1 }],
      }));
      expectWarning(result, "CARD_INVALID_COST");
    });

    it("should warn on non-number cost", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "badcost", name: "Bad Cost", category: "basic", cost: "free" }],
      }));
      expectWarning(result, "CARD_INVALID_COST");
    });

    it("should warn on invalid count", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "small", name: "Small", category: "basic", count: 0 }],
      }));
      expectWarning(result, "CARD_INVALID_COUNT");
    });

    it("should warn on non-array tags", () => {
      const result = validator.validate(validDeck({
        cards: [{ id: "tag", name: "Tagged", category: "basic", tags: "not-array" }],
      }));
      expectWarning(result, "CARD_INVALID_TAGS");
    });

    it("should pass valid cards without warnings", () => {
      const result = validator.validate(validDeck());
      expectValid(result);
    });
  });

  describe("characters", () => {
    it("should pass deck without characters", () => {
      const result = validator.validate(validDeck());
      expectValid(result);
    });

    it("should error on non-array characters", () => {
      const result = validator.validate(validDeck({ characters: "string" }));
      expectError(result, "CHARACTERS_NOT_ARRAY");
    });

    it("should error on character missing id", () => {
      const result = validator.validate(validDeck({
        characters: [{ name: "No ID", hp: 3, maxHp: 3 }],
      }));
      expectError(result, "CHARACTER_MISSING_ID");
    });

    it("should error on duplicate character id", () => {
      const result = validator.validate(validDeck({
        characters: [
          { id: "hero", name: "Hero", hp: 3, maxHp: 3 },
          { id: "hero", name: "Hero Copy", hp: 3, maxHp: 3 },
        ],
      }));
      expectError(result, "CHARACTER_DUPLICATE_ID");
    });

    it("should warn on character missing name", () => {
      const result = validator.validate(validDeck({
        characters: [{ id: "anon", hp: 3, maxHp: 3 }],
      }));
      expectWarning(result, "CHARACTER_MISSING_NAME");
    });

    it("should error on non-positive hp", () => {
      const result = validator.validate(validDeck({
        characters: [{ id: "weak", name: "Weak", hp: 0, maxHp: 3 }],
      }));
      expectError(result, "CHARACTER_INVALID_HP");
    });

    it("should error on non-positive maxHp", () => {
      const result = validator.validate(validDeck({
        characters: [{ id: "sick", name: "Sick", hp: 3, maxHp: 0 }],
      }));
      expectError(result, "CHARACTER_INVALID_MAX_HP");
    });

    it("should error when hp > maxHp", () => {
      const result = validator.validate(validDeck({
        characters: [{ id: "overflow", name: "Overflow", hp: 5, maxHp: 3 }],
      }));
      expectError(result, "CHARACTER_HP_GT_MAX");
    });

    it("should error on non-array skills", () => {
      const result = validator.validate(validDeck({
        characters: [{ id: "hero", name: "Hero", hp: 3, maxHp: 3, skills: "not-array" }],
      }));
      expectError(result, "CHARACTER_INVALID_SKILLS");
    });

    it("should pass valid character with skills", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero",
          name: "Hero",
          hp: 3,
          maxHp: 3,
          skills: [
            { id: "bravery", name: "Bravery", type: "passive", description: "Takes less damage" },
          ],
        }],
      }));
      expectValid(result);
    });
  });

  describe("skills", () => {
    it("should error on skill missing id", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero", name: "Hero", hp: 3, maxHp: 3,
          skills: [{ name: "No ID", type: "active", description: "test" }],
        }],
      }));
      expectError(result, "SKILL_MISSING_ID");
    });

    it("should warn on duplicate skill id", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero", name: "Hero", hp: 3, maxHp: 3,
          skills: [
            { id: "dup", name: "First", type: "active", description: "a" },
            { id: "dup", name: "Second", type: "passive", description: "b" },
          ],
        }],
      }));
      expectWarning(result, "SKILL_DUPLICATE_ID");
    });

    it("should warn on skill missing name", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero", name: "Hero", hp: 3, maxHp: 3,
          skills: [{ id: "unnamed", type: "active", description: "test" }],
        }],
      }));
      expectWarning(result, "SKILL_MISSING_NAME");
    });

    it("should warn on unknown skill type", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero", name: "Hero", hp: 3, maxHp: 3,
          skills: [{ id: "weird", name: "Weird", type: "super", description: "test" }],
        }],
      }));
      expectWarning(result, "SKILL_UNKNOWN_TYPE");
    });

    it("should accept all valid skill types", () => {
      const types = ["active", "passive", "locked", "awakening", "lord"];
      for (const type of types) {
        const result = validator.validate(validDeck({
          characters: [{
            id: "hero", name: "Hero", hp: 3, maxHp: 3,
            skills: [{ id: `sk_${type}`, name: type, type, description: "test" }],
          }],
        }));
        expectValid(result);
      }
    });

    it("should warn on skill missing description", () => {
      const result = validator.validate(validDeck({
        characters: [{
          id: "hero", name: "Hero", hp: 3, maxHp: 3,
          skills: [{ id: "nodesc", name: "NoDesc", type: "active" }],
        }],
      }));
      expectWarning(result, "SKILL_MISSING_DESC");
    });
  });

  describe("win conditions", () => {
    it("should pass valid win conditions", () => {
      const result = validator.validate(validDeck({
        winConditions: [{ type: "last-standing" }],
      }));
      expectValid(result);
    });

    it("should error on non-array win conditions", () => {
      const result = validator.validate(validDeck({ winConditions: "string" }));
      expectError(result, "WIN_NOT_ARRAY");
    });

    it("should warn on unknown win type", () => {
      const result = validator.validate(validDeck({
        winConditions: [{ type: "impossible" }],
      }));
      expectWarning(result, "WIN_UNKNOWN_TYPE");
    });

    it("should accept all valid win types", () => {
      const types = ["last-standing", "reach-score", "complete-objective", "custom"];
      for (const type of types) {
        const result = validator.validate(validDeck({
          winConditions: [{ type }],
        }));
        expectValid(result);
      }
    });
  });

  describe("draw conditions", () => {
    it("should pass valid draw conditions", () => {
      const result = validator.validate(validDeck({
        drawConditions: [{ type: "timeout" }],
      }));
      expectValid(result);
    });

    it("should error on non-array draw conditions", () => {
      const result = validator.validate(validDeck({ drawConditions: "string" }));
      expectError(result, "DRAW_NOT_ARRAY");
    });

    it("should warn on unknown draw type", () => {
      const result = validator.validate(validDeck({
        drawConditions: [{ type: "unknown" }],
      }));
      expectWarning(result, "DRAW_UNKNOWN_TYPE");
    });

    it("should accept all valid draw types", () => {
      const types = ["all-dead", "timeout", "custom"];
      for (const type of types) {
        const result = validator.validate(validDeck({
          drawConditions: [{ type }],
        }));
        expectValid(result);
      }
    });
  });

  describe("error vs warning grading", () => {
    it("should be valid when only warnings exist", () => {
      const result = validator.validate(validDeck({
        manifest: {
          id: "deck", name: "Test", version: "1.0.0",
          minPlayers: 2, maxPlayers: 4, // missing author — warning only
        },
      }));
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.warnings.length).toBeGreaterThan(0);
    });

    it("should be invalid when errors exist alongside warnings", () => {
      const result = validator.validate(validDeck({
        manifest: {
          id: "", name: "Test", version: "1.0.0",
          minPlayers: 2, maxPlayers: 4, // missing id — error
        },
      }));
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
    });

    it("should report multiple errors at once", () => {
      const json = validDeck();
      delete (json as Record<string, unknown>).manifest;
      delete (json as Record<string, unknown>).rules;

      const result = validator.validate(json);
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });

    it("should include paths in errors", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "deck", name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
        cards: "not-array",
      }));
      const cardError = result.errors.find((e) => e.code === "CARDS_NOT_ARRAY");
      expect(cardError?.path).toBe("cards");
    });
  });

  describe("error codes", () => {
    it("should return errors with code, message, and optional path", () => {
      const result = validator.validate(validDeck({
        manifest: { id: "", name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4 },
      }));
      for (const error of result.errors) {
        expect(error.code).toBeTruthy();
        expect(typeof error.code).toBe("string");
        expect(error.message).toBeTruthy();
      }
    });

    it("should return warnings with code, message, and optional path", () => {
      const result = validator.validate(validDeck({
        manifest: {
          id: "deck", name: "Test", version: "1.0.0", minPlayers: 2, maxPlayers: 4,
        },
      }));
      for (const warning of result.warnings) {
        expect(warning.code).toBeTruthy();
        expect(typeof warning.code).toBe("string");
        expect(warning.message).toBeTruthy();
      }
    });
  });
});