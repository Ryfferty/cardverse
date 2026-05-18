import type { EffectDefinition } from "@cardverse/deck";

export const nanmanAoe: EffectDefinition = {
  id: "nanman_aoe",
  name: "南蛮入侵效果",
  type: "aoe",
  params: { requiredCard: "sha", damage: 1 },
  validTargets: "allOther",
  script: `
    const requiredCard = context.params.requiredCard || "sha";
    const damage = context.params.damage || 1;
    context.log(context.player.name + " 使用了南蛮入侵！所有其他角色必须使用" + requiredCard);

    const targets = context.event.data.allPlayers || [];
    let results = [];

    for (const targetId of targets) {
      if (targetId === context.player.id) continue;

      const responded = await context.requestResponse(targetId, {
        type: "play_card",
        cardId: requiredCard,
        source: "nanman",
      });

      if (responded) {
        context.log(targetId + " 使用" + requiredCard + "抵消了南蛮入侵");
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