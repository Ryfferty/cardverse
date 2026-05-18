import type { EffectDefinition } from "@cardverse/deck";

export const liuBeiRende: EffectDefinition = {
  id: "rende",
  name: "仁德",
  type: "active",
  description: "出牌阶段限一次，你可以将任意数量的手牌交给其他角色。给出两张或更多手牌时，你回复1点体力",
  trigger: "playPhase",
  validTargets: "allOthers",
  params: {},
  script: `
    const target = context.target;
    context.log(context.player.name + " 对 " + target.name + " 发动仁德");
    
    const giveResult = await context.requestResponse(context.player, {
      type: "give_cards",
      targetId: target,
      source: "rende",
    });

    const cardsGiven = giveResult?.count || 0;
    if (cardsGiven >= 2) {
      await context.setResource(context.player.id, "health", 
        (await context.getResource(context.player.id, "health")) + 1);
      context.log(context.player.name + " 因仁德给出两张以上牌，回复1点体力");
    }
    return { success: true };
  `,
};