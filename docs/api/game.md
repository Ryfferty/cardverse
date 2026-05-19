# Game 引擎 API

`Game` 是 CardVerse 的核心类，整合了事件系统、状态管理、区域管理、阶段管理和资源管理，
提供完整的游戏生命周期控制。

## 导入

```typescript
import { Game } from "@cardverse/core";
```

## 构造函数

`Game` 的构造函数是私有的，必须通过 `Game.create()` 工厂方法创建实例。

### `Game.create(config: GameConfig): Game`

创建新的游戏实例。

```typescript
interface GameConfig {
  deckId: string;         // 卡组 ID
  playerCount: number;    // 最大玩家数
  maxEffectSteps?: number;    // 最大效果步数（默认 1000）
  responseTimeout?: number;   // 响应超时（秒）
  reconnectTimeout?: number;  // AI 重连超时（秒）
}
```

```typescript
const game = Game.create({
  deckId: "sanguosha",
  playerCount: 4,
});
```

---

## 玩家管理

### `addPlayer(playerId: string, name: string): PlayerState`

在游戏开始前添加玩家。**必须在 `start()` 之前调用。**

- **参数**:
  - `playerId`: 玩家唯一标识
  - `name`: 玩家名称
- **返回**: 创建的 `PlayerState`
- **抛出**: 游戏已开始后调用会抛出错误

```typescript
game.addPlayer("p1", "曹操");
game.addPlayer("p2", "刘备");
game.addPlayer("p3", "孙权");
game.addPlayer("p4", "吕布");
```

---

## 初始化方法

以下方法用于在 `start()` 之前设置游戏规则。

### `initZones(zoneDefs: ZoneDefinition[]): void`

初始化全局区域定义。

```typescript
game.initZones(rules.zones);
```

### `initPlayerZones(playerId: string, zoneDefs: ZoneDefinition[]): void`

为特定玩家初始化区域定义（手牌区、装备区等）。

```typescript
game.initPlayerZones("p1", rules.playerZones);
```

### `initResources(resourceDefs: ResourceDefinition[]): void`

初始化资源定义（体力值、手牌上限等）。

```typescript
game.initResources(rules.resources);
```

### `initPhases(phaseDefs: PhaseDefinition[]): void`

设置回合阶段（准备 → 判定 → 摸牌 → 出牌 → 弃牌 → 结束）。

```typescript
game.initPhases(rules.phases);
```

---

## 游戏生命周期

### `start(): Promise<void>`

开始游戏。发送 `GAME_START` 事件。**至少需要 2 名玩家。**

- **抛出**: 玩家数少于 2 时抛出错误

```typescript
await game.start();
```

### `end(winner: string, winCondition: string): Promise<void>`

结束游戏。发送 `GAME_END` 事件。

- **参数**:
  - `winner`: 获胜者 ID
  - `winCondition`: 胜利条件

```typescript
await game.end("p1", "lord_victory");
```

---

## 回合控制

### `startTurn(playerId: string): Promise<void>`

开始指定玩家的回合。发送 `TURN_START` → `PHASE_START` 事件链。

```typescript
await game.startTurn("p1");
```

### `nextPhase(gameStateOverride?: Record<string, unknown>): Promise<boolean>`

推进到下一阶段。返回 `true` 表示成功进入新阶段，`false` 表示回合结束。

- **参数**:
  - `gameStateOverride`: 可选，用于条件阶段评估的游戏状态

```typescript
const hasNext = await game.nextPhase();
if (!hasNext) {
  // 回合结束
  await game.endTurn();
}
```

### `endTurn(): Promise<void>`

结束当前回合。自动执行资源再生和玩家淘汰判定。

```typescript
await game.endTurn();
```

---

## 游戏操作

### `playCard(playerId: string, cardInstanceId: string, targets?: string[]): Promise<void>`

出牌操作。发送 `CARD_PLAYED` 事件。

```typescript
await game.playCard("p1", "sha_abc123", ["p2"]);
```

### `drawCard(playerId: string, cardId: string): Promise<void>`

摸牌操作。发送 `CARD_DRAWN` 事件。

```typescript
await game.drawCard("p1", "card_xyz");
```

### `respondToEvent(eventId: string, response: EventResponse): Promise<void>`

响应事件。发送 `RESPONSE_GIVEN` 事件。

```typescript
await game.respondToEvent("evt_123", {
  playerId: "p2",
  cardId: "shan_456",
  type: "play_card",
  data: {},
});
```

---

## 状态查询

### `getState(): GameState`

获取完整游戏状态（所有玩家全部信息）。

```typescript
const fullState = game.getState();
```

### `getStateForPlayer(playerId: string): GameState`

获取指定玩家可见的游戏状态（隐藏其他玩家手牌和面朝下区域）。

```typescript
const myView = game.getStateForPlayer("p1");
```

### `getEventLog(): GameEvent[]`

获取完整事件日志。可用于 replay 和调试。

```typescript
const log = game.getEventLog();
```

---

## 事件监听

### `on(eventType: string, handler: EventHandler): void`

注册事件处理器。支持通配符 `"*"`。

```typescript
game.on("card:played", (event) => {
  console.log(`${event.source} 出了 ${event.data.cardId}`);
});

game.on("*", (event) => {
  console.log(`事件: ${event.type}`, event.data);
});
```

### `off(eventType: string, handler: EventHandler): void`

移除事件处理器。

```typescript
game.off("card:played", handler);
```

---

## 可直接访问的子系统

| 属性 | 类型 | 说明 |
|------|------|------|
| `game.eventBus` | `EventBus` | 事件总线 |
| `game.eventStack` | `EventStack` | 事件堆栈（嵌套解析） |
| `game.state` | `StateManager` | 状态管理器 |
| `game.zones` | `ZoneManager` | 区域管理器 |
| `game.phases` | `PhaseManager` | 阶段管理器 |
| `game.resources` | `ResourceManager` | 资源管理器 |

---

## 完整使用示例

```typescript
import { Game } from "@cardverse/core";
import { DeckLoader } from "@cardverse/deck";

const loader = new DeckLoader();
const deck = await loader.loadFromPath("./decks/sanguosha/manifest.json");

const game = Game.create({
  deckId: deck.manifest.id,
  playerCount: 4,
});

// 初始化规则
game.initZones(deck.rules.zones);
game.initPhases(deck.rules.phases);
game.initResources(deck.rules.resources);

// 添加玩家
const players = ["曹操", "刘备", "孙权", "吕布"];
const ids = players.map((name, i) => {
  const id = `p${i + 1}`;
  game.addPlayer(id, name);
  game.initPlayerZones(id, deck.rules.playerZones);
  return id;
});

// 开始游戏
await game.start();

// 第一回合
await game.startTurn(ids[0]);

// 进入出牌阶段
while (true) {
  const hasNext = await game.nextPhase();
  if (!hasNext) break;
  // ... 在此阶段执行操作
}

// 出牌
await game.playCard(ids[0], "sha_instance_1", [ids[1]]);

// 结束回合
await game.endTurn();
```