import { describe, it, expect } from "vitest";
import { DeckLoader } from "@cardverse/deck";
import type { EffectDefinition } from "@cardverse/deck";
import { zhugeliannuFire } from "./effects/zhugeliannu.js";
import { qinggangPierce } from "./effects/qinggang.js";
import { cixiongTrigger } from "./effects/cixiong.js";
import { zhangbaConvert } from "./effects/zhangba.js";
import { guanshiForce } from "./effects/guanshi.js";
import { fangtianMulti } from "./effects/fangtian.js";
import { qinglongPursue } from "./effects/qinglong.js";
import { qilinDismount } from "./effects/qilin.js";
import { baguaJudge } from "./effects/bagua.js";
import { renwangImmune } from "./effects/renwang.js";
import { baiyinCap } from "./effects/baiyin.js";
import { tengjiaAoeImmune } from "./effects/tengjia.js";
import { plus1horseRange } from "./effects/plus1horse.js";
import { minus1horseRange } from "./effects/minus1horse.js";

describe("Sanguosha Equipment Deck", () => {
  const equipmentJson = {
    manifest: {
      id: "sanguosha-equipment",
      name: "三国杀 — 装备牌",
      version: "1.0.0",
      author: "CardVerse",
      description: "三国杀标准版装备牌定义",
      minPlayers: 2,
      maxPlayers: 8,
      frameworkVersion: "1.0.0",
      tags: ["sanguosha", "equipment", "standard"],
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
        id: "zhugeliannu", name: "诸葛连弩", category: "equipment", subCategory: "weapon",
        description: "攻击范围1；锁定技，你使用杀无次数限制", count: 2,
        tags: ["weapon", "range-1", "unlimited-sha"],
        equipment: { slot: "weapon", range: 1 },
        effects: [{ id: "zhugeliannu_fire", name: "连射", type: "equipmentPassive", params: { range: 1 }, validTargets: "self", script: "effects/zhugeliannu.js" }],
      },
      {
        id: "qinggang", name: "青釭剑", category: "equipment", subCategory: "weapon",
        description: "攻击范围2；锁定技，你使用杀无视目标防具", count: 1,
        tags: ["weapon", "range-2", "armor-pierce"],
        equipment: { slot: "weapon", range: 2 },
        effects: [{ id: "qinggang_pierce", name: "穿甲", type: "equipmentPassive", params: { range: 2, ignoreArmor: true }, validTargets: "self", script: "effects/qinggang.js" }],
      },
      {
        id: "cixiong", name: "雌雄双股剑", category: "equipment", subCategory: "weapon",
        description: "你使用杀指定一名异性角色为目标后，可以令其选择弃一张手牌或令你摸一张牌", count: 1,
        tags: ["weapon", "range-2", "gender-check"],
        equipment: { slot: "weapon", range: 2 },
        effects: [{ id: "cixiong_trigger", name: "双股", type: "equipmentActive", params: { range: 2 }, validTargets: "inRangeEnemy", script: "effects/cixiong.js" }],
      },
      {
        id: "zhangba", name: "丈八蛇矛", category: "equipment", subCategory: "weapon",
        description: "攻击范围3；你可以将两张手牌当杀使用或打出", count: 1,
        tags: ["weapon", "range-3", "card-conversion"],
        equipment: { slot: "weapon", range: 3 },
        effects: [{ id: "zhangba_convert", name: "转化", type: "equipmentActive", params: { range: 3, convertCount: 2 }, validTargets: "self", script: "effects/zhangba.js" }],
      },
      {
        id: "guanshi", name: "贯石斧", category: "equipment", subCategory: "weapon",
        description: "攻击范围3；你使用杀被闪抵消后，可以弃置两张牌令此杀强制命中", count: 1,
        tags: ["weapon", "range-3", "force-hit"],
        equipment: { slot: "weapon", range: 3 },
        effects: [{ id: "guanshi_force", name: "强命", type: "equipmentActive", params: { range: 3, discardCost: 2 }, validTargets: "self", script: "effects/guanshi.js" }],
      },
      {
        id: "fangtian", name: "方天画戟", category: "equipment", subCategory: "weapon",
        description: "攻击范围4；你使用的杀若为最后一张手牌，则此杀可以额外指定两个目标", count: 1,
        tags: ["weapon", "range-4", "multi-target"],
        equipment: { slot: "weapon", range: 4 },
        effects: [{ id: "fangtian_multi", name: "横扫", type: "equipmentActive", params: { range: 4, extraTargets: 2 }, validTargets: "self", script: "effects/fangtian.js" }],
      },
      {
        id: "qinglong", name: "青龙偃月刀", category: "equipment", subCategory: "weapon",
        description: "攻击范围3；你使用的杀被闪抵消后，可以继续使用杀直到命中", count: 1,
        tags: ["weapon", "range-3", "pursuit"],
        equipment: { slot: "weapon", range: 3 },
        effects: [{ id: "qinglong_pursue", name: "追杀", type: "equipmentActive", params: { range: 3 }, validTargets: "self", script: "effects/qinglong.js" }],
      },
      {
        id: "qilin", name: "麒麟弓", category: "equipment", subCategory: "weapon",
        description: "攻击范围5；你使用杀对目标角色造成伤害后，可以弃置其装备区里的一张坐骑牌", count: 1,
        tags: ["weapon", "range-5", "destroy-mount"],
        equipment: { slot: "weapon", range: 5 },
        effects: [{ id: "qilin_dismount", name: "破马", type: "equipmentActive", params: { range: 5 }, validTargets: "inRangeEnemy", script: "effects/qilin.js" }],
      },
      {
        id: "bagua", name: "八卦阵", category: "equipment", subCategory: "armor",
        description: "当你需要使用或打出闪时，你可以进行判定：若结果为红色，视为你使用或打出了一张闪", count: 2,
        tags: ["armor", "judge", "dodge"],
        equipment: { slot: "armor" },
        effects: [{ id: "bagua_judge", name: "八卦", type: "equipmentPassive", params: { judgeSuit: "red" }, validTargets: "self", script: "effects/bagua.js" }],
      },
      {
        id: "renwang", name: "仁王盾", category: "equipment", subCategory: "armor",
        description: "锁定技，黑色杀对你无效", count: 1,
        tags: ["armor", "immune-black-sha"],
        equipment: { slot: "armor" },
        effects: [{ id: "renwang_immune", name: "仁王", type: "equipmentPassive", params: { immuneTo: "black_sha" }, validTargets: "self", script: "effects/renwang.js" }],
      },
      {
        id: "baiyin", name: "白银狮子", category: "equipment", subCategory: "armor",
        description: "锁定技，当你受到伤害时，若此伤害大于1点，则防止多余的伤害", count: 1,
        tags: ["armor", "damage-cap", "heal"],
        equipment: { slot: "armor" },
        effects: [{ id: "baiyin_cap", name: "白银甲", type: "equipmentPassive", params: { maxDamage: 1 }, validTargets: "self", script: "effects/baiyin.js" }],
      },
      {
        id: "tengjia", name: "藤甲", category: "equipment", subCategory: "armor",
        description: "锁定技，南蛮入侵、万箭齐发和普通杀对你无效；当你受到火焰伤害时，伤害+1", count: 2,
        tags: ["armor", "immune-aoe", "fire-weakness"],
        equipment: { slot: "armor" },
        effects: [{ id: "tengjia_aoe_immune", name: "藤甲防护", type: "equipmentPassive", params: { immuneTo: ["nanman", "wanjian", "normal_sha"], fireWeakness: true }, validTargets: "self", script: "effects/tengjia.js" }],
      },
      {
        id: "plus1horse", name: "+1 坐骑", category: "equipment", subCategory: "mountPlus",
        description: "其他角色计算与你的距离时+1", count: 3,
        tags: ["mount", "defense", "range+1"],
        equipment: { slot: "mountDefense" },
        effects: [{ id: "plus1horse_range", name: "加一马", type: "equipmentPassive", params: { rangeModifier: 1, direction: "incoming" }, validTargets: "self", script: "effects/plus1horse.js" }],
      },
      {
        id: "minus1horse", name: "-1 坐骑", category: "equipment", subCategory: "mountMinus",
        description: "你计算与其他角色的距离时-1", count: 3,
        tags: ["mount", "offense", "range-1"],
        equipment: { slot: "mountOffense" },
        effects: [{ id: "minus1horse_range", name: "减一马", type: "equipmentPassive", params: { rangeModifier: -1, direction: "outgoing" }, validTargets: "self", script: "effects/minus1horse.js" }],
      },
    ],
    winConditions: [{ type: "last-standing" }],
    drawConditions: [{ type: "all-dead" }],
  };

  it("should load the equipment deck successfully", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.manifest.id).toBe("sanguosha-equipment");
    expect(deck.manifest.name).toBe("三国杀 — 装备牌");
  });

  it("should have 14 card definitions", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.cards.size).toBe(14);
  });

  it("should have correct card categories (all equipment)", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    for (const [, card] of deck.cards) {
      expect(card.category).toBe("equipment");
    }
  });

  it("should instantiate 20 total cards", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.instances).toBeDefined();
    expect(deck.instances!.length).toBe(21); // 2+8*1+2*2+1+1+3+3 = 21
  });

  it("should instantiate correct count for each equipment card", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    const expectedCounts: Record<string, number> = {
      zhugeliannu: 2,
      qinggang: 1,
      cixiong: 1,
      zhangba: 1,
      guanshi: 1,
      fangtian: 1,
      qinglong: 1,
      qilin: 1,
      bagua: 2,
      renwang: 1,
      baiyin: 1,
      tengjia: 2,
      plus1horse: 3,
      minus1horse: 3,
    };

    for (const [id, expected] of Object.entries(expectedCounts)) {
      const count = deck.instances!.filter((i) => i.definitionId === id).length;
      expect(count).toBe(expected);
    }
  });

  it("should have 14 effect definitions", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.effects.size).toBe(14);
  });

  it("weapons should have correct equipment range values", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.effects.get("zhugeliannu_fire")?.params).toEqual({ range: 1 });
    expect(deck.effects.get("qinggang_pierce")?.params).toEqual({ range: 2, ignoreArmor: true });
    expect(deck.effects.get("fangtian_multi")?.params).toEqual({ range: 4, extraTargets: 2 });
    expect(deck.effects.get("qilin_dismount")?.params).toEqual({ range: 5 });
  });

  it("armors should have correct params", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.effects.get("bagua_judge")?.params).toEqual({ judgeSuit: "red" });
    expect(deck.effects.get("renwang_immune")?.params).toEqual({ immuneTo: "black_sha" });
    expect(deck.effects.get("baiyin_cap")?.params).toEqual({ maxDamage: 1 });
    expect(deck.effects.get("tengjia_aoe_immune")?.params).toEqual({
      immuneTo: ["nanman", "wanjian", "normal_sha"],
      fireWeakness: true,
    });
  });

  it("mounts should have correct range modifiers", () => {
    const loader = new DeckLoader();
    const deck = loader.loadFromJson(equipmentJson);

    expect(deck.effects.get("plus1horse_range")?.params).toEqual({
      rangeModifier: 1,
      direction: "incoming",
    });
    expect(deck.effects.get("minus1horse_range")?.params).toEqual({
      rangeModifier: -1,
      direction: "outgoing",
    });
  });
});

