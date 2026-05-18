import type { EffectDefinition } from "@cardverse/deck";

export const zhugeJinBoshu: EffectDefinition = {
  id: "boshu",
  name: "博术",
  type: "active",
  description: "摸牌阶段，你可以少摸一张牌，然后从牌堆顶获得一张锦囊牌",
  trigger: "drawPhase",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动博术");
    
    const result = await context.requestResponse(context.player, {
      type: "draw_specific",
      type: "trick",
      cost: 1,
      source: "boshu",
    });

    if (result?.success) {
      context.log(context.player.name + " 获得了一张锦囊牌");
    }
    return { success: true };
  `,
};

export const zhugeJinHeshi: EffectDefinition = {
  id: "heshi",
  name: "和事",
  type: "active",
  description: "出牌阶段限一次，你可以选择一名角色，令其摸两张牌，然后其选择一张手牌交给你",
  trigger: "playPhase",
  validTargets: "other",
  params: {},
  script: `
    const target = context.target;
    context.log(context.player.name + " 对 " + target.name + " 发动和事");

    await context.requestResponse(target, {
      type: "draw_cards",
      count: 2,
      source: "heshi",
    });
    context.log(target.name + " 摸了两张牌");

    const received = await context.requestResponse(target, {
      type: "give_card",
      targetId: context.player,
      count: 1,
      source: "heshi",
    });

    if (received?.success) {
      context.log(context.player.name + " 从 " + target.name + " 处获得一张牌");
    }
    return { success: true };
  `,
};