import type { EffectDefinition } from "@cardverse/deck";

export const wuxieNullify: EffectDefinition = {
  id: "wuxie_nullify",
  name: "抵消锦囊效果",
  type: "counter",
  params: { cardCategory: "trick" },
  validTargets: "indirect",
  script: `
    const sourceCard = context.event.data.cardId;
    const sourceCategory = context.event.data.cardCategory || context.params.cardCategory;
    if (sourceCategory !== "trick") {
      context.log("无懈可击只能抵消锦囊牌效果");
      return { success: false, reason: "invalid_target" };
    }
    context.log(context.player.name + " 使用无懈可击抵消了锦囊效果");
    return { success: true, nullified: true };
  `,
};