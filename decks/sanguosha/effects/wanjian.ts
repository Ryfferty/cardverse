import type { EffectDefinition } from "@cardverse/deck";

export const wanjianAoe: EffectDefinition = {
  id: "wanjian_aoe",
  name: "万箭齐发效果",
  type: "aoe",
  params: { requiredCard: "shan", damage: 1 },
  validTargets: "allOther",
  script: `
    const requiredCard = context.params.requiredCard || "shan";
    const damage = context.params.damage || 1;
    context.log(context.player.name + " 使用了万箭齐发！所有其他角色必须使用" + requiredCard);

    const targets = context.event.data.allPlayers || [];
    let results = [];

    for (const targetId of targets) {
      if (targetId === context.player.id) continue;

      const responded = await context.requestResponse(targetId, {
        type: "play_card",
        cardId: requiredCard,
        source: "wanjian",
      });

      if (responded) {
        context.log(targetId + " 使用" + requiredCard + "抵消了万箭齐发");
        results.push({ target: targetId, damaged: false });
      } else {
        await context.damage(targetId, damage);
        context.log(targetId + " 没有使用" + requiredCard + "，受到 " + damage + " 点伤害");
        results.push({ target: targetId, damaged: true });
      }
    }

    return { success: true, results };
  `,
};