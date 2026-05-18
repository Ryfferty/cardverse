import type { EffectDefinition } from "@cardverse/deck";

export const baiyinCap: EffectDefinition = {
  id: "baiyin_cap",
  name: "白银甲",
  type: "equipmentPassive",
  params: { maxDamage: 1 },
  validTargets: "self",
  script: `
    const damageAmount = context.event.data.amount || 0;
    const maxDamage = context.params.maxDamage || 1;

    if (damageAmount > maxDamage) {
      const excess = damageAmount - maxDamage;
      context.log(context.player.name + " 的白银狮子防止了 " + excess + " 点多余伤害");
      return { success: true, capped: true, prevented: excess, actualDamage: maxDamage };
    }
    return { success: true, capped: false };
  `,
};