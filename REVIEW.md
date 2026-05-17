# REVIEW.md — 审查意见

> Hermes Agent 审查代码后在此写入意见。
> Trae SOLO 每次运行时检查本文件，处理未处理的意见。
> 状态：❌ 未处理 | ✅ 已处理

---

## TASK-001 审查结果：PASS with Issues ✅⚠️

**总体评价**：功能实现完整，代码结构清晰，48 个测试全部通过。事件系统的核心架构（EventStack LIFO + EventBus pub/sub）设计合理，支持通配符监听、父子事件关系。

**必须修复（🔴 高优先级）**：

### REVIEW-001: emit 中 handler 异常会导致后续 handler 被跳过
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: `emit()` 方法中如果某个 handler 抛出异常，后续的 handler（包括通配符 handler）会被静默跳过，没有任何错误处理。违反 AGENTS.md 规则「不要吞掉错误，至少 log」。
- **建议**: 在 emit 中为每个 handler 添加 try-catch，收集错误并 log，确保所有 handler 都能执行：
```ts
async emit(event: GameEvent): Promise<void> {
  const errors: Error[] = [];
  const handlers = this.handlers.get(event.type);
  if (handlers) {
    for (const handler of handlers) {
      try { await handler(event); } catch (e) { errors.push(e as Error); }
    }
  }
  const wildcardHandlers = this.handlers.get("*");
  if (wildcardHandlers) {
    for (const handler of wildcardHandlers) {
      try { await handler(event); } catch (e) { errors.push(e as Error); }
    }
  }
  if (errors.length > 0) console.error("EventBus handler errors:", errors);
}
```
- **优先级**: 🔴 高

### REVIEW-002: 测试中使用 `as any` 违反编码规范
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: `events.test.ts` 第 188 行使用 `{} as any`，违反 AGENTS.md 规则「避免 any」。
- **建议**: 使用 `as GameEvent` 配合最小 mock 对象替代。
- **优先级**: 🔴 高

### REVIEW-003: requestResponse 缺少真正的超时机制
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: TASKS.md 要求「响应超时机制（返回 null）」，但当前实现是同步的，仅在没有注册 handler 时返回 null，没有真正的 setTimeout/Promise.race 超时。
- **建议**: 改为异步方法，支持 timeoutMs 参数：
```ts
async requestResponse(eventType: string, event: GameEvent, timeoutMs?: number): Promise<EventResponse | null>
```
- **优先级**: 🔴 高

**建议修复（🟡 中优先级）**：

### REVIEW-004: eventCounter 模块级状态可能导致多实例冲突
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: `eventCounter` 是模块级变量，多个游戏实例共享同一进程时 ID 可能冲突。模块重新导入时计数器重置可能产生重复 ID。
- **建议**: 改为实例级计数器或使用 `crypto.randomUUID()`。
- **优先级**: 🟡 中

### REVIEW-005: 缺少错误传播和事件取消的测试
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: 缺少以下测试场景：handler 抛出异常时的行为、off 注册不存在的 handler、emit 无 handler 时的行为、onResponse 覆盖行为。
- **建议**: 补充对应测试用例。
- **优先级**: 🟡 中

### REVIEW-006: GameEvent.type 的 `| string` 弱化了类型检查
- **状态**: ❌ 未处理
- **关联任务**: TASK-001
- **提交**: 48b7e3b
- **日期**: 2026-05-17
- **问题**: `type: EventTypeValue | string` 中 `| string` 使得类型约束形同虚设。
- **建议**: 去掉 `| string`，强制使用 EventType 枚举；或用品牌类型区分自定义事件。
- **优先级**: 🟡 中

---

## TASK-002 审查结果：PASS with Issues ⚠️

**总体评价**：StateManager 实现完整，29 个测试全部通过。不可变状态模式（structuredClone）、replay 回放、玩家视角过滤等功能均正确实现。所有 EventType 都有对应的 reducer 处理。存在类型安全和原子性问题需要修复。

**必须修复（🔴 高优先级）**：

