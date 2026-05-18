import type { EffectDefinition } from "@cardverse/deck";

export const qinggangPierce: EffectDefinition = {
  id: "qinggang_pierce",
  name: "穿甲",
  type: "equipmentPassive",
  params: { range: 2, ignoreArmor: true },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 装备了青釭剑（攻击范围2，无视目标防具）");
    await context.addModifier(context.player, {
      type: "ignore_armor",
      value: 1,
      source: "qinggang",
      expires: "unequip",
    });
    return { success: true };
  `,
};