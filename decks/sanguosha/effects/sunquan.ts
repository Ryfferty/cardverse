import type { EffectDefinition } from "@cardverse/deck";

export const sunQuanZhiheng: EffectDefinition = {
  id: "zhiheng",
  name: "制衡",
  type: "active",
  description: "出牌阶段限一次，你可以弃置任意数量的牌，然后摸等量的牌",
  trigger: "playPhase",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动制衡");
    
    const balanceResult = await context.requestResponse(context.player, {
      type: "balance_cards",
      source: "zhiheng",
    });

    const discarded = balanceResult?.discarded || 0;
    const drawn = balanceResult?.drawn || 0;
    context.log(context.player.name + " 制衡：弃置" + discarded + "张牌，摸" + drawn + "张牌");
    return { success: true };
  `,
};