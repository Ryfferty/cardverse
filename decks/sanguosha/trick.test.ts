import { describe, it, expect } from "vitest";
import { DeckLoader } from "@cardverse/deck";
import { guoheDiscard } from "./effects/guohe.js";
import { shunshouSteal } from "./effects/shunshou.js";
import { wuzhongDraw } from "./effects/wuzhong.js";
import { wuxieNullify } from "./effects/wuxie.js";
import { juedouDuel } from "./effects/juedou.js";
import { nanmanAoe } from "./effects/nanman.js";
import { wanjianAoe } from "./effects/wanjian.js";
import { taoyuanHeal } from "./effects/taoyuan.js";

describe("Sanguosha Trick Deck", () => {
  const trickJson = {
    manifest: {
      id: "sanguosha-tricks",
      name: "三国杀 — 锦囊牌",
      version: "1.0.0",
      author: "CardVerse",
      description: "三国杀标准版锦囊牌定义",
      minPlayers: 2,
      maxPlayers: 8,
      frameworkVersion: "1.0.0",
      tags: ["sanguosha", "trick", "standard"],
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
        id: "guohe", name: "过河拆桥", category: "trick",
        description: "弃置目标角色区域内的一张牌", count: 6,
        tags: ["single-target", "disrupt"],
        effects: [{ id: "guohe_discard", name: "弃置目标牌", type: "dismantle", params: { count: 1 }, validTargets: "enemyWithCards", script: "effects/guohe.js" }],
      },
      {
        id: "shunshou", name: "顺手牵羊", category: "trick",
        description: "获得目标角色区域内的一张牌", count: 5,
        tags: ["single-target", "steal", "disrupt"],
        effects: [{ id: "shunshou_steal", name: "获得目标牌", type: "steal", params: { count: 1 }, validTargets: "enemyWithCards", script: "effects/shunshou.js" }],
      },
      {
        id: "wuzhong", name: "无中生有", category: "trick",
        description: "摸两张牌", count: 4,
        tags: ["self-benefit", "draw"],
        effects: [{ id: "wuzhong_draw", name: "摸两张牌", type: "draw", params: { count: 2 }, validTargets: "self", script: "effects/wuzhong.js" }],
      },
      {
        id: "wuxie", name: "无懈可击", category: "trick",
        description: "抵消一张锦囊牌的效果", count: 7,
        tags: ["response", "counter"],
        effects: [{ id: "wuxie_nullify", name: "抵消锦囊效果", type: "counter", params: { cardCategory: "trick" }, validTargets: "indirect", script: "effects/wuxie.js" }],
      },
      {
        id: "juedou", name: "决斗", category: "trick",
        description: "与目标角色轮流使用杀，先无法使用者受1点伤害", count: 3,
        tags: ["single-target", "duel"],
        effects: [{ id: "juedou_duel", name: "决斗伤害", type: "duel", params: { cardId: "sha" }, validTargets: "enemy", script: "effects/juedou.js" }],
      },
      {
        id: "nanman", name: "南蛮入侵", category: "trick",
        description: "所有其他角色需使用一张杀，否则受1点伤害", count: 3,
        tags: ["aoe", "group"],
        effects: [{ id: "nanman_aoe", name: "南蛮入侵效果", type: "aoe", params: { requiredCard: "sha", damage: 1 }, validTargets: "allOther", script: "effects/nanman.js" }],
      },
      {
        id: "wanjian", name: "万箭齐发", category: "trick",
        description: "所有其他角色需使用一张闪，否则受1点伤害", count: 1,
        tags: ["aoe", "group"],
        effects: [{ id: "wanjian_aoe", name: "万箭齐发效果", type: "aoe", params: { requiredCard: "shan", damage: 1 }, validTargets: "allOther", script: "effects/wanjian.js" }],
      },
      {
        id: "taoyuan", name: "桃园结义", category: "trick",
        description: "所有角色恢复1点体力", count: 1,
        tags: ["aoe", "heal", "group"],
        effects: [{ id: "taoyuan_heal", name: "桃园恢复", type: "aoeHeal", params: { amount: 1 }, validTargets: "all", script: "effects/taoyuan.js" }],
      },
    ],
    winConditions: [{ type: "last-standing" }],
    drawConditions: [{ type: "all-dead" }],
  };

  it("should load the trick deck successfully", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.manifest.id).toBe("sanguosha-tricks");
    expect(deck.manifest.name).toBe("三国杀 — 锦囊牌");
    expect(deck.manifest.minPlayers).toBe(2);
    expect(deck.manifest.maxPlayers).toBe(8);
  });

  it("should have 8 card definitions", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.cards.size).toBe(8);
    expect(deck.cards.has("guohe")).toBe(true);
    expect(deck.cards.has("shunshou")).toBe(true);
    expect(deck.cards.has("wuzhong")).toBe(true);
    expect(deck.cards.has("wuxie")).toBe(true);
    expect(deck.cards.has("juedou")).toBe(true);
    expect(deck.cards.has("nanman")).toBe(true);
    expect(deck.cards.has("wanjian")).toBe(true);
    expect(deck.cards.has("taoyuan")).toBe(true);
  });

  it("should have correct card categories (all trick)", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    for (const [_id, card] of deck.cards) {
      expect(card.category).toBe("trick");
    }
  });

  it("should instantiate 30 total cards", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.instances).toBeDefined();
    expect(deck.instances!.length).toBe(30); // 6+5+4+7+3+3+1+1
  });

  it("should instantiate correct count for each trick card", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    const expectedCounts: Record<string, number> = {
      guohe: 6,
      shunshou: 5,
      wuzhong: 4,
      wuxie: 7,
      juedou: 3,
      nanman: 3,
      wanjian: 1,
      taoyuan: 1,
    };

    for (const [id, expected] of Object.entries(expectedCounts)) {
      const count = deck.instances!.filter((i) => i.definitionId === id).length;
      expect(count).toBe(expected);
    }
  });

  it("should have 8 effect definitions", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.effects.size).toBe(8);
  });

  it("should have correct effects for guohe", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.effects.get("guohe_discard")?.type).toBe("dismantle");
    expect(deck.effects.get("guohe_discard")?.validTargets).toBe("enemyWithCards");
  });

  it("should have correct effects for nanman", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.effects.get("nanman_aoe")?.type).toBe("aoe");
    expect(deck.effects.get("nanman_aoe")?.validTargets).toBe("allOther");
  });

  it("should have correct effects for taoyuan", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(trickJson);

    expect(deck.effects.get("taoyuan_heal")?.type).toBe("aoeHeal");
    expect(deck.effects.get("taoyuan_heal")?.validTargets).toBe("all");
    expect(deck.effects.get("taoyuan_heal")?.params).toEqual({ amount: 1 });
  });
});

