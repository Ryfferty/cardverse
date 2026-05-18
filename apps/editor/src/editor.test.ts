import { describe, it, expect } from "vitest";
import {
  createEmptyCard,
  createEmptyCharacter,
  cardToJSON,
  characterToJSON,
  buildDeckExport,
} from "./editor.js";
import type { CardEditorData, CharacterEditorData } from "./editor.js";

describe("createEmptyCard", () => {
  it("should create a card with default values", () => {
    const card = createEmptyCard();
    expect(card.id).toBe("");
    expect(card.name).toBe("");
    expect(card.category).toBe("basic");
    expect(card.count).toBe(1);
    expect(card.description).toBe("");
    expect(card.effects).toEqual([]);
  });
});

describe("createEmptyCharacter", () => {
  it("should create a character with default values", () => {
    const char = createEmptyCharacter();
    expect(char.id).toBe("");
    expect(char.name).toBe("");
    expect(char.faction).toBe("shu");
    expect(char.hp).toBe(4);
    expect(char.maxHp).toBe(4);
    expect(char.skills).toEqual([]);
  });
});

describe("cardToJSON", () => {
  it("should serialize a card with effects to JSON", () => {
    const card: CardEditorData = {
      id: "sha",
      name: "杀",
      category: "basic",
      count: 30,
      description: "基础攻击牌",
      effects: [
        {
          id: "sha_damage",
          name: "伤害",
          type: "damage",
          params: { amount: 1 },
          script: "./effects/sha.js",
        },
      ],
    };

    const json = cardToJSON(card);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe("sha");
    expect(parsed.name).toBe("杀");
    expect(parsed.category).toBe("basic");
    expect(parsed.count).toBe(30);
    expect(parsed.description).toBe("基础攻击牌");
    expect(parsed.effects).toHaveLength(1);
    expect(parsed.effects[0].id).toBe("sha_damage");
    expect(parsed.effects[0].type).toBe("damage");
    expect(parsed.effects[0].params.amount).toBe(1);
  });

  it("should omit empty description", () => {
    const card: CardEditorData = {
      id: "shan",
      name: "闪",
      category: "basic",
      count: 15,
      description: "",
      effects: [],
    };

    const json = cardToJSON(card);
    const parsed = JSON.parse(json);

    expect(parsed.description).toBeUndefined();
  });

  it("should produce valid JSON for minimal card", () => {
    const card: CardEditorData = {
      id: "test",
      name: "Test",
      category: "trick",
      count: 1,
      description: "",
      effects: [],
    };

    const json = cardToJSON(card);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("should include effect params correctly", () => {
    const card: CardEditorData = {
      id: "heal",
      name: "治疗",
      category: "basic",
      count: 8,
      description: "",
      effects: [
        { id: "h1", name: "回复", type: "heal", params: { hp: 1 }, script: "" },
        { id: "h2", name: "大量回复", type: "heal", params: { hp: 3, target: "self" }, script: "" },
      ],
    };

    const json = cardToJSON(card);
    const parsed = JSON.parse(json);

    expect(parsed.effects[0].params.hp).toBe(1);
    expect(parsed.effects[1].params.hp).toBe(3);
    expect(parsed.effects[1].params.target).toBe("self");
  });
});

describe("characterToJSON", () => {
  it("should serialize a character with skills to JSON", () => {
    const char: CharacterEditorData = {
      id: "caocao",
      name: "曹操",
      faction: "wei",
      hp: 4,
      maxHp: 4,
      skills: [
        {
          id: "jianxiong",
          name: "奸雄",
          effect: "caocao_jianxiong",
          type: "trigger",
          description: "当你受到伤害后，可以获得造成伤害的牌。",
        },
      ],
    };

    const json = characterToJSON(char);
    const parsed = JSON.parse(json);

    expect(parsed.id).toBe("caocao");
    expect(parsed.name).toBe("曹操");
    expect(parsed.faction).toBe("wei");
    expect(parsed.hp).toBe(4);
    expect(parsed.maxHp).toBe(4);
    expect(parsed.skills).toHaveLength(1);
    expect(parsed.skills[0].id).toBe("jianxiong");
    expect(parsed.skills[0].type).toBe("trigger");
    expect(parsed.skills[0].description).toBe("当你受到伤害后，可以获得造成伤害的牌。");
  });

  it("should produce valid JSON for minimal character", () => {
    const char: CharacterEditorData = {
      id: "test_char",
      name: "TestChar",
      faction: "wu",
      hp: 3,
      maxHp: 3,
      skills: [],
    };

    const json = characterToJSON(char);
    expect(() => JSON.parse(json)).not.toThrow();
  });
});

describe("buildDeckExport", () => {
  it("should export a full deck with cards and characters", () => {
    const cards: CardEditorData[] = [
      { id: "sha", name: "杀", category: "basic", count: 30, description: "", effects: [] },
      { id: "shan", name: "闪", category: "basic", count: 15, description: "", effects: [] },
    ];

    const characters: CharacterEditorData[] = [
      { id: "zhangfei", name: "张飞", faction: "shu", hp: 4, maxHp: 4, skills: [] },
    ];

    const json = buildDeckExport(cards, characters);
    const parsed = JSON.parse(json);

    expect(parsed.cards).toHaveLength(2);
    expect(parsed.characters).toHaveLength(1);
    expect(parsed.manifest.id).toBe("custom-deck");
    expect(parsed.manifest.name).toBe("自定义卡组");
    expect(parsed.manifest.version).toBe("1.0.0");
    expect(parsed.manifest.created).toBeTruthy();
  });

  it("should handle empty deck export", () => {
    const json = buildDeckExport([], []);
    const parsed = JSON.parse(json);

    expect(parsed.cards).toEqual([]);
    expect(parsed.characters).toEqual([]);
  });
});