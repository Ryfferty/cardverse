# 回合/阶段管理 API

`PhaseManager` 管理回合内的阶段流转，支持线性阶段和条件动态阶段。

## 导入

```typescript
import { PhaseManager } from "@cardverse/core";
```

---

## 构造函数

```typescript
const phaseManager = new PhaseManager();
```

---

## 阶段配置

### `setPhases(phases: PhaseDefinition[]): void`

设置回合阶段列表，将当前索引重置为 0。

```typescript
phaseManager.setPhases([
  { id: "prepare", name: "准备阶段" },
  { id: "judge", name: "判定阶段" },
  { id: "draw", name: "摸牌阶段" },
  { id: "play", name: "出牌阶段" },
  { id: "discard", name: "弃牌阶段" },
  { id: "end", name: "结束阶段" },
]);
```

---

## 回合控制

### `startTurn(playerId: string, turnNumber: number): void`

开始新回合。

```typescript
phaseManager.startTurn("p1", 1);
```

### `nextPhase(gameState?: Record<string, unknown>): PhaseDefinition | undefined`

推进到下一阶段。返回下一阶段定义，回合结束返回 `undefined`。

- **`gameState`**: 用于评估动态阶段的条件

```typescript
const next = phaseManager.nextPhase();
if (!next) {
  console.log("回合结束");
}
```

### `skipPhase(gameState?: Record<string, unknown>): boolean`

跳过当前阶段。返回 `true` 表示成功跳过，`false` 表示已到末尾。

```typescript
if (phaseManager.getCurrentPhase()?.id === "judge") {
  phaseManager.skipPhase(); // 没有判定牌时跳过
}
```

### `isTurnComplete(): boolean`

回合是否已完成。

```typescript
if (phaseManager.isTurnComplete()) {
  // 进入 endTurn 流程
}
```

---

## 阶段查询

### `getCurrentPhase(): PhaseDefinition | undefined`

获取当前阶段定义。

```typescript
const phase = phaseManager.getCurrentPhase();
console.log(`当前阶段: ${phase?.name}`);
```

### `getCurrentPhaseIndex(): number`

获取当前阶段索引。

```typescript
const idx = phaseManager.getCurrentPhaseIndex();
```

### `getTurnInfo(): TurnInfo | undefined`

获取当前回合信息。如果回合还未开始返回 `undefined`。

```typescript
interface TurnInfo {
  playerId: PlayerId;
  phaseIndex: number;
  phaseId: string;
  turnNumber: number;
}
```

### `getPhaseById(id: string): PhaseDefinition | undefined`

按 ID 查找阶段。

```typescript
const drawPhase = phaseManager.getPhaseById("draw");
```

### `hasPhase(id: string): boolean`

检查指定 ID 的阶段是否存在。

```typescript
if (phaseManager.hasPhase("discard_extra")) {
  // 处理额外弃牌阶段
}
```

---

## 批量查询

### `getPhaseCount(): number`

获取阶段总数。

### `getAllPhases(): PhaseDefinition[]`

获取所有阶段定义的副本。

### `getRemainingPhases(gameState?: Record<string, unknown>): PhaseDefinition[]`

获取当前回合剩余的所有阶段（含条件过滤）。

```typescript
const upcoming = phaseManager.getRemainingPhases();
for (const phase of upcoming) {
  console.log(`下一阶段: ${phase.name}`);
}
```

### `hasActivePhase(): boolean`

当前是否有活跃阶段。

```typescript
if (phaseManager.hasActivePhase()) {
  // 执行阶段逻辑
}
```

---

## 跳转和重置

### `goToPhase(index: number): PhaseDefinition | undefined`

跳转到指定索引的阶段。返回阶段定义或 `undefined`（越界）。

```typescript
phaseManager.goToPhase(3); // 直接跳到出牌阶段
```

### `reset(): void`

重置到初始状态（清空所有阶段、回合、玩家数据）。

```typescript
phaseManager.reset();
```

---

## 动态阶段（条件阶段）

支持在阶段定义中使用 `condition` 字段：

```typescript
phaseManager.setPhases([
  { id: "prepare", name: "准备阶段" },
  { id: "discard_extra", name: "额外弃牌", condition: "state.hasPenalty" },
  { id: "draw", name: "摸牌阶段" },
  { id: "draw_extra", name: "额外摸牌", condition: "state.hasExtraDraw" },
  { id: "play", name: "出牌阶段" },
]);

// 条件评估时传入游戏状态
phaseManager.nextPhase({
  state: {
    hasPenalty: false,    // 跳过额外弃牌
    hasExtraDraw: true,   // 进入额外摸牌
  }
});
```

条件使用安全的属性路径解析（而非 `eval`），例如 `"state.hasPenalty"` 会解析为 `gameState.state.hasPenalty`。

---

## PhaseDefinition 类型

```typescript
interface PhaseDefinition {
  id: string;           // 唯一标识（如 "draw", "play"）
  name: string;         // 显示名称
  auto: boolean;        // 是否自动推进
  condition?: string;   // 动态条件（属性路径）
  subPhases?: PhaseDefinition[]; // 子阶段（预留）
}
```