describe("Equipment effect scripts — Weapons", () => {
  it("zhugeliannu should have correct structure", () => {
    expect(zhugeliannuFire.id).toBe("zhugeliannu_fire");
    expect(zhugeliannuFire.type).toBe("equipmentPassive");
    expect(typeof zhugeliannuFire.script).toBe("string");
    expect(zhugeliannuFire.script).toContain("context.addModifier");
    expect(zhugeliannuFire.params).toEqual({ range: 1 });
  });

  it("qinggang should have correct structure", () => {
    expect(qinggangPierce.id).toBe("qinggang_pierce");
    expect(qinggangPierce.type).toBe("equipmentPassive");
    expect(typeof qinggangPierce.script).toBe("string");
    expect(qinggangPierce.script).toContain("ignore_armor");
    expect(qinggangPierce.params).toEqual({ range: 2, ignoreArmor: true });
  });

  it("cixiong should have correct structure", () => {
    expect(cixiongTrigger.id).toBe("cixiong_trigger");
    expect(cixiongTrigger.type).toBe("equipmentActive");
    expect(typeof cixiongTrigger.script).toBe("string");
    expect(cixiongTrigger.script).toContain("context.requestResponse");
    expect(cixiongTrigger.validTargets).toBe("inRangeEnemy");
  });

  it("zhangba should have correct structure", () => {
    expect(zhangbaConvert.id).toBe("zhangba_convert");
    expect(zhangbaConvert.type).toBe("equipmentActive");
    expect(typeof zhangbaConvert.script).toBe("string");
    expect(zhangbaConvert.script).toContain("context.requestResponse");
    expect(zhangbaConvert.params).toEqual({ range: 3, convertCount: 2 });
  });

  it("guanshi should have correct structure", () => {
    expect(guanshiForce.id).toBe("guanshi_force");
    expect(guanshiForce.type).toBe("equipmentActive");
    expect(typeof guanshiForce.script).toBe("string");
    expect(guanshiForce.script).toContain("context.requestResponse");
    expect(guanshiForce.params).toEqual({ range: 3, discardCost: 2 });
  });

  it("fangtian should have correct structure", () => {
    expect(fangtianMulti.id).toBe("fangtian_multi");
    expect(fangtianMulti.type).toBe("equipmentActive");
    expect(typeof fangtianMulti.script).toBe("string");
    expect(fangtianMulti.script).toContain("context.requestResponse");
    expect(fangtianMulti.params).toEqual({ range: 4, extraTargets: 2 });
  });

  it("qinglong should have correct structure", () => {
    expect(qinglongPursue.id).toBe("qinglong_pursue");
    expect(qinglongPursue.type).toBe("equipmentActive");
    expect(typeof qinglongPursue.script).toBe("string");
    expect(qinglongPursue.script).toContain("context.requestResponse");
    expect(qinglongPursue.params).toEqual({ range: 3 });
  });

  it("qilin should have correct structure", () => {
    expect(qilinDismount.id).toBe("qilin_dismount");
    expect(qilinDismount.type).toBe("equipmentActive");
    expect(typeof qilinDismount.script).toBe("string");
    expect(qilinDismount.script).toContain("context.requestResponse");
    expect(qilinDismount.params).toEqual({ range: 5 });
  });
});

