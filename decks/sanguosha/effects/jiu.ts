import type { EffectDefinition } from "@cardverse/deck";

export const jiuEffects: EffectDefinition[] = [
  {
    id: "jiu_rescue",
    name: "濒死回复",
    type: "heal",
    params: { amount: 1, condition: "dying" },
    validTargets: "self",
    script: `
      const health = await context.getResource(context.player, "health");
      if (health > 0) {
        context.log("非濒死状态，无法使用酒的濒死回复效果");
        return { success: false, reason: "not_dying" };
      }
      await context.setResource(context.player, "health", 1);
      context.log(context.player.name + " 使用酒脱离濒死状态，回复至1点体力");
      return { success: true, rescued: true };
    `,
  },
  {
    id: "jiu_buff",
    name: "酒劲",
    type: "buff",
    params: { damageBonus: 1, duration: "turn" },
    validTargets: "self",
    script: `
      const bonus = context.params.damageBonus || 1;
      context.log(context.player.name + " 喝下酒，本回合下一张杀伤害 +" + bonus);
      await context.addModifier(context.player, {
        type: "damage_bonus",
        value: bonus,
        source: "jiu",
        cardType: "sha",
        expires: "turn_end",
      });
      return { success: true, buffApplied: true };
    `,
  },
];