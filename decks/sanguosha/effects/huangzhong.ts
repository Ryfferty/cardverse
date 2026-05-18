import type { EffectDefinition } from "@cardverse/deck";

export const huangZhongLiaoyuan: EffectDefinition = {
  id: "liaoyuan",
  name: "燎原",
  type: "passive",
  description: "锁定技，你使用的杀目标数+1",
  trigger: "playSha",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 燎原，杀可指定额外目标");
    await context.addModifier(context.player, {
      type: "extra_target",
      value: 1,
      source: "liaoyuan",
      expires: "turn_end",
    });
    return { success: true };
  `,
};

export const huangZhongBaibu: EffectDefinition = {
  id: "baibu",
  name: "百步",
  type: "active",
  description: "当你使用杀指定一名角色为目标后，你可以进行判定：若结果为红色，此杀伤害+1",
  trigger: "playSha",
  validTargets: "enemy",
  params: {},
  script: `
    const target = context.target;
    context.log(context.player.name + " 对 " + target.name + " 发动百步");

    const judgeResult = await context.requestResponse(context.player, {
      type: "judge",
      source: "baibu",
    });

    if (judgeResult?.color === "red") {
      context.log("判定结果为红色，伤害+1");
      return { success: true, damageBonus: 1 };
    }
    context.log("判定结果为黑色，没有额外伤害");
    return { success: true, damageBonus: 0 };
  `,
};