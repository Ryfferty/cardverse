import type { EffectDefinition } from "@cardverse/deck";

export const simaYiFanKui: EffectDefinition = {
  id: "fankui",
  name: "反馈",
  type: "passive",
  description: "当你受到伤害后，你可以获得来源的一张牌",
  trigger: "onDamageReceived",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动反馈");
    const damageSource = context.event.data.source;

    if (!damageSource) {
      return { success: false, reason: "no_damage_source" };
    }

    const stolen = await context.requestResponse(context.player, {
      type: "steal_card",
      targetId: damageSource,
      count: 1,
      source: "fankui",
    });

    if (stolen?.success) {
      context.log(context.player.name + " 通过反馈获得一张牌");
      return { success: true };
    }
    return { success: false, reason: "no_card_available" };
  `,
};

export const simaYiGuiCai: EffectDefinition = {
  id: "guicai",
  name: "鬼才",
  type: "active",
  description: "当一名角色的判定牌生效前，你可以打出一张手牌代替之",
  trigger: "beforeJudge",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动鬼才，使用手牌代替判定牌");

    const replaced = await context.requestResponse(context.player, {
      type: "replace_judge_card",
      source: "guicai",
    });

    if (replaced?.success) {
      context.log(context.player.name + " 用鬼才修改了判定结果");
      return { success: true, replaced: true };
    }
    return { success: false, reason: "declined" };
  `,
};