import type { EffectDefinition } from "@cardverse/deck";

export const huaTuoQingNang: EffectDefinition = {
  id: "qingnang",
  name: "青囊",
  type: "active",
  description: "出牌阶段限一次，你可以弃置一张手牌，然后令一名角色回复1点体力",
  trigger: "playPhase",
  validTargets: "other",
  params: {},
  script: `
    const target = context.target;
    context.log(context.player.name + " 对 " + target.name + " 发动青囊");

    const discarded = await context.requestResponse(context.player, {
      type: "discard_cards",
      count: 1,
      source: "qingnang",
    });

    if (!discarded) {
      return { success: false, reason: "no_discard" };
    }

    const currentHealth = await context.getResource(target, "health");
    await context.setResource(target, "health", currentHealth + 1);
    context.log(target.name + " 因青囊回复了1点体力");
    return { success: true };
  `,
};

export const huaTuoJiJiu: EffectDefinition = {
  id: "jijiu",
  name: "急救",
  type: "passive",
  description: "锁定技，你的桃可以当做闪使用或打出",
  trigger: "playShan",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动急救，将桃当作闪使用");
    const converted = await context.requestResponse(context.player, {
      type: "convert_peach_to_shan",
      source: "jijiu",
    });

    if (converted?.success) {
      context.log(context.player.name + " 使用急救将桃转化为闪");
      return { success: true, converted: true };
    }
    return { success: true, converted: false };
  `,
};