describe("Equipment effect scripts — Armors", () => {
  it("bagua should have correct structure", () => {
    expect(baguaJudge.id).toBe("bagua_judge");
    expect(baguaJudge.type).toBe("equipmentPassive");
    expect(typeof baguaJudge.script).toBe("string");
    expect(baguaJudge.script).toContain("context.requestResponse");
    expect(baguaJudge.script).toContain("context.log");
    expect(baguaJudge.params).toEqual({ judgeSuit: "red" });
  });

  it("renwang should have correct structure", () => {
    expect(renwangImmune.id).toBe("renwang_immune");
    expect(renwangImmune.type).toBe("equipmentPassive");
    expect(typeof renwangImmune.script).toBe("string");
    expect(renwangImmune.script).toContain("context.log");
    expect(renwangImmune.params).toEqual({ immuneTo: "black_sha" });
  });

  it("baiyin should have correct structure", () => {
    expect(baiyinCap.id).toBe("baiyin_cap");
    expect(baiyinCap.type).toBe("equipmentPassive");
    expect(typeof baiyinCap.script).toBe("string");
    expect(baiyinCap.script).toContain("context.log");
    expect(baiyinCap.params).toEqual({ maxDamage: 1 });
  });

  it("tengjia should have correct structure", () => {
    expect(tengjiaAoeImmune.id).toBe("tengjia_aoe_immune");
    expect(tengjiaAoeImmune.type).toBe("equipmentPassive");
    expect(typeof tengjiaAoeImmune.script).toBe("string");
    expect(tengjiaAoeImmune.script).toContain("context.log");
    expect(tengjiaAoeImmune.params).toEqual({
      immuneTo: ["nanman", "wanjian", "normal_sha"],
      fireWeakness: true,
    });
  });
});

