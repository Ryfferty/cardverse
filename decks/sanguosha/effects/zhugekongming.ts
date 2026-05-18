import type { EffectDefinition } from "@cardverse/deck";

export const zhugeKongmingEmpty: EffectDefinition = {
  id: "kongming",
  name: "空城",
  type: "passive",
  description: "锁定技，当你没有手牌时，你不能被选为杀或决斗的目标",
  trigger: "becomeTarget",
  validTargets: "self",
  params: {},
  script: `
    const targetType = context.event.data.targetType;
    const handCount = context.event.data.handCount || 0;

    if ((targetType === "sha" || targetType === "duel") && handCount === 0) {
      context.log(context.player.name + " 空城，不能被选为目标");
      return { success: false, reason: "kongming_protection" };
    }
    return { success: true };
  `,
};

export const zhugeKongmingZhiyuan: EffectDefinition = {
  id: "zhiyuan",
  name: "志远",
  type: "active",
  description: "摸牌阶段，你可以少摸一张牌，然后观看牌堆顶的三张牌，将其中任意数量的牌置于牌堆顶，其余置于牌堆底",
  trigger: "drawPhase",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 发动志远");
    
    const peekResult = await context.requestResponse(context.player, {
      type: "peek_and_arrange",
      count: 3,
      cost: 1,
      source: "zhiyuan",
    });

    if (peekResult?.success) {
      context.log(context.player.name + " 观看并整理了牌堆顶的3张牌");
    }
    return { success: true };
  `,
};