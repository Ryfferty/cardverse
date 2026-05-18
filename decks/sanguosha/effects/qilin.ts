import type { EffectDefinition } from "@cardverse/deck";

export const qilinDismount: EffectDefinition = {
  id: "qilin_dismount",
  name: "破马",
  type: "equipmentActive",
  params: { range: 5 },
  validTargets: "inRangeEnemy",
  script: `
    const target = context.target;
    context.log(context.player.name + " 使用麒麟弓对 " + target.name + " 造成伤害，触发破马效果");

    const mountDiscarded = await context.requestResponse(context.player, {
      type: "destroy_mount",
      targetId: target,
      source: "qilin",
    });

    if (mountDiscarded) {
      context.log(target.name + " 的坐骑被麒麟弓摧毁");
      return { success: true, dismounted: true };
    }
    context.log(target.name + " 没有坐骑可被摧毁");
    return { success: false, reason: "no_mount" };
  `,
};