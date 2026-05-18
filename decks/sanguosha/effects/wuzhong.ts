import type { EffectDefinition } from "@cardverse/deck";

export const wuzhongDraw: EffectDefinition = {
  id: "wuzhong_draw",
  name: "摸两张牌",
  type: "draw",
  params: { count: 2 },
  validTargets: "self",
  script: `
    const count = context.params.count || 2;
    context.log(context.player.name + " 使用无中生有，摸 " + count + " 张牌");
    await context.requestResponse(context.player, {
      type: "draw_cards",
      count,
      source: "wuzhong",
    });
    return { success: true, drawn: count };
  `,
};