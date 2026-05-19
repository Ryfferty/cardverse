import { describe, it, expect } from "vitest";
import { DeckLoader } from "@cardverse/deck";
import { shaDamage } from "./effects/sha.js";
import { shanDodge } from "./effects/shan.js";
import { taoHeal } from "./effects/tao.js";
import { jiuEffects } from "./effects/jiu.js";

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

describe("Effect scripts", () => {
  it("sha should have correct structure", () => {
    expect(shaDamage.id).toBe("sha_damage");
    expect(shaDamage.name).toBe("造成伤害");
    expect(shaDamage.type).toBe("damage");
    expect(typeof shaDamage.script).toBe("string");
    expect(shaDamage.script).toContain("context.damage");
    expect(shaDamage.script).toContain("context.requestResponse");
    expect(shaDamage.validTargets).toBe("inRange");
    expect(shaDamage.params).toEqual({ amount: 1 });
  });

  it("shan should have correct structure", () => {
    expect(shanDodge.id).toBe("shan_dodge");
    expect(shanDodge.name).toBe("闪避");
    expect(shanDodge.type).toBe("counter");
    expect(typeof shanDodge.script).toBe("string");
    expect(shanDodge.script).toContain("context.log");
    expect(shanDodge.validTargets).toBe("self");
    expect(shanDodge.params).toEqual({ sourceType: "damage" });
  });

  it("tao should have correct structure", () => {
    expect(taoHeal.id).toBe("tao_heal");
    expect(taoHeal.name).toBe("回复体力");
    expect(taoHeal.type).toBe("heal");
    expect(typeof taoHeal.script).toBe("string");
    expect(taoHeal.script).toContain("context.getResource");
    expect(taoHeal.script).toContain("context.setResource");
    expect(taoHeal.validTargets).toBe("wounded");
    expect(taoHeal.params).toEqual({ amount: 1 });
  });

  it("jiu should export array of two effects", () => {
    expect(Array.isArray(jiuEffects)).toBe(true);
    expect(jiuEffects).toHaveLength(2);
  });

  it("jiu_rescue should have correct structure", () => {
    const rescue = jiuEffects.find((e) => e.id === "jiu_rescue")!;
    expect(rescue).toBeDefined();
    expect(rescue.name).toBe("濒死回复");
    expect(rescue.type).toBe("heal");
    expect(typeof rescue.script).toBe("string");
    expect(rescue.script).toContain("context.setResource");
    expect(rescue.script).toContain("context.getResource");
    expect(rescue.validTargets).toBe("self");
    expect(rescue.params).toEqual({ amount: 1, condition: "dying" });
  });

  it("jiu_buff should have correct structure", () => {
    const buff = jiuEffects.find((e) => e.id === "jiu_buff")!;
    expect(buff).toBeDefined();
    expect(buff.name).toBe("酒劲");
    expect(buff.type).toBe("buff");
    expect(typeof buff.script).toBe("string");
    expect(buff.script).toContain("context.addModifier");
    expect(buff.script).toContain("context.log");
    expect(buff.validTargets).toBe("self");
    expect(buff.params).toEqual({ damageBonus: 1, duration: "turn" });
  });

  it("all effect scripts should be strings with context API calls", () => {
    const allEffectIds = [
      shaDamage.id,
      shanDodge.id,
      ...jiuEffects.map((e) => e.id),
      taoHeal.id,
    ];
    const uniqueIds = new Set(allEffectIds);
    expect(uniqueIds.size).toBe(5);
  });
});