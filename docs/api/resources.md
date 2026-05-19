# 资源管理 API

`ResourceManager` 管理玩家资源（体力值、手牌上限、怒气值等），资源变更自动触发事件。

## 导入

```typescript
import { ResourceManager } from "@cardverse/core";
```

---

## 构造函数

`ResourceManager` 需要 `EventBus` 实例来发送资源变更事件。

```typescript
import { EventBus } from "@cardverse/core";

const eventBus = new EventBus();
const resourceManager = new ResourceManager(eventBus);
```

---

## 定义注册

### `registerDefinition(def: ResourceDefinition): void`

注册资源定义。必须在 `initResource` 之前调用。

```typescript
resourceManager.registerDefinition({
  id: "health",
  name: "体力值",
  defaultValue: 4,
  min: 0,
  max: 4,
  regenPerTurn: 0,
});

resourceManager.registerDefinition({
  id: "hand_limit",
  name: "手牌上限",
  defaultValue: 4,
  min: 0,
  max: 20,
  regenPerTurn: 0,
});
```

---

## 资源初始化

### `initResource(playerId: string, resourceId: string): void`

为指定玩家初始化资源（设置为定义中的默认值）。
如果定义不存在，输出 `console.warn` 并跳过。

```typescript
resourceManager.initResource("p1", "health");
resourceManager.initResource("p1", "hand_limit");
```

---

## 资源操作

### `modify(playerId: string, resourceId: string, delta: number, source?: string): Promise<number>`

修改资源值（增加/减少）。触发 `RESOURCE_CHANGED` 事件。

- **参数**:
  - `delta`: 变化量（正数为增加，负数为减少）
  - `source`: 修改来源标识
- **返回**: 新值
- **抛出**: 资源未初始化时抛出错误

```typescript
// 扣血
const newHp = await resourceManager.modify("p1", "health", -1, "damage");

// 治疗
await resourceManager.modify("p1", "health", 1, "heal");
```

### `set(playerId: string, resourceId: string, value: number, source?: string): Promise<number>`

设置资源为绝对值（内部通过 `modify` 实现）。

```typescript
// 设置为满血
await resourceManager.set("p1", "health", 4, "reset");
```

### `resetToDefault(playerId: string, resourceId: string): Promise<number | undefined>`

将资源重置为定义中的默认值。触发 `RESOURCE_CHANGED` 事件。

```typescript
await resourceManager.resetToDefault("p1", "health");
```

### `applyRegen(playerIds: string[]): Promise<void>`

对所有指定玩家执行每回合资源再生。检查所有定义中 `regenPerTurn > 0` 的资源。

```typescript
await resourceManager.applyRegen(["p1", "p2", "p3", "p4"]);
```

---

## 资源查询

### `getValue(playerId: string, resourceId: string): number | undefined`

获取资源当前值。

```typescript
const hp = resourceManager.getValue("p1", "health");
if (hp !== undefined && hp <= 0) {
  console.log("玩家已死亡");
}
```

### `getResource(playerId: string, resourceId: string): ResourceState | undefined`

获取完整资源状态（含 min/max）。

```typescript
const health = resourceManager.getResource("p1", "health");
console.log(`HP: ${health?.current}/${health?.max}`);
```

### `isInitialized(playerId: string, resourceId: string): boolean`

检查玩家的某资源是否已初始化。

```typescript
if (!resourceManager.isInitialized("p2", "health")) {
  resourceManager.initResource("p2", "health");
}
```

---

## 批量查询

### `getDefinition(resourceId: string): ResourceDefinition | undefined`

获取资源定义。

```typescript
const def = resourceManager.getDefinition("health");
console.log(`默认值: ${def?.defaultValue}, 范围: ${def?.min}~${def?.max}`);
```

### `getDefinitions(): Map<string, ResourceDefinition>`

获取所有已注册的资源定义。

### `getPlayerResourceCount(playerId: string): number`

获取玩家的资源种类数量。

### `getPlayerResources(playerId: string): Map<string, ResourceState>`

获取玩家的所有资源状态。

```typescript
const resources = resourceManager.getPlayerResources("p1");
for (const [id, state] of resources) {
  console.log(`${id}: ${state.current}/${state.max}`);
}
```

---

## 清理

### `clear(): void`

清除所有资源和定义。

---

## ResourceDefinition 类型

```typescript
interface ResourceDefinition {
  id: string;         // 唯一标识（如 "health"）
  name: string;       // 显示名称
  defaultValue: number;  // 初始值
  min?: number;       // 最小值（默认 0）
  max?: number;       // 最大值（默认 Infinity）
  regenPerTurn?: number;  // 每回合再生量
}

interface ResourceState {
  definitionId: ResourceId;
  current: number;   // 当前值
  min: number;       // 最小值
  max: number;       // 最大值
}
```

---

## RESOURCE_CHANGED 事件

每次 `modify`/`set`/`resetToDefault` 都会触发：

```typescript
{
  type: "resource:changed",
  source: "damage",    // 修改来源
  target: "p1",        // 目标玩家
  data: {
    playerId: "p1",
    resourceId: "health",
    oldValue: 4,
    newValue: 3,
    delta: -1,
  }
}
```

---

## 完整使用示例

```typescript
import { EventBus, ResourceManager } from "@cardverse/core";

const eventBus = new EventBus();
const resources = new ResourceManager(eventBus);

// 注册定义
resources.registerDefinition({ id: "health", name: "体力值", defaultValue: 4, min: 0 });
resources.registerDefinition({ id: "hand_limit", name: "手牌上限", defaultValue: 4, min: 0, regenPerTurn: 0 });

// 初始化玩家资源
resources.initResource("p1", "health");
resources.initResource("p1", "hand_limit");

// 监听资源变化
eventBus.on("resource:changed", (event) => {
  console.log(`${event.data.playerId}.${event.data.resourceId}: ${event.data.oldValue} → ${event.data.newValue}`);
});

// 操作资源
await resources.modify("p1", "health", -2, "damage");
// 输出: p1.health: 4 → 2

await resources.set("p1", "health", 4, "heal");
// 输出: p1.health: 2 → 4
```