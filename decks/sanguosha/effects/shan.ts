import type { EffectDefinition } from "@cardverse/deck";

export const shanDodge: EffectDefinition = {
  id: "shan_dodge",
  name: "闪避",
  type: "counter",
  params: { sourceType: "damage" },
  validTargets: "self",
  script: `
    const source = context.event.data.source;
    const sourceCard = context.event.data.cardId;
    if (sourceCard !== "sha") {
      context.log("闪只能抵消杀");
      return { success: false, reason: "invalid_target" };
    }
    context.log(context.player.name + " 使用闪躲避了 " + source + " 的杀");
    return { success: true, dodged: true };
  `,
};