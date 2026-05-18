import type { EffectDefinition } from "@cardverse/deck";

export const taoHeal: EffectDefinition = {
  id: "tao_heal",
  name: "回复体力",
  type: "heal",
  params: { amount: 1 },
  validTargets: "wounded",
  script: `
    const target = context.target;
    const amount = context.params.amount || 1;
    const currentHealth = await context.getResource(target, "health");
    const maxHealth = await context.getResource(target, "maxHealth");
    if (currentHealth >= maxHealth) {
      context.log(target.name + " 体力已满，无法使用桃");
      return { success: false, reason: "full_health" };
    }
    const newHealth = Math.min(currentHealth + amount, maxHealth);
    await context.setResource(target, "health", newHealth);
    context.log(target.name + " 回复了 " + amount + " 点体力（当前：" + newHealth + "）");
    return { success: true, heal: amount };
  `,
};