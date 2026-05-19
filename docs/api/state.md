# 状态管理 API

`StateManager` 通过事件日志驱动状态变更，支持状态回放和隐藏信息过滤。

## 导入

```typescript
import { StateManager } from "@cardverse/core";
```

---

## 构造函数

```typescript
const manager = new StateManager(initialState);
```

- **参数**: `initialState: GameState` — 初始游戏状态

---

## 状态查询

### `getCurrentState(): GameState`

获取当前完整游戏状态的深拷贝。

```typescript
const state = manager.getCurrentState();
console.log(`回合: ${state.turnNumber}, 玩家数: ${state.players.size}`);
```

### `getStateForPlayer(playerId: string): GameState`

获取指定玩家可见的游戏状态。自动过滤：
- 其他玩家的手牌内容（仅保留 `handCount`）
- 全局面朝下区域的卡牌

```typescript
const myView = manager.getStateForPlayer("p1");
// 其他玩家的 hand zone cards 被清空，但 handCount 保留
```

### `getEventLog(): GameEvent[]`

获取完整事件日志。

```typescript
for (const event of manager.getEventLog()) {
  console.log(`[${event.timestamp}] ${event.type}`);
}
```

---

## 初始化方法（setup 阶段）

以下方法仅在 `status === "waiting"` 时使用，用于游戏初始化。

### `addPlayer(player: PlayerState): void`

添加玩家到游戏状态。

```typescript
manager.addPlayer({
  id: "p1",
  name: "曹操",
  status: "alive",
  zones: new Map(),
  resources: new Map(),
  handCount: 0,
});
```

### `setPlayerZone(playerId: string, zoneId: string, zone: ZoneState): void`

为玩家设置区域。

```typescript
manager.setPlayerZone("p1", "hand", {
  definition: { /* ZoneDefinition */ },
  cards: [],
  playerId: "p1",
});
```

### `setGlobalZone(zoneId: string, zone: ZoneState): void`

设置全局区域。

```typescript
manager.setGlobalZone("deck", {
  definition: { /* ZoneDefinition */ },
  cards: ["card_1", "card_2", "..."],
});
```

### `updatePlayerHandCount(playerId: string): void`

根据玩家手牌区的实际卡牌数更新 `handCount`。

```typescript
manager.updatePlayerHandCount("p1");
```

---

## 事件驱动状态变更

### `applyEvent(event: GameEvent): GameState`

将事件应用到状态中。内部调用 reducer，返回新的 `GameState`。

**支持的事件类型**:

| 事件类型 | 状态变更 |
|---------|---------|
| `game:start` | `status → "running"` |
| `game:end` | `status → "finished"`, 设置 winner |
| `turn:start` | 设置 `currentTurn` |
| `phase:start` | 更新 `currentTurn.phaseIndex` |
| `phase:end` | 仅记录日志，不修改状态 |
| `turn:end` | `turnNumber++`, 清除 `currentTurn` |
| `card:played` | 从手牌区移除卡牌 |
| `card:drawn` | 从牌堆移到手牌区，更新 `handCount` |
| `card:discarded` | 从手牌移到弃牌堆，更新 `handCount` |
| `card:moved` | 卡牌跨区域移动（源→目标） |
| `damage:dealt` | 伤害分配（不直接改状态，由下游处理） |
| `damage:taken` | 伤害结算（不直接改状态，由下游处理） |
| `heal:received` | 治疗结算（不直接改状态，由下游处理） |
| `resource:changed` | 更新指定资源 `current` 值 |
| `player:eliminated` | 玩家 `status → "dead"` |
| `response:requested` | 响应请求（事件驱动，不修改状态） |
| `response:given` | 响应提交（事件驱动，不修改状态） |
| `response:timeout` | 响应超时（事件驱动，不修改状态） |

```typescript
const newState = manager.applyEvent({
  id: "evt_1",
  type: "card:played",
  source: "p1",
  data: { cardId: "sha_1", playerId: "p1", targets: ["p2"] },
  timestamp: Date.now(),
  stackDepth: 0,
});
```

---

## 状态回放

### `StateManager.replay(initialState: GameState, events: GameEvent[]): GameState`

从初始状态开始，按顺序重放所有事件，返回最终状态。

```typescript
const initialState: GameState = { /* ... */ };
const events = savedEventLog;
const finalState = StateManager.replay(initialState, events);
```

---

## GameState 类型

```typescript
interface GameState {
  gameId: string;
  status: "waiting" | "setup" | "running" | "paused" | "finished";
  players: Map<PlayerId, PlayerState>;
  globalZones: Map<ZoneId, ZoneState>;
  turnNumber: number;
  currentTurn?: {
    playerId: PlayerId;
    phaseIndex: number;
    phaseId: string;
    turnNumber: number;
  };
  winner?: string;
  winCondition?: string;
  eventLog: GameEvent[];
}

interface PlayerState {
  id: PlayerId;
  name: string;
  status: "alive" | "dead" | "disconnected";
  zones: Map<ZoneId, ZoneState>;
  resources: Map<ResourceId, ResourceState>;
  handCount: number;
}
```