### REVIEW-007: state.ts 中 18 处 `as string`/`as number` 不安全类型断言
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `reduceStateStatic` 中从 `event.data`（类型 `Record<string, unknown>`）提取值时，全部使用 `as string`/`as number`/`as PlayerId` 等断言，共 18 处。这些断言完全没有运行时验证，如果事件数据格式错误（字段缺失、类型不对），会产生静默错误行为而不是明确失败。虽然 `as string` 不是 `any`，但将 `unknown` 断言为 `string` 不做验证，在效果上等同于绕过类型安全。
- **建议**: 使用类型守卫函数验证：
```ts
function assertString(value: unknown, field: string): string {
  if (typeof value !== "string") throw new Error(`Expected ${field} to be string, got ${typeof value}`);
  return value;
}
// 使用: const playerId = assertString(event.data.playerId, "playerId");
```
- **优先级**: 🔴 高

### REVIEW-008: CARD_MOVED 状态变更是非原子的
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `reduceStateStatic` 中 `CARD_MOVED` 处理（lines 224-236）先从源区域移除卡牌，再添加到目标区域。如果源区域中不存在该卡牌（`indexOf` 返回 -1，移除为 no-op），卡牌仍会被添加到目标区域——产生重复卡牌。
- **建议**: 在移除前验证卡牌存在于源区域，不存在则不添加：
```ts
const index = sourceZone.cards.indexOf(cardId as string);
if (index === -1) break; // Card not in source, don't add to target
sourceZone.cards.splice(index, 1);
targetZone.cards.push(cardId as string);
```
- **优先级**: 🔴 高

**建议修复（🟡 中优先级）**：

### REVIEW-009: getStateForPlayer 应保留对手手牌数量信息
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `getStateForPlayer` 将其他玩家手牌区的 `cards` 设为空数组 `[]`，但当前实现中 `player.handCount` 仍然保留（因为它在 PlayerState 上而非 zone 上）。不过，调用者看到 `handZone.cards = []` 时可能误以为对手 0 张手牌。建议保留手牌数量信息。
- **建议**: 使用 `handZone.cards = new Array(handZone.cards.length).fill('__hidden__')` 保持数量，或添加注释说明 `player.handCount` 仍可用。
- **优先级**: 🟡 中

### REVIEW-010: findZone 回退搜索所有玩家区域存在歧义
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `findZone`（lines 97-101）在未指定 `playerId` 时遍历所有玩家的区域。如果两个玩家有相同 ID 的区域（如都有 "hand"），返回哪个取决于 Map 迭代顺序。
- **建议**: 当 `fromPlayer`/`toPlayer` 未指定时，记录警告日志。
- **优先级**: 🟡 中

### REVIEW-011: 对不存在实体的事件静默忽略，无日志
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `CARD_DRAWN`、`CARD_PLAYED`、`CARD_DISCARDED`、`RESOURCE_CHANGED` 在目标玩家/资源/区域不存在时静默 no-op。违反 AGENTS.md 规则「不要吞掉错误，至少 log」。
- **建议**: 添加 `console.warn` 记录异常事件数据。
- **优先级**: 🟡 中

**建议改进（🟢 低优先级）**：

### REVIEW-012: CARD_PLAYED 仅处理手牌区域
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `CARD_PLAYED` reducer 只从 `hand` 区域移除卡牌，不处理装备区/场上打出的卡牌。
- **建议**: 可通过 `CARD_MOVED` 事件替代，或扩展 `CARD_PLAYED` 支持 `fromZone` 参数。
- **优先级**: 🟢 低

### REVIEW-013: 测试 createEvent 辅助函数 type 参数使用 string
- **状态**: ❌ 未处理
- **关联任务**: TASK-002
- **日期**: 2026-05-17
- **问题**: `state.test.ts` 的 `createEvent` 辅助函数参数 `type: string` 而非 `EventTypeValue`，弱化了测试中的类型检查。
- **建议**: 改为 `type: EventTypeValue | (string & {})` 或直接使用 `EventTypeValue`。
- **优先级**: 🟢 低

---

## TASK-003 审查结果：PASS with Issues ⚠️

**总体评价**：ZoneManager 实现完整，54 个测试全部通过。API 设计清晰，全局/玩家区域创建、卡牌 CRUD、洗牌、可见性过滤、容量限制等功能均正确实现。Fisher-Yates 洗牌算法正确。存在一个关键的原子性 bug。

**必须修复（🔴 高优先级）**：

