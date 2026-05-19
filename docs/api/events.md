# 事件系统 API

事件系统由 `EventBus`（发布/订阅）和 `EventStack`（嵌套解析栈）两个类组成。

## 导入

```typescript
import { EventBus, EventStack } from "@cardverse/core";
import type { EventHandler, ResponseHandler } from "@cardverse/core";
```

---

## EventBus — 事件总线

提供事件的发布、订阅和响应请求功能。支持通配符监听。

### 构造函数

```typescript
const eventBus = new EventBus();
```

---

### `on(eventType: string, handler: EventHandler): void`

注册事件处理器。同一 `eventType` 可注册多个处理器。

```typescript
type EventHandler = (event: GameEvent) => void | Promise<void>;
```

- **`"*"` 通配符**: 监听所有事件

```typescript
eventBus.on("card:played", async (event) => {
  console.log(`[${event.type}] cardId=${event.data.cardId}`);
});

eventBus.on("*", (event) => {
  console.log(`全局监听: ${event.type}`);
});
```

---

### `off(eventType: string, handler: EventHandler): void`

移除指定的事件处理器。

```typescript
eventBus.off("card:played", handler);
```

---

### `emit(event: GameEvent): Promise<void>`

触发事件。同步调用所有匹配的处理器（包括通配符 `"*"`）。
单个处理器的异常不会中断其他处理器。

```typescript
await eventBus.emit({
  id: "evt_1",
  type: "card:played",
  source: "p1",
  target: "p2",
  data: { cardId: "sha_1", playerId: "p1", targets: ["p2"] },
  timestamp: Date.now(),
  stackDepth: 0,
});
```

---

### `onResponse(eventType: string, handler: ResponseHandler): void`

注册响应处理器。每个事件类型只能注册一个。

```typescript
type ResponseHandler = (
  event: GameEvent
) => EventResponse | null | Promise<EventResponse | null>;
```

```typescript
eventBus.onResponse("card:played", (event) => {
  // 返回 null 表示不响应
  return {
    playerId: "p2",
    cardId: "shan_1",
    type: "play_card",
    data: {},
  };
});
```

---

### `requestResponse(eventType: string, event: GameEvent, timeoutMs?: number): Promise<EventResponse | null>`

向注册的响应处理器请求响应。

- **参数**:
  - `eventType`: 事件类型
  - `event`: 事件数据
  - `timeoutMs`: 超时时间（毫秒），超时返回 `null`
- **返回**: 响应结果，无处理器或超时返回 `null`

```typescript
const response = await eventBus.requestResponse("card:played", event, 5000);
if (response) {
  console.log(`玩家 ${response.playerId} 用 ${response.cardId} 响应`);
} else {
  console.log("无响应或超时");
}
```

---

### `removeResponseHandler(eventType: string): void`

移除响应处理器。

```typescript
eventBus.removeResponseHandler("card:played");
```

---

### `clear(): void`

清除所有注册的处理器（包括响应处理器）。

```typescript
eventBus.clear();
```

---

## EventStack — 事件堆栈

LIFO 结构，用于处理嵌套事件解析（类似万智牌的堆叠机制）。

### 构造函数

```typescript
const eventStack = new EventStack();
```

---

### `push(event: Omit<GameEvent, "id" | "timestamp" | "stackDepth" | "type"> & { type: string }): GameEvent`

将事件推入堆栈。自动生成 `id`、`timestamp`、`stackDepth`。

- **返回**: 完整的 `GameEvent`（含自动生成的字段）

```typescript
const event = eventStack.push({
  type: "card:played",
  source: "p1",
  data: { cardId: "sha_1", playerId: "p1", targets: ["p2"] },
});
```

---

### `pop(): GameEvent | undefined`

弹出栈顶事件。

```typescript
const resolved = eventStack.pop();
```

---

### `peek(): GameEvent | undefined`

查看栈顶事件（不移除）。

```typescript
const top = eventStack.peek();
```

---

### `isEmpty(): boolean`

堆栈是否为空。

```typescript
if (eventStack.isEmpty()) {
  console.log("所有事件已解析");
}
```

---

### `size(): number`

返回堆栈中的事件数量。

```typescript
console.log(`栈深度: ${eventStack.size()}`);
```

---

### `clear(): void`

清空堆栈。

```typescript
eventStack.clear();
```

---

### `toArray(): GameEvent[]`

返回堆栈中所有事件的副本（栈底到栈顶）。

```typescript
for (const event of eventStack.toArray()) {
  console.log(event.type);
}
```

---

## GameEvent 类型

```typescript
interface GameEvent {
  id: string;           // 唯一事件 ID
  type: EventTypeValue; // 事件类型（如 "card:played"）
  source?: PlayerId;    // 事件发起者
  target?: PlayerId;    // 事件目标
  data: Record<string, unknown>;  // 事件数据
  timestamp: number;    // 时间戳
  parentEventId?: string;  // 父事件 ID（嵌套事件）
  stackDepth: number;   // 堆栈深度
}
```

## EventResponse 类型

```typescript
interface EventResponse {
  playerId: PlayerId;         // 响应者
  cardId?: CardInstanceId;    // 使用的卡牌
  action: string;             // 响应动作
  targets?: PlayerId[];       // 目标玩家
  data?: Record<string, unknown>;  // 响应数据
}
```