import type { EffectDefinition } from "@cardverse/deck";

export const zhouYuYingzi: EffectDefinition = {
  id: "fengshen",
  name: "英姿",
  type: "passive",
  description: "摸牌阶段，你可以多摸一张牌",
  trigger: "drawPhase",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 英姿，多摸一张牌");
    await context.requestResponse(context.player, {
      type: "draw_cards",
      count: 1,
      source: "fengshen",
    });
    return { success: true };
  `,
};

export const zhouYuTandu: EffectDefinition = {
  id: "tandu",
  name: "反间",
  type: "active",
  description: "出牌阶段限一次，你可以令一名其他角色选择一种花色，然后你亮出一张手牌。若此牌花色与其选择相同，你对其造成1点伤害；否则该角色获得此牌",
  trigger: "playPhase",
  validTargets: "other",
  params: {},
  script: `
    const target = context.target;
    context.log(context.player.name + " 对 " + target.name + " 发动反间");

    const guess = await context.requestResponse(target, {
      type: "guess_suit",
      source: "tandu",
    });

    const reveal = await context.requestResponse(context.player, {
      type: "reveal_card",
      count: 1,
      source: "tandu",
    });

    if (reveal?.card?.suit === guess?.suit) {
      await context.damage(target, 1);
      context.log(target.name + " 猜错了，受到1点伤害");
      return { success: true, damage: true };
    } else {
      await context.requestResponse(target, {
        type: "gain_card",
        card: reveal?.card,
        source: "tandu",
      });
      context.log(target.name + " 猜对了，获得这张牌");
      return { success: true, damage: false };
    }
  `,
};