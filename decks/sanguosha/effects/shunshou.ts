import type { EffectDefinition } from "@cardverse/deck";

export const shunshouSteal: EffectDefinition = {
  id: "shunshou_steal",
  name: "获得目标牌",
  type: "steal",
  params: { count: 1 },
  validTargets: "enemyWithCards",
  script: `
    const target = context.target;
    const stolen = await context.requestResponse(context.player, {
      type: "select_steal",
      targetId: target,
      count: context.params.count || 1,
      source: "shunshou",
    });
    if (stolen) {
      context.log(context.player.name + " 使用顺手牵羊从 " + target.name + " 处获得了牌");
      return { success: true, stolen };
    }
    context.log(target.name + " 没有牌可被牵羊");
    return { success: false, reason: "no_cards" };
  `,
};