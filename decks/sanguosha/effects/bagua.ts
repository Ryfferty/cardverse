import type { EffectDefinition } from "@cardverse/deck";

export const baguaJudge: EffectDefinition = {
  id: "bagua_judge",
  name: "八卦",
  type: "equipmentPassive",
  params: { judgeSuit: "red" },
  validTargets: "self",
  script: `
    context.log(context.player.name + " 使用八卦阵判定代替出闪");
    const judgeResult = await context.requestResponse(context.player, {
      type: "judge",
      source: "bagua",
    });

    if (judgeResult && judgeResult.color === "red") {
      context.log(context.player.name + " 判定结果为红色，视为使用闪");
      return { success: true, dodged: true };
    }
    context.log(context.player.name + " 判定结果为黑色，八卦阵无效");
    return { success: false, dodged: false };
  `,
};