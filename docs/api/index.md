# CardVerse 核心 API 文档

## 模块索引

| 模块 | 说明 | 文档 |
|------|------|------|
| Game 引擎 | 游戏生命周期、玩家管理、回合控制、出牌/摸牌 | [game.md](./game.md) |
| 事件系统 | EventBus 发布/订阅、EventStack 嵌套解析、响应请求 | [events.md](./events.md) |
| 状态管理 | 事件驱动状态变更、隐藏信息过滤、状态回放 | [state.md](./state.md) |
| 区域管理 | 全局/玩家区域操作、卡牌移动、可见性过滤 | [zones.md](./zones.md) |
| 阶段管理 | 回合阶段流转、动态条件阶段、阶段跳转 | [phases.md](./phases.md) |
| 资源管理 | 资源定义与操作、事件驱动变更、回合再生 | [resources.md](./resources.md) |

## 包导入

```typescript
// 核心引擎（整合所有子系统）
import { Game } from "@cardverse/core";

// 子系统（也可单独导入）
import {
  EventBus,
  EventStack,
  StateManager,
  ZoneManager,
  PhaseManager,
  ResourceManager,
} from "@cardverse/core";
```

## 架构概览

```
Game 引擎
├── EventBus (事件总线)
│   └── EventStack (事件堆栈)
├── StateManager (状态管理)
├── ZoneManager (区域管理)
├── PhaseManager (阶段管理)
└── ResourceManager (资源管理)
```

每个子系统可通过 `Game` 实例直接访问：

```typescript
const game = Game.create({ deckId: "...", playerCount: 4 });

game.eventBus   // EventBus — 注册/触发事件
game.eventStack // EventStack — 嵌套事件解析
game.state      // StateManager — 查询/回放状态
game.zones      // ZoneManager — 操作卡牌区域
game.phases     // PhaseManager — 控制回合阶段
game.resources  // ResourceManager — 管理玩家资源
```

## 事件驱动架构

CardVerse 核心引擎采用事件驱动架构：

1. **操作** → `Game` 的公开方法（`playCard`, `drawCard`, `startTurn` 等）
2. **事件** → 方法内部调用 `emitAndApply`，创建事件 → 更新状态 → 触发 EventBus
3. **状态** → `StateManager` 通过 reducer 响应事件更新游戏状态
4. **事件日志** → 所有事件按顺序记录，支持完整回放

```typescript
// 出牌流程
await game.playCard("p1", "sha_1", ["p2"]);
// 1. EventStack.push({ type: "card:played", source: "p1", data: { cardId: "sha_1", ... } })
// 2. StateManager.applyEvent() — 从手牌区移除 "sha_1"
// 3. EventBus.emit() — 通知所有注册的处理器
// 4. 处理器可以触发额外的响应链（嵌套事件）
```