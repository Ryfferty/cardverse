import type { EffectDefinition } from "@cardverse/shared";

export const shaDamage: EffectDefinition = {
  id: "sha_damage",
  name: "造成伤害",
  type: "damage",
  params: { amount: 1 },
  validTargets: "inRange",
  script: `
    const target = context.target;
    const amount = context.params.amount || 1;
    const isDodged = await context.requestResponse(target, { type: "play_card", cardId: "shan" });
    if (isDodged) {
      context.log("杀被闪抵消");
      return { success: false, dodged: true };
    }
    await context.damage(target, amount);
    context.log(target.name + " 受到 " + amount + " 点伤害");
    return { success: true, damage: amount };
  `,
};