describe("Equipment effect scripts — Mounts", () => {
  it("plus1horse should have correct structure", () => {
    expect(plus1horseRange.id).toBe("plus1horse_range");
    expect(plus1horseRange.type).toBe("equipmentPassive");
    expect(typeof plus1horseRange.script).toBe("string");
    expect(plus1horseRange.script).toContain("context.addModifier");
    expect(plus1horseRange.params).toEqual({ rangeModifier: 1, direction: "incoming" });
  });

  it("minus1horse should have correct structure", () => {
    expect(minus1horseRange.id).toBe("minus1horse_range");
    expect(minus1horseRange.type).toBe("equipmentPassive");
    expect(typeof minus1horseRange.script).toBe("string");
    expect(minus1horseRange.script).toContain("context.addModifier");
    expect(minus1horseRange.params).toEqual({ rangeModifier: -1, direction: "outgoing" });
  });
});

describe("Equipment effect IDs uniqueness", () => {
  it("all weapon effect ids should be unique", () => {
    const weaponIds = [
      zhugeliannuFire.id, qinggangPierce.id, cixiongTrigger.id,
      zhangbaConvert.id, guanshiForce.id, fangtianMulti.id,
      qinglongPursue.id, qilinDismount.id,
    ];
    const uniqueIds = new Set(weaponIds);
    expect(uniqueIds.size).toBe(8);
  });

  it("all armor effect ids should be unique", () => {
    const armorIds = [baguaJudge.id, renwangImmune.id, baiyinCap.id, tengjiaAoeImmune.id];
    const uniqueIds = new Set(armorIds);
    expect(uniqueIds.size).toBe(4);
  });

  it("all mount effect ids should be unique", () => {
    const mountIds = [plus1horseRange.id, minus1horseRange.id];
    const uniqueIds = new Set(mountIds);
    expect(uniqueIds.size).toBe(2);
  });

  it("all 14 effect ids should be globally unique", () => {
    const allIds = [
      zhugeliannuFire.id, qinggangPierce.id, cixiongTrigger.id,
      zhangbaConvert.id, guanshiForce.id, fangtianMulti.id,
      qinglongPursue.id, qilinDismount.id,
      baguaJudge.id, renwangImmune.id, baiyinCap.id, tengjiaAoeImmune.id,
      plus1horseRange.id, minus1horseRange.id,
    ];
    const uniqueIds = new Set(allIds);
    expect(uniqueIds.size).toBe(14);
  });
});