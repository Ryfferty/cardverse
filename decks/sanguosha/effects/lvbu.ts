import type { EffectDefinition } from "@cardverse/deck";

export const lvBuWuShuang: EffectDefinition = {
  id: "wushuang",
  name: "无双",
  type: "passive",
  description: "锁定技，当你使用杀指定一名角色为目标后，目标需要连续使用两张闪才能抵消",
  trigger: "playSha",
  validTargets: "enemy",
  params: {},
  script: `
    context.log(context.player.name + " 的无双：需要两张闪才能抵消此杀");
    await context.addModifier(context.target, {
      type: "double_shan_required",
      value: 1,
      source: "wushuang",
      expires: "effect_end",
    });
    return { success: true };
  `,
};