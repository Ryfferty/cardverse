import type { EffectDefinition } from "@cardverse/deck";

export const juedouDuel: EffectDefinition = {
  id: "juedou_duel",
  name: "决斗伤害",
  type: "duel",
  params: { cardId: "sha", damage: 1 },
  validTargets: "enemy",
  script: `
    const target = context.target;
    const damage = context.params.damage || 1;
    context.log(context.player.name + " 向 " + target.name + " 发起决斗");

    let attacker = context.player;
    let defender = target;
    let round = 0;
    const maxRounds = 10;

    while (round < maxRounds) {
      const response = await context.requestResponse(defender, {
        type: "play_card",
        cardId: context.params.cardId || "sha",
        source: "juedou",
      });
      if (!response) {
        await context.damage(defender, damage);
        context.log(defender.name + " 无法使用杀，受到 " + damage + " 点伤害");
        return { success: true, loser: defender, damage };
      }
      context.log(defender.name + " 使用杀回应决斗");
      [attacker, defender] = [defender, attacker];
      round++;
    }
    context.log("决斗平局结束（超过最大轮次）");
    return { success: true, draw: true };
  `,
};