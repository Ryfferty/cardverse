import type { EffectDefinition } from "@cardverse/deck";

export const renwangImmune: EffectDefinition = {
  id: "renwang_immune",
  name: "仁王",
  type: "equipmentPassive",
  params: { immuneTo: "black_sha" },
  validTargets: "self",
  script: `
    const sourceCard = context.event.data.cardId;
    const cardColor = context.event.data.cardColor;
    if (sourceCard === "sha" && cardColor === "black") {
      context.log(context.player.name + " 的仁王盾使黑色杀无效");
      return { success: false, immune: true };
    }
    context.log("仁王盾：非黑色杀，不触发免疫");
    return { success: true, immune: false };
  `,
};