import type { EffectDefinition } from "@cardverse/deck";

export const diaoChanLiJian: EffectDefinition = {
  id: "lijian",
  name: "离间",
  type: "active",
  description: "出牌阶段限一次，你可以弃置一张牌，然后令两名男性角色决斗",
  trigger: "playPhase",
  validTargets: "twoOthers",
  params: {},
  script: `
    context.log(context.player.name + " 发动离间");

    const target1 = context.event.data.targets?.[0];
    const target2 = context.event.data.targets?.[1];

    if (!target1 || !target2) {
      return { success: false, reason: "not_enough_targets" };
    }

    const discarded = await context.requestResponse(context.player, {
      type: "discard_cards",
      count: 1,
      source: "lijian",
    });

    if (!discarded) {
      return { success: false, reason: "no_discard" };
    }

    context.log(context.player.name + " 令 " + target1.name + " 与 " + target2.name + " 决斗");
    return { success: true, duelBetween: [target1, target2] };
  `,
};

export const diaoChanBiYue: EffectDefinition = {
  id: "biyue",
  name: "闭月",
  type: "passive",
  description: "结束阶段，你可以摸一张牌",
  trigger: "endPhase",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 闭月，摸一张牌");
    await context.requestResponse(context.player, {
      type: "draw_cards",
      count: 1,
      source: "biyue",
    });
    return { success: true };
  `,
};