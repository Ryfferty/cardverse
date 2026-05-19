# 区域管理 API

`ZoneManager` 管理游戏中所有卡牌区域，包括全局区域（牌堆、弃牌堆）和玩家区域（手牌、装备、判定区等）。

## 导入

```typescript
import { ZoneManager } from "@cardverse/core";
```

---

## 构造函数

```typescript
const zoneManager = new ZoneManager();
```

---

## 区域创建

### `addGlobalZone(definition: ZoneDefinition): void`

添加全局区域（所有玩家共享）。

```typescript
zoneManager.addGlobalZone({
  id: "deck",
  name: "牌堆",
  visibility: "none",
  ordered: true,
  faceDown: true,
  owner: "global",
});
zoneManager.addGlobalZone({
  id: "discard",
  name: "弃牌堆",
  visibility: "all",
  ordered: true,
  faceDown: false,
  owner: "global",
});
```

### `addPlayerZone(playerId: string, definition: ZoneDefinition): void`

为指定玩家创建区域。

```typescript
// 每个玩家都需要
zoneManager.addPlayerZone("p1", {
  id: "hand",
  name: "手牌",
  visibility: "owner",
  ordered: false,
  faceDown: false,
  owner: "player",
});
zoneManager.addPlayerZone("p1", {
  id: "equipment",
  name: "装备区",
  visibility: "all",
  ordered: false,
  maxSize: 5,
  faceDown: false,
  owner: "player",
});
```

---

## 区域查询

### `getZone(key: string): ZoneState | undefined`

通过完整键名获取区域。

```typescript
zoneManager.getZone("global:deck");
zoneManager.getZone("player:p1:hand");
```

### `getGlobalZone(zoneId: string): ZoneState | undefined`

获取全局区域。

```typescript
const deck = zoneManager.getGlobalZone("deck");
```

### `getPlayerZone(playerId: string, zoneId: string): ZoneState | undefined`

获取玩家区域。

```typescript
const hand = zoneManager.getPlayerZone("p1", "hand");
```

---

## 卡牌操作

### `addCard(key: string, cardId: string, position?: number): boolean`

向区域添加卡牌。

- **参数**:
  - `key`: 区域键名
  - `cardId`: 卡牌实例 ID
  - `position`: 插入位置（默认末尾）
- **返回**: 成功 `true`，容量满或区域不存在 `false`

```typescript
zoneManager.addCard("global:deck", "card_1");
zoneManager.addCard("player:p1:hand", "card_5", 0); // 插入顶部
```

### `removeCard(key: string, cardId: string): boolean`

从区域移除卡牌。

```typescript
zoneManager.removeCard("player:p1:hand", "card_5");
```

### `moveCard(fromKey: string, toKey: string, cardId: string, position?: number): boolean`

原子性地在区域间移动卡牌。所有前置条件检查通过才执行。

```typescript
// 从手牌移到装备区
zoneManager.moveCard("player:p1:hand", "player:p1:equipment", "eight_diagram", 0);
```

### `setCards(key: string, cardIds: string[]): boolean`

替换区域内的所有卡牌（用于初始化）。

```typescript
zoneManager.setCards("global:deck", allCards.map(c => c.instanceId));
```

---

## 区域操作

### `shuffle(key: string): void`

洗牌（Fisher-Yates 算法）。

```typescript
zoneManager.shuffle("global:deck");
```

### `getZoneSize(key: string): number`

获取区域内卡牌数量。

```typescript
const deckSize = zoneManager.getZoneSize("global:deck");
```

### `isEmpty(key: string): boolean`

区域是否为空。

```typescript
if (zoneManager.isEmpty("global:deck")) {
  // 牌堆为空，回收弃牌堆
}
```

### `hasZone(key: string): boolean`

区域是否存在。

```typescript
const hasGraveyard = zoneManager.hasZone("player:p1:graveyard");
```

---

## 可见性查询

### `getVisibleZones(playerId: string): string[]`

获取指定玩家可见的所有区域键名。

```typescript
const visible = zoneManager.getVisibleZones("p1");
// ["global:discard", "player:p1:hand", "player:p1:equipment", ...]
```

### `getVisibleCards(zoneKey: string, playerId: string): CardInstanceId[]`

获取玩家在指定区域可见的卡牌列表。尊重区域可见性规则。

```typescript
const handCards = zoneManager.getVisibleCards("player:p1:hand", "p1"); // 所有手牌
const othersHand = zoneManager.getVisibleCards("player:p2:hand", "p1"); // 空数组
```

---

## 批量查询

### `getAllZoneKeys(): string[]`

获取所有区域键名。

### `listGlobalZones(): ZoneState[]`

列出所有全局区域。

### `listPlayerZones(playerId: string): ZoneState[]`

列出指定玩家的所有区域。

```typescript
const p1Zones = zoneManager.listPlayerZones("p1");
for (const zone of p1Zones) {
  console.log(`${zone.definition.name}: ${zone.cards.length} 张`);
}
```

---

## 清理

### `clear(): void`

清除所有区域数据。

---

## ZoneDefinition 类型

```typescript
interface ZoneDefinition {
  id: string;
  name: string;
  visibility: "owner" | "all" | "none";  // owner=仅拥有者 / all=所有人 / none=无人
  ordered: boolean;     // 卡牌是否有序
  maxSize?: number;     // 容量上限
  faceDown: boolean;    // 是否面朝下
  owner: "player" | "global";  // 所有者
}

interface ZoneState {
  definition: ZoneDefinition;
  cards: CardInstanceId[];
  playerId?: PlayerId;  // 仅玩家区域有
}
```