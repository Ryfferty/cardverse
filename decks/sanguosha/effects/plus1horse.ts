import type { EffectDefinition } from "@cardverse/deck";

export const plus1horseRange: EffectDefinition = {
  id: "plus1horse_range",
  name: "加一马",
  type: "equipmentPassive",
  params: { rangeModifier: 1, direction: "incoming" },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 装备了+1马，其他角色计算与其距离+1");
    await context.addModifier(context.player, {
      type: "range_mod",
      value: context.params.rangeModifier || 1,
      source: "plus1horse",
      expires: "unequip",
    });
    return { success: true };
  `,
};