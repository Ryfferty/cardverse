import type { EffectDefinition } from "@cardverse/deck";

export const zhaoYunLongDan: EffectDefinition = {
  id: "longdan",
  name: "龙胆",
  type: "passive",
  description: "你可以将杀当闪使用或打出，也可以将闪当杀使用或打出",
  trigger: "playShaOrShan",
  validTargets: "self",
  params: {},
  script: `
    const actionType = context.event.data.actionType;
    context.log(context.player.name + " 发动龙胆");

    if (actionType === "playSha") {
      const convertResult = await context.requestResponse(context.player, {
        type: "convert_shan_to_sha",
        source: "longdan",
      });
      if (convertResult?.success) {
        context.log(context.player.name + " 将闪当作杀使用");
        return { success: true, converted: true };
      }
    } else if (actionType === "playShan") {
      const convertResult = await context.requestResponse(context.player, {
        type: "convert_sha_to_shan",
        source: "longdan",
      });
      if (convertResult?.success) {
        context.log(context.player.name + " 将杀当作闪使用");
        return { success: true, converted: true };
      }
    }
    return { success: true, converted: false };
  `,
};