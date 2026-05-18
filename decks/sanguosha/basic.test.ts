import { describe, it, expect } from "vitest";
import { DeckLoader, DeckError } from "@cardverse/deck";

describe("Sanguosha Basic Deck", () => {
  const basicJson = {
    manifest: {
      id: "sanguosha",
      name: "三国杀",
      version: "1.0.0",
      author: "CardVerse",
      description: "三国杀标准版卡组——包含基本牌（杀、闪、桃、酒）",
      minPlayers: 2,
      maxPlayers: 8,
      frameworkVersion: "1.0.0",
      tags: ["sanguosha", "basic", "standard"],
    },
    rules: {
      zones: [
        { id: "deck", name: "牌堆", visibility: "none", ordered: true, faceDown: true, owner: "global" },
        { id: "discard", name: "弃牌堆", visibility: "all", ordered: false, faceDown: false, owner: "global" },
        { id: "hand", name: "手牌", visibility: "owner", ordered: true, faceDown: false, owner: "player" },
        { id: "equipment", name: "装备区", visibility: "all", ordered: false, faceDown: false, owner: "player" },
        { id: "judge", name: "判定区", visibility: "all", ordered: true, faceDown: false, owner: "player" },
      ],
      phases: [
        { id: "prepare", name: "准备阶段", auto: true },
        { id: "judge", name: "判定阶段", auto: true },
        { id: "draw", name: "摸牌阶段", auto: true },
        { id: "play", name: "出牌阶段", auto: false },
        { id: "discard", name: "弃牌阶段", auto: true },
        { id: "end", name: "结束阶段", auto: true },
      ],
      resources: [
        { id: "health", name: "体力", defaultValue: 3, min: 0, max: 5 },
        { id: "maxHealth", name: "体力上限", defaultValue: 3, min: 1, max: 8 },
      ],
      turnOrder: "counterclockwise",
    },
    cards: [
      {
        id: "sha",
        name: "杀",
        category: "basic",
        description: "对攻击范围内一名角色造成1点伤害",
        count: 30,
        tags: ["attack", "single-target"],
        effects: [
          { id: "sha_damage", name: "造成伤害", type: "damage", params: { amount: 1 }, validTargets: "inRange", script: "effects/sha.js" },
        ],
      },
      {
        id: "shan",
        name: "闪",
        category: "basic",
        description: "抵消一张杀的效果",
        count: 15,
        tags: ["defense", "response"],
        effects: [
          { id: "shan_dodge", name: "闪避", type: "counter", params: { sourceType: "damage" }, validTargets: "self", script: "effects/shan.js" },
        ],
      },
      {
        id: "tao",
        name: "桃",
        category: "basic",
        description: "回复1点体力",
        count: 8,
        tags: ["heal", "self-or-other"],
        effects: [
          { id: "tao_heal", name: "回复体力", type: "heal", params: { amount: 1 }, validTargets: "wounded", script: "effects/tao.js" },
        ],
      },
      {
        id: "jiu",
        name: "酒",
        category: "basic",
        description: "本回合下一张杀伤害+1；濒死状态下回复1点体力",
        count: 5,
        tags: ["buff", "self", "rescue"],
        effects: [
          { id: "jiu_rescue", name: "濒死回复", type: "heal", params: { amount: 1, condition: "dying" }, validTargets: "self", script: "effects/jiu.js" },
          { id: "jiu_buff", name: "酒劲", type: "buff", params: { damageBonus: 1, duration: "turn" }, validTargets: "self", script: "effects/jiu.js" },
        ],
      },
    ],
    winConditions: [{ type: "last-standing" }],
    drawConditions: [{ type: "all-dead" }],
  };

  it("should load the basic deck successfully", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.manifest.id).toBe("sanguosha");
    expect(deck.manifest.name).toBe("三国杀");
    expect(deck.manifest.minPlayers).toBe(2);
    expect(deck.manifest.maxPlayers).toBe(8);
  });

  it("should have correct rules configuration", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.rules.zones).toHaveLength(5);
    expect(deck.rules.phases).toHaveLength(6);
    expect(deck.rules.resources).toHaveLength(2);
    expect(deck.rules.turnOrder).toBe("counterclockwise");
  });

  it("should have 4 card definitions", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.cards.size).toBe(4);
    expect(deck.cards.has("sha")).toBe(true);
    expect(deck.cards.has("shan")).toBe(true);
    expect(deck.cards.has("tao")).toBe(true);
    expect(deck.cards.has("jiu")).toBe(true);
  });

  it("should have correct card categories", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.cards.get("sha")?.category).toBe("basic");
    expect(deck.cards.get("shan")?.category).toBe("basic");
    expect(deck.cards.get("tao")?.category).toBe("basic");
    expect(deck.cards.get("jiu")?.category).toBe("basic");
  });

  it("should instantiate 58 total cards", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.instances).toBeDefined();
    expect(deck.instances!.length).toBe(58);
  });

  it("should instantiate correct count for each card", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    const shaCount = deck.instances!.filter((i) => i.definitionId === "sha").length;
    const shanCount = deck.instances!.filter((i) => i.definitionId === "shan").length;
    const taoCount = deck.instances!.filter((i) => i.definitionId === "tao").length;
    const jiuCount = deck.instances!.filter((i) => i.definitionId === "jiu").length;

    expect(shaCount).toBe(30);
    expect(shanCount).toBe(15);
    expect(taoCount).toBe(8);
    expect(jiuCount).toBe(5);
  });

  it("should have correct effects for sha", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.effects.size).toBe(5); // 1 + 1 + 1 + 2
    expect(deck.effects.get("sha_damage")?.type).toBe("damage");
    expect(deck.effects.get("sha_damage")?.params).toEqual({ amount: 1 });
  });

  it("should have correct effects for jiu (two effects)", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(basicJson);

    expect(deck.effects.has("jiu_rescue")).toBe(true);
    expect(deck.effects.has("jiu_buff")).toBe(true);
    expect(deck.effects.get("jiu_rescue")?.type).toBe("heal");
    expect(deck.effects.get("jiu_buff")?.type).toBe("buff");
  });
});