describe("Trick effect scripts", () => {
  it("guohe should have correct structure", () => {
    expect(guoheDiscard.id).toBe("guohe_discard");
    expect(guoheDiscard.name).toBe("弃置目标牌");
    expect(guoheDiscard.type).toBe("dismantle");
    expect(typeof guoheDiscard.script).toBe("string");
    expect(guoheDiscard.script).toContain("context.requestResponse");
    expect(guoheDiscard.script).toContain("context.log");
    expect(guoheDiscard.validTargets).toBe("enemyWithCards");
    expect(guoheDiscard.params).toEqual({ count: 1 });
  });

  it("shunshou should have correct structure", () => {
    expect(shunshouSteal.id).toBe("shunshou_steal");
    expect(shunshouSteal.name).toBe("获得目标牌");
    expect(shunshouSteal.type).toBe("steal");
    expect(typeof shunshouSteal.script).toBe("string");
    expect(shunshouSteal.script).toContain("context.requestResponse");
    expect(shunshouSteal.validTargets).toBe("enemyWithCards");
  });

  it("wuzhong should have correct structure", () => {
    expect(wuzhongDraw.id).toBe("wuzhong_draw");
    expect(wuzhongDraw.name).toBe("摸两张牌");
    expect(wuzhongDraw.type).toBe("draw");
    expect(typeof wuzhongDraw.script).toBe("string");
    expect(wuzhongDraw.script).toContain("context.requestResponse");
    expect(wuzhongDraw.script).toContain("context.log");
    expect(wuzhongDraw.validTargets).toBe("self");
    expect(wuzhongDraw.params).toEqual({ count: 2 });
  });

  it("wuxie should have correct structure", () => {
    expect(wuxieNullify.id).toBe("wuxie_nullify");
    expect(wuxieNullify.name).toBe("抵消锦囊效果");
    expect(wuxieNullify.type).toBe("counter");
    expect(typeof wuxieNullify.script).toBe("string");
    expect(wuxieNullify.script).toContain("context.log");
    expect(wuxieNullify.validTargets).toBe("indirect");
    expect(wuxieNullify.params).toEqual({ cardCategory: "trick" });
  });

  it("juedou should have correct structure", () => {
    expect(juedouDuel.id).toBe("juedou_duel");
    expect(juedouDuel.name).toBe("决斗伤害");
    expect(juedouDuel.type).toBe("duel");
    expect(typeof juedouDuel.script).toBe("string");
    expect(juedouDuel.script).toContain("context.requestResponse");
    expect(juedouDuel.script).toContain("context.damage");
    expect(juedouDuel.validTargets).toBe("enemy");
  });

  it("nanman should have correct structure", () => {
    expect(nanmanAoe.id).toBe("nanman_aoe");
    expect(nanmanAoe.name).toBe("南蛮入侵效果");
    expect(nanmanAoe.type).toBe("aoe");
    expect(typeof nanmanAoe.script).toBe("string");
    expect(nanmanAoe.script).toContain("context.requestResponse");
    expect(nanmanAoe.script).toContain("context.damage");
    expect(nanmanAoe.validTargets).toBe("allOther");
    expect(nanmanAoe.params).toEqual({ requiredCard: "sha", damage: 1 });
  });

  it("wanjian should have correct structure", () => {
    expect(wanjianAoe.id).toBe("wanjian_aoe");
    expect(wanjianAoe.name).toBe("万箭齐发效果");
    expect(wanjianAoe.type).toBe("aoe");
    expect(typeof wanjianAoe.script).toBe("string");
    expect(wanjianAoe.script).toContain("context.requestResponse");
    expect(wanjianAoe.script).toContain("context.damage");
    expect(wanjianAoe.validTargets).toBe("allOther");
    expect(wanjianAoe.params).toEqual({ requiredCard: "shan", damage: 1 });
  });

  it("taoyuan should have correct structure", () => {
    expect(taoyuanHeal.id).toBe("taoyuan_heal");
    expect(taoyuanHeal.name).toBe("桃园恢复");
    expect(taoyuanHeal.type).toBe("aoeHeal");
    expect(typeof taoyuanHeal.script).toBe("string");
    expect(taoyuanHeal.script).toContain("context.getResource");
    expect(taoyuanHeal.script).toContain("context.setResource");
    expect(taoyuanHeal.validTargets).toBe("all");
    expect(taoyuanHeal.params).toEqual({ amount: 1 });
  });

  it("all effect ids should be unique", () => {
    const allIds = [
      guoheDiscard.id, shunshouSteal.id, wuzhongDraw.id,
      wuxieNullify.id, juedouDuel.id, nanmanAoe.id,
      wanjianAoe.id, taoyuanHeal.id,
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(8);
  });
});