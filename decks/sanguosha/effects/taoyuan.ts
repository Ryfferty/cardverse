import type { EffectDefinition } from "@cardverse/deck";

export const taoyuanHeal: EffectDefinition = {
  id: "taoyuan_heal",
  name: "桃园恢复",
  type: "aoeHeal",
  params: { amount: 1 },
  validTargets: "all",
  script: `
    const amount = context.params.amount || 1;
    context.log(context.player.name + " 使用了桃园结义！所有角色恢复 " + amount + " 点体力");

    const targets = context.event.data.allPlayers || [];
    let healedCount = 0;

    for (const targetId of targets) {
      const currentHealth = await context.getResource(targetId, "health");
      const maxHealth = await context.getResource(targetId, "maxHealth");

      if (currentHealth < maxHealth) {
        const newHealth = Math.min(currentHealth + amount, maxHealth);
        await context.setResource(targetId, "health", newHealth);
        context.log(targetId + " 恢复了 " + (newHealth - currentHealth) + " 点体力（当前：" + newHealth + "）");
        healedCount++;
      } else {
        context.log(targetId + " 体力已满，无法恢复");
      }
    }

    return { success: true, healed: healedCount };
  `,
};