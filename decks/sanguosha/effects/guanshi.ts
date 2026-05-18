import type { EffectDefinition } from "@cardverse/deck";

export const guanshiForce: EffectDefinition = {
  id: "guanshi_force",
  name: "强命",
  type: "equipmentActive",
  params: { range: 3, discardCost: 2 },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 的杀被闪抵消，贯石斧效果触发");
    const paid = await context.requestResponse(context.player, {
      type: "guanshi_force",
      message: "是否弃置两张牌使此杀强制命中？",
      cost: context.params.discardCost || 2,
      source: "guanshi",
    });
    if (paid) {
      context.log(context.player.name + " 弃置两张牌，杀强制命中");
      return { success: true, forced: true };
    }
    context.log(context.player.name + " 选择不使用贯石斧效果");
    return { success: false, reason: "declined" };
  `,
};