### REVIEW-014: moveCard 非原子操作导致容量不足时卡牌丢失
- **状态**: ❌ 未处理
- **关联任务**: TASK-003
- **日期**: 2026-05-17
- **问题**: `moveCard`（lines 94-97）先调用 `removeCard` 移除卡牌，再调用 `addCard` 添加。如果 `addCard` 因目标区域容量不足失败（返回 false），卡牌已经从源区域移除但未添加到目标区域——卡牌凭空消失。测试 line 244-246 甚至确认了这个行为（"Card should still be in deck (removed then failed to add)"），但实际断言 `not.toContain` 表明卡牌已丢失。
- **建议**: 实现为原子操作，先检查所有条件再执行修改：
```ts
moveCard(fromKey: string, toKey: string, cardId: CardInstanceId, position?: number): boolean {
  const fromZone = this.zones.get(fromKey);
  const toZone = this.zones.get(toKey);
  if (!fromZone || !toZone) return false;
  const index = fromZone.cards.indexOf(cardId);
  if (index === -1) return false;
  if (toZone.definition.maxSize !== undefined && toZone.cards.length >= toZone.definition.maxSize) return false;
  
  // All checks passed, now execute atomically
  fromZone.cards.splice(index, 1);
  if (position !== undefined) {
    toZone.cards.splice(position, 0, cardId);
  } else {
    toZone.cards.push(cardId);
  }
  return true;
}
```
- **优先级**: 🔴 高

**建议修复（🟡 中优先级）**：

### REVIEW-015: getVisibleZones 不处理全局 "owner" 可见性区域
- **状态**: ❌ 未处理
- **关联任务**: TASK-003
- **日期**: 2026-05-17
- **问题**: `getVisibleZones`（lines 117-123）中，全局区域如果设置 `visibility: "owner"`，由于 `zone.playerId` 为 `undefined`，永远不会出现在任何玩家的可见列表中。
- **建议**: 如果设计上全局区域不应设为 "owner" 可见性，应在 `addGlobalZone` 时验证。否则需要额外逻辑处理。
- **优先级**: 🟡 中

**建议改进（🟢 低优先级）**：

### REVIEW-016: 区域键（zone key）为原始字符串，无类型安全
- **状态**: ❌ 未处理
- **关联任务**: TASK-003
- **日期**: 2026-05-17
- **问题**: 区域键如 `"global:deck"`、`"player:p1:hand"` 都是原始字符串，拼写错误时静默返回 `undefined`。
- **建议**: 提供类型安全的键构建器或品牌类型：
```ts
type ZoneKey = string & { readonly __zoneKey: true };
function globalKey(id: ZoneId): ZoneKey { return `global:${id}` as ZoneKey; }
function playerKey(playerId: PlayerId, zoneId: ZoneId): ZoneKey { return `player:${playerId}:${zoneId}` as ZoneKey; }
```
- **优先级**: 🟢 低

### REVIEW-017: getCards 返回内部数组的可变引用
- **状态**: ❌ 未处理
- **关联任务**: TASK-003
- **日期**: 2026-05-17
- **问题**: `getCards`（line 54）在区域存在时直接返回内部 `cards` 数组引用，外部代码可以意外修改内部状态。`setCards` 正确使用了 `[...cardIds]` 克隆，但 `getCards` 没有。
- **建议**: 改为 `return [...(this.zones.get(key)?.cards ?? [])]`，或明确文档标注返回的是只读引用。
- **优先级**: 🟢 低

---

## 总体评估

| 任务 | 评分 | 测试 | 关键问题 |
|------|------|------|----------|
| TASK-001 | ⚠️ PASS with Issues | 48/48 ✅ | 6 项审查意见均未处理（REVIEW-001~006） |
| TASK-002 | ⚠️ PASS with Issues | 29/29 ✅ | 不安全类型断言(18处)、非原子 CARD_MOVED |
| TASK-003 | ⚠️ PASS with Issues | 54/54 ✅ | moveCard 卡牌丢失 bug |

**未处理审查意见**: 17 项（REVIEW-001 ~ REVIEW-017）
- 🔴 高优先级: 6 项（REVIEW-001, 002, 003, 007, 008, 014）
- 🟡 中优先级: 7 项（REVIEW-004, 005, 006, 009, 010, 011, 015）
- 🟢 低优先级: 4 项（REVIEW-012, 013, 016, 017）

---

*审查人: Hermes Agent | 日期: 2026-05-17*
