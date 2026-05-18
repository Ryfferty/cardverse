import type { EffectDefinition } from "@cardverse/deck";

export const zhugeliannuFire: EffectDefinition = {
  id: "zhugeliannu_fire",
  name: "连射",
  type: "equipmentPassive",
  params: { range: 1 },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 装备了诸葛连弩（攻击范围1，无出杀次数限制）");
    await context.addModifier(context.player, {
      type: "unlimited_sha",
      value: 1,
      source: "zhugeliannu",
      expires: "unequip",
    });
    return { success: true };
  `,
};