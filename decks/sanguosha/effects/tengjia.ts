import type { EffectDefinition } from "@cardverse/deck";

export const tengjiaAoeImmune: EffectDefinition = {
  id: "tengjia_aoe_immune",
  name: "藤甲防护",
  type: "equipmentPassive",
  params: { immuneTo: ["nanman", "wanjian", "normal_sha"], fireWeakness: true },
  validTargets: "self",
  script: `
    const sourceCard = context.event.data.cardId;
    const damageType = context.event.data.damageType;
    const immuneTo = context.params.immuneTo || [];

    if (damageType === "fire") {
      context.log(context.player.name + " 的藤甲受到火焰伤害，伤害+1！");
      return { success: true, fireWeak: true, damageBonus: 1 };
    }

    if (sourceCard === "sha" && damageType !== "fire") {
      context.log(context.player.name + " 的藤甲免疫普通杀");
      return { success: false, immune: true };
    }

    if (sourceCard === "nanman" || sourceCard === "wanjian") {
      context.log(context.player.name + " 的藤甲免疫" + (sourceCard === "nanman" ? "南蛮入侵" : "万箭齐发"));
      return { success: false, immune: true };
    }

    return { success: true, immune: false };
  `,
};