import type { EffectDefinition } from "@cardverse/deck";

export const guanYuWuSheng: EffectDefinition = {
  id: "wusheng",
  name: "武圣",
  type: "passive",
  description: "你可以将红色牌当杀使用或打出",
  trigger: "playSha",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动武圣");
    
    const convertResult = await context.requestResponse(context.player, {
      type: "convert_red_to_sha",
      source: "wusheng",
    });

    if (convertResult?.success) {
      context.log(context.player.name + " 将红色牌当作杀使用");
      return { success: true, converted: true };
    }
    return { success: true, converted: false };
  `,
};