import type { EffectDefinition } from "@cardverse/deck";

export const zhangbaConvert: EffectDefinition = {
  id: "zhangba_convert",
  name: "转化",
  type: "equipmentActive",
  params: { range: 3, convertCount: 2 },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 装备了丈八蛇矛（攻击范围3，可将两张手牌当杀使用）");
    const converted = await context.requestResponse(context.player, {
      type: "convert_to_sha",
      count: context.params.convertCount || 2,
      source: "zhangba",
    });
    if (converted) {
      context.log(context.player.name + " 使用丈八蛇矛将两张牌转化为杀");
      return { success: true, converted: true };
    }
    return { success: false, reason: "not_enough_cards" };
  `,
};