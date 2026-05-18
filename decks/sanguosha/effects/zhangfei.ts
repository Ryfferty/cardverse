import type { EffectDefinition } from "@cardverse/deck";

export const zhangFeiBaqi: EffectDefinition = {
  id: "baqi",
  name: "咆哮",
  type: "passive",
  description: "锁定技，你使用杀无次数限制",
  trigger: "playSha",
  validTargets: "self",
  params: {},
  script: `
    context.log(context.player.name + " 咆哮！使用杀无次数限制");
    await context.addModifier(context.player, {
      type: "unlimited_sha",
      value: 1,
      source: "baqi",
      expires: "turn_end",
    });
    return { success: true };
  `,
};