import type { EffectDefinition } from "@cardverse/deck";

export const caoCaoJueji: EffectDefinition = {
  id: "jueji",
  name: "奸雄",
  type: "passive",
  description: "当你受到伤害后，你可以获得造成此伤害的牌",
  trigger: "onDamageReceived",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动奸雄，获得造成伤害的牌");
    const damageCard = context.event.data.card;
    if (damageCard) {
      await context.requestResponse(context.player, {
        type: "gain_card",
        card: damageCard,
        source: "jueji",
      });
      context.log(context.player.name + " 通过奸雄获得了" + damageCard.name);
    }
    return { success: true };
  `,
};