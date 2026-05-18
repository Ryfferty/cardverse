import type { EffectDefinition } from "@cardverse/deck";

export const cixiongTrigger: EffectDefinition = {
  id: "cixiong_trigger",
  name: "双股",
  type: "equipmentActive",
  params: { range: 2 },
  validTargets: "inRangeEnemy",
  script: `
    const target = context.target;
    context.log(context.player.name + " 使用雌雄双股剑对 " + target.name + " 发动效果");

    const discarded = await context.requestResponse(target, {
      type: "cixiong_choice",
      source: "cixiong",
      message: "请选择：弃一张手牌，或让对手摸一张牌",
    });

    if (discarded === false) {
      await context.requestResponse(context.player, {
        type: "draw_cards",
        count: 1,
        source: "cixiong",
      });
      context.log(context.player.name + " 因雌雄双股剑效果摸了一张牌");
    } else {
      context.log(target.name + " 弃置了一张手牌");
    }
    return { success: true };
  `,
};