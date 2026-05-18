import type { EffectDefinition } from "@cardverse/deck";

export const guoheDiscard: EffectDefinition = {
  id: "guohe_discard",
  name: "弃置目标牌",
  type: "dismantle",
  params: { count: 1 },
  validTargets: "enemyWithCards",
  script: `
    const target = context.target;
    const discarded = await context.requestResponse(context.player, {
      type: "select_discard",
      targetId: target,
      count: context.params.count || 1,
      source: "guohe",
    });
    if (discarded) {
      context.log(target.name + " 被过河拆桥弃置了牌");
      return { success: true, discarded };
    }
    context.log(target.name + " 没有牌可弃置");
    return { success: false, reason: "no_cards" };
  `,
};