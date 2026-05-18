import type { EffectDefinition } from "@cardverse/deck";

export const minus1horseRange: EffectDefinition = {
  id: "minus1horse_range",
  name: "减一马",
  type: "equipmentPassive",
  params: { rangeModifier: -1, direction: "outgoing" },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 装备了-1马，计算与其他角色距离-1");
    await context.addModifier(context.player, {
      type: "range_mod",
      value: context.params.rangeModifier || -1,
      source: "minus1horse",
      expires: "unequip",
    });
    return { success: true };
  `,
};