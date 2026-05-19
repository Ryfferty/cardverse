# 卡组开发指南

本指南介绍如何为 CardVerse 创建自定义卡组，涵盖 manifest 规范、卡牌定义、效果脚本编写和 UI 模板配置。

## 目录

| 文档 | 内容 |
|------|------|
| [Manifest 规范](#manifest-规范) | 卡组清单文件格式 |
| [游戏规则定义](#游戏规则定义) | 区域、阶段、资源、胜负条件配置 |
| [卡牌定义](#卡牌定义) | 卡牌 JSON 结构和属性说明 |
| [效果脚本指南](#效果脚本指南) | EffectDefinition 编写与 Context API |
| [武将定义](#武将定义) | 武将数据结构与技能配置 |

## 快速开始

一个最简卡组需要以下文件结构：

```
decks/my-deck/
├── manifest.json          # 卡组清单
├── rules.json             # 游戏规则
├── cards/
│   ├── basic.json         # 基本牌
│   └── trick.json         # 锦囊牌（可选）
├── characters/
│   └── characters.json    # 武将数据
└── effects/
    └── *.ts               # 效果脚本
```

## 目录约定

| 文件/目录 | 必需 | 说明 |
|-----------|------|------|
| `manifest.json` | ✅ | 卡组元信息和文件引用 |
| `rules.json` | ✅ | 区域、阶段、资源、胜负条件 |
| `cards/` | ✅ | 卡牌数据 JSON 文件 |
| `characters/` | ❌ | 武将数据（无武将游戏可省略） |
| `effects/` | ✅ | 效果脚本 TypeScript 文件 |

---

## Manifest 规范

`manifest.json` 是卡组的入口文件，声明元信息和文件引用。

```json
{
  "manifest": {
    "id": "my-deck-id",
    "name": "我的卡组",
    "version": "1.0.0",
    "author": "作者名",
    "description": "卡组简介",
    "minPlayers": 2,
    "maxPlayers": 4,
    "frameworkVersion": "1.0.0",
    "tags": ["strategy", "card-game"]
  },
  "cardPacks": [
    { "type": "basic", "source": "cards/basic.json" }
  ],
  "characterPack": {
    "source": "characters/characters.json"
  },
  "rules": {
    "source": "rules.json"
  },
  "winConditions": [
    { "type": "last-standing", "description": "最终存活者获胜" }
  ],
  "drawConditions": [
    { "type": "all-dead", "description": "所有角色死亡时平局" }
  ],
  "effects": {
    "scripts": [
      "effects/damage.ts",
      "effects/heal.ts"
    ]
  }
}
```

### Manifest 属性

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `manifest.id` | string | ✅ | 卡组唯一标识（小写字母+连字符） |
| `manifest.name` | string | ✅ | 卡组显示名称 |
| `manifest.version` | string | ✅ | 语义化版本号 |
| `manifest.author` | string | ❌ | 作者姓名 |
| `manifest.description` | string | ❌ | 卡组简介 |
| `manifest.minPlayers` | number | ✅ | 最少玩家数（≥2） |
| `manifest.maxPlayers` | number | ✅ | 最多玩家数 |
| `manifest.frameworkVersion` | string | ❌ | 框架版本要求 |
| `manifest.tags` | string[] | ❌ | 分类标签 |
| `cardPacks` | array | ✅ | 卡牌包引用列表 |
| `characterPack` | object | ❌ | 武将引用 |
| `rules` | object | ✅ | 规则文件引用 |
| `winConditions` | array | ✅ | 胜利条件列表 |
| `drawConditions` | array | ❌ | 平局条件列表 |
| `effects.scripts` | string[] | ✅ | 效果脚本文件列表 |

---

## 游戏规则定义

`rules.json` 定义游戏的区域、阶段、资源和运行参数。

### 区域（zones）

```json
{
  "zones": [
    { "id": "deck",      "name": "牌堆",   "visibility": "none",   "ordered": true,  "faceDown": true,  "owner": "global" },
    { "id": "discard",   "name": "弃牌堆", "visibility": "all",    "ordered": false, "faceDown": false, "owner": "global" },
    { "id": "hand",      "name": "手牌",   "visibility": "owner",  "ordered": true,  "faceDown": false, "owner": "player" },
    { "id": "equipment", "name": "装备区", "visibility": "all",    "ordered": false, "faceDown": false, "owner": "player" }
  ]
}
```

| 属性 | 值 | 说明 |
|------|-----|------|
| `id` | string | 区域唯一标识 |
| `name` | string | 显示名称 |
| `visibility` | `"owner"` / `"all"` / `"none"` | 可见性 |
| `ordered` | boolean | 是否有序（洗牌禁用） |
| `maxSize` | number | 容量上限（可选） |
| `faceDown` | boolean | 卡牌是否面朝下 |
| `owner` | `"player"` / `"global"` | 归属类型 |

### 阶段（phases）

```json
{
  "phases": [
    { "id": "prepare", "name": "准备阶段", "auto": true },
    { "id": "judge",   "name": "判定阶段", "auto": true },
    { "id": "draw",    "name": "摸牌阶段", "auto": true },
    { "id": "play",    "name": "出牌阶段", "auto": false },
    { "id": "discard", "name": "弃牌阶段", "auto": true },
    { "id": "end",     "name": "结束阶段", "auto": true }
  ]
}
```

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 阶段唯一标识 |
| `name` | string | ✅ | 显示名称 |
| `auto` | boolean | ✅ | 是否自动推进（false 需要玩家操作） |
| `condition` | string | ❌ | 动态阶段条件（属性路径） |

### 资源（resources）

```json
{
  "resources": [
    { "id": "health",    "name": "体力",     "defaultValue": 4, "min": 0, "max": 10 },
    { "id": "maxHealth", "name": "体力上限", "defaultValue": 4, "min": 1, "max": 10 }
  ]
}
```

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | string | 资源唯一标识 |
| `name` | string | 显示名称 |
| `defaultValue` | number | 默认值 |
| `min` | number | 最小值（可选） |
| `max` | number | 最大值（可选） |
| `regenPerTurn` | number | 每回合恢复量（可选） |

---

## 卡牌定义

卡牌数据存储在 `cards/` 目录下的 JSON 文件中，每个文件包含一个卡牌包。

### 卡牌属性

```json
{
  "cards": [
    {
      "id": "attack_card",
      "name": "攻击牌",
      "category": "basic",
      "count": 10,
      "description": "对目标造成 1 点伤害",
      "tags": ["attack", "single-target"],
      "effects": [
        {
          "id": "attack_damage",
          "name": "造成伤害",
          "type": "damage",
          "params": { "amount": 1 },
          "validTargets": "inRange",
          "script": "effects/attack.ts"
        }
      ]
    }
  ]
}
```

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 卡牌定义唯一标识 |
| `name` | string | ✅ | 显示名称 |
| `category` | string | ✅ | 类别：`basic` / `trick` / `equipment` |
| `count` | number | ✅ | 卡组中该卡牌的数量 |
| `description` | string | ❌ | 卡牌效果描述 |
| `tags` | string[] | ❌ | 标签（如 attack / defense / heal） |
| `effects` | array | ✅ | 效果引用列表 |

### Effect 引用

每个 card 的 effects 数组中，每项引用一个效果脚本：

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | string | 效果唯一标识（与脚本导出的 id 一致） |
| `name` | string | 效果名称 |
| `type` | string | 效果类型（damage / heal / draw / discard / modifier / counter / chain / judge / convert / equip） |
| `params` | object | 效果参数（传递给脚本的 `context.params`） |
| `validTargets` | string | 有效目标：`inRange` / `all` / `allOthers` / `self` / `enemies` |
| `script` | string | 效果脚本文件路径 |

---

## 效果脚本指南

效果脚本是 TypeScript 模块，导出 `EffectDefinition` 对象。

### 基本结构

```typescript
import type { EffectDefinition } from "@cardverse/deck";

export const myEffect: EffectDefinition = {
  id: "my_effect_id",
  name: "我的效果",
  type: "damage",
  params: { amount: 2 },
  validTargets: "inRange",
  script: `
    const target = context.target;
    const amount = context.params.amount || 1;
    await context.damage(target, amount);
    context.log(\`对 \${target} 造成 \${amount} 点伤害\`);
    return { success: true };
  `,
};
```

### EffectDefinition 接口

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | string | 效果唯一标识（必须与 JSON 中的引用一致） |
| `name` | string | 效果名称 |
| `type` | string | 效果类型 |
| `params` | object | 默认参数 |
| `validTargets` | string | 有效的目标类型 |
| `script` | string | 效果执行脚本（字符串形式） |

### Context API

效果脚本在 `context` 对象上运行，提供以下 API：

| 方法/属性 | 类型 | 说明 |
|-----------|------|------|
| `context.target` | PlayerId | 效果目标 |
| `context.params` | Record<string, unknown> | 效果参数（来自卡牌 JSON） |
| `context.player` | { id, name } | 当前回合玩家 |
| `context.event` | GameEvent | 触发效果的事件 |
| `context.requestResponse(target, data)` | Promise<boolean \| null> | 请求目标响应（如出闪抵消杀） |
| `context.damage(target, amount)` | Promise<void> | 对目标造成伤害 |
| `context.getResource(playerId, resourceId)` | Promise<number> | 获取玩家资源值 |
| `context.setResource(playerId, resourceId, value)` | Promise<void> | 设置玩家资源值 |
| `context.addModifier(playerId, modifier)` | Promise<void> | 添加修正 |
| `context.log(message)` | void | 记录日志 |

### 完整示例：杀的伤害效果

```typescript
import type { EffectDefinition } from "@cardverse/deck";

export const shaDamage: EffectDefinition = {
  id: "sha_damage",
  name: "造成伤害",
  type: "damage",
  params: { amount: 1 },
  validTargets: "inRange",
  script: `
    const target = context.target;
    const amount = context.params.amount || 1;
    const isDodged = await context.requestResponse(target, {
      type: "play_card",
      cardId: "shan"
    });
    if (isDodged) {
      context.log("杀被闪抵消");
      return { success: false, dodged: true };
    }
    await context.damage(target, amount);
    context.log(target + " 受到 " + amount + " 点伤害");
    return { success: true, damage: amount };
  `,
};
```

### 装备效果示例：八卦阵

```typescript
export const baguaEffect: EffectDefinition = {
  id: "bagua_form",
  name: "八卦阵",
  type: "modifier",
  params: {},
  validTargets: "self",
  script: `
    const owner = context.player.id;
    const needDodge = await context.requestResponse(owner, {
      type: "dodge_required"
    });
    if (needDodge) {
      const judgeResult = Math.random() > 0.5;
      if (judgeResult) {
        context.log("八卦阵判定成功，视为打出一张闪");
        return { success: true, dodged: true, judged: true };
      }
      context.log("八卦阵判定失败");
      return { success: false, judged: false };
    }
    return { success: true, notApplicable: true };
  `,
};
```

### 效果脚本注意事项

1. **脚本必须以字符串形式写在 `script` 字段中** — 脚本由核心引擎在运行时动态执行
2. **使用 `async/await`** — 大部分 Context API 是异步的
3. **返回结果对象** — 脚本必须返回一个包含执行结果的对象
4. **记录关键操作** — 使用 `context.log()` 记录重要步骤，便于调试和回放
5. **异常处理** — 脚本内的异常会被核心引擎捕获并记录，不会导致游戏崩溃

---

## 武将定义

武将定义在 `characters/characters.json` 中，每个武将包含身份、体力和技能。

```json
{
  "characters": [
    {
      "id": "hero_sword",
      "name": "剑客",
      "faction": "wu",
      "hp": 4,
      "maxHp": 4,
      "description": "天下第一剑客",
      "skills": [
        {
          "id": "sword_mastery",
          "name": "剑术精通",
          "description": "当你造成伤害时，伤害 +1",
          "type": "passive",
          "trigger": "onDamageDealt",
          "validTargets": "self",
          "script": "effects/sword_mastery.ts"
        }
      ],
      "tags": ["damage", "attack"]
    }
  ]
}
```

### 武将属性

| 属性 | 类型 | 必需 | 说明 |
|------|------|------|------|
| `id` | string | ✅ | 武将唯一标识 |
| `name` | string | ✅ | 显示名称 |
| `faction` | string | ❌ | 势力标识 |
| `hp` | number | ✅ | 初始体力值 |
| `maxHp` | number | ✅ | 体力上限 |
| `description` | string | ❌ | 武将简介 |
| `skills` | array | ❌ | 技能列表 |
| `tags` | string[] | ❌ | 标签 |

### 技能属性

| 属性 | 类型 | 说明 |
|------|------|------|
| `id` | string | 技能唯一标识 |
| `name` | string | 技能名称 |
| `description` | string | 技能描述 |
| `type` | string | 类型：active / passive / trigger / limited |
| `trigger` | string | 触发条件 |
| `validTargets` | string | 有效目标 |
| `script` | string | 技能脚本文件路径 |

---

## 验证卡组

使用 DeckValidator 验证卡组合法性：

```typescript
import { DeckLoader, DeckValidator } from "@cardverse/deck";

const loader = new DeckLoader();
const deck = loader.loadFromPath("./decks/my-deck/manifest.json");
const result = DeckValidator.validate(deck);

if (result.errors.length > 0) {
  console.error("验证失败:", result.errors);
} else {
  console.log("验证通过，卡组可用 ✅");
}
```

验证器会检查：
- manifest 必填字段完整性
- 卡牌 ID 唯一性和格式
- 效果脚本引用有效性
- 交叉引用完整性
- 区域/阶段/资源配置合法性

---

## 参考

- 完整示例卡组：`decks/sanguosha/`
- 三国杀卡组包含 58 张基本牌 + 28 张锦囊牌 + 21 张装备牌 + 10 名武将 + 36 个效果脚本