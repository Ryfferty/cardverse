import type { EffectDefinition } from "@cardverse/deck";

export const fangtianMulti: EffectDefinition = {
  id: "fangtian_multi",
  name: "横扫",
  type: "equipmentActive",
  params: { range: 4, extraTargets: 2 },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 使用方天画戟，杀可以额外指定两个目标");
    const extraTargets = await context.requestResponse(context.player, {
      type: "select_targets",
      maxCount: context.params.extraTargets || 2,
      cardId: "sha",
      source: "fangtian",
    });
    if (extraTargets) {
      context.log(context.player.name + " 额外指定了 " + extraTargets.length + " 个目标");
      return { success: true, extraTargets };
    }
    return { success: false, reason: "no_extra_targets" };
  `,
};