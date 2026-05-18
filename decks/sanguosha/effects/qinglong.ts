import type { EffectDefinition } from "@cardverse/deck";

export const qinglongPursue: EffectDefinition = {
  id: "qinglong_pursue",
  name: "追杀",
  type: "equipmentActive",
  params: { range: 3 },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 的杀被闪抵消，青龙偃月刀效果触发");
    const anotherSha = await context.requestResponse(context.player, {
      type: "play_card",
      cardId: "sha",
      source: "qinglong",
      message: "青龙偃月刀：是否再使用一张杀？",
    });
    if (anotherSha) {
      context.log(context.player.name + " 使用青龙偃月刀追加杀");
      return { success: true, pursued: true };
    }
    context.log(context.player.name + " 选择不使用青龙偃月刀继续追杀");
    return { success: false, reason: "no_sha" };
  `,
};