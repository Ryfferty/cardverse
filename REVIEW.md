     1|# REVIEW.md — 审查意见
     2|
     3|> Hermes Agent 审查代码后在此写入意见。
     4|> Trae SOLO 每次运行时检查本文件，处理未处理的意见。
     5|> 状态：❌ 未处理 | ✅ 已处理
     6|
     7|---
     8|
     9|## TASK-001 审查结果：PASS with Issues ✅⚠️
    10|
    11|**总体评价**：功能实现完整，代码结构清晰，48 个测试全部通过。事件系统的核心架构（EventStack LIFO + EventBus pub/sub）设计合理，支持通配符监听、父子事件关系。
    12|
    13|**必须修复（🔴 高优先级）**：
    14|
    15|### REVIEW-001: emit 中 handler 异常会导致后续 handler 被跳过
    16|- **状态**: ✅ 已处理
    17|- **关联任务**: TASK-001
    18|- **提交**: 48b7e3b
    19|- **日期**: 2026-05-17
    20|- **问题**: `emit()` 方法中如果某个 handler 抛出异常，后续的 handler（包括通配符 handler）会被静默跳过，没有任何错误处理。违反 AGENTS.md 规则「不要吞掉错误，至少 log」。
    21|- **建议**: 在 emit 中为每个 handler 添加 try-catch，收集错误并 log，确保所有 handler 都能执行：
    22|```ts
    23|async emit(event: GameEvent): Promise<void> {
    24|  const errors: Error[] = [];
    25|  const handlers = this.handlers.get(event.type);
    26|  if (handlers) {
    27|    for (const handler of handlers) {
    28|      try { await handler(event); } catch (e) { errors.push(e as Error); }
    29|    }
    30|  }
    31|  const wildcardHandlers = this.handlers.get("*");
    32|  if (wildcardHandlers) {
    33|    for (const handler of wildcardHandlers) {
    34|      try { await handler(event); } catch (e) { errors.push(e as Error); }
    35|    }
    36|  }
    37|  if (errors.length > 0) console.error("EventBus handler errors:", errors);
    38|}
    39|```
    40|- **优先级**: 🔴 高
    41|
    42|### REVIEW-002: 测试中使用 `as any` 违反编码规范
    43|- **状态**: ✅ 已处理
    44|- **关联任务**: TASK-001
    45|- **提交**: 48b7e3b
    46|- **日期**: 2026-05-17
    47|- **问题**: `events.test.ts` 第 188 行使用 `{} as any`，违反 AGENTS.md 规则「避免 any」。
    48|- **建议**: 使用 `as GameEvent` 配合最小 mock 对象替代。
    49|- **优先级**: 🔴 高
    50|
    51|### REVIEW-003: requestResponse 缺少真正的超时机制
    52|- **状态**: ✅ 已处理
    53|- **关联任务**: TASK-001
    54|- **提交**: 48b7e3b
    55|- **日期**: 2026-05-17
    56|- **问题**: TASKS.md 要求「响应超时机制（返回 null）」，但当前实现是同步的，仅在没有注册 handler 时返回 null，没有真正的 setTimeout/Promise.race 超时。
    57|- **建议**: 改为异步方法，支持 timeoutMs 参数：
    58|```ts
    59|async requestResponse(eventType: string, event: GameEvent, timeoutMs?: number): Promise<EventResponse | null>
    60|```
    61|- **优先级**: 🔴 高
    62|
    63|**建议修复（🟡 中优先级）**：
    64|
    65|### REVIEW-004: eventCounter 模块级状态可能导致多实例冲突
    66|- **状态**: ✅ 已处理
    67|- **关联任务**: TASK-001
    68|- **提交**: 48b7e3b
    69|- **日期**: 2026-05-17
    70|- **问题**: `eventCounter` 是模块级变量，多个游戏实例共享同一进程时 ID 可能冲突。模块重新导入时计数器重置可能产生重复 ID。
    71|- **建议**: 改为实例级计数器或使用 `crypto.randomUUID()`。
    72|- **优先级**: 🟡 中
    73|
    74|### REVIEW-005: 缺少错误传播和事件取消的测试
    75|- **状态**: ✅ 已处理
    76|- **关联任务**: TASK-001
    77|- **提交**: 48b7e3b
    78|- **日期**: 2026-05-17
    79|- **问题**: 缺少以下测试场景：handler 抛出异常时的行为、off 注册不存在的 handler、emit 无 handler 时的行为、onResponse 覆盖行为。
    80|- **建议**: 补充对应测试用例。
    81|- **优先级**: 🟡 中
    82|
    83|### REVIEW-006: GameEvent.type 的 `| string` 弱化了类型检查
    84|- **状态**: ✅ 已处理
    85|- **关联任务**: TASK-001
    86|- **提交**: 48b7e3b
    87|- **日期**: 2026-05-17
    88|- **问题**: `type: EventTypeValue | string` 中 `| string` 使得类型约束形同虚设。
    89|- **建议**: 去掉 `| string`，强制使用 EventType 枚举；或用品牌类型区分自定义事件。
    90|- **优先级**: 🟡 中
    91|
    92|---
    93|
    94|## TASK-002 审查结果：PASS with Issues ⚠️
    95|
    96|**总体评价**：StateManager 实现完整，29 个测试全部通过。不可变状态模式（structuredClone）、replay 回放、玩家视角过滤等功能均正确实现。所有 EventType 都有对应的 reducer 处理。存在类型安全和原子性问题需要修复。
    97|
    98|**必须修复（🔴 高优先级）**：
    99|
   100|### REVIEW-007: state.ts 中 18 处 `as string`/`as number` 不安全类型断言
   101|- **状态**: ✅ 已处理
   102|- **关联任务**: TASK-002
   103|- **日期**: 2026-05-17
   104|- **问题**: `reduceStateStatic` 中从 `event.data`（类型 `Record<string, unknown>`）提取值时，全部使用 `as string`/`as number`/`as PlayerId` 等断言，共 18 处。这些断言完全没有运行时验证，如果事件数据格式错误（字段缺失、类型不对），会产生静默错误行为而不是明确失败。虽然 `as string` 不是 `any`，但将 `unknown` 断言为 `string` 不做验证，在效果上等同于绕过类型安全。
   105|- **建议**: 使用类型守卫函数验证：
   106|```ts
   107|function assertString(value: unknown, field: string): string {
   108|  if (typeof value !== "string") throw new Error(`Expected ${field} to be string, got ${typeof value}`);
   109|  return value;
   110|}
   111|// 使用: const playerId = assertString(event.data.playerId, "playerId");
   112|```
   113|- **优先级**: 🔴 高
   114|
   115|### REVIEW-008: CARD_MOVED 状态变更是非原子的
   116|- **状态**: ✅ 已处理
   117|- **关联任务**: TASK-002
   118|- **日期**: 2026-05-17
   119|- **问题**: `reduceStateStatic` 中 `CARD_MOVED` 处理（lines 224-236）先从源区域移除卡牌，再添加到目标区域。如果源区域中不存在该卡牌（`indexOf` 返回 -1，移除为 no-op），卡牌仍会被添加到目标区域——产生重复卡牌。
   120|- **建议**: 在移除前验证卡牌存在于源区域，不存在则不添加：
   121|```ts
   122|const index = sourceZone.cards.indexOf(cardId as string);
   123|if (index === -1) break; // Card not in source, don't add to target
   124|sourceZone.cards.splice(index, 1);
   125|targetZone.cards.push(cardId as string);
   126|```
   127|- **优先级**: 🔴 高
   128|
   129|**建议修复（🟡 中优先级）**：
   130|
   131|### REVIEW-009: getStateForPlayer 应保留对手手牌数量信息
   132|- **状态**: ✅ 已处理
   133|- **关联任务**: TASK-002
   134|- **日期**: 2026-05-17
   135|- **问题**: `getStateForPlayer` 将其他玩家手牌区的 `cards` 设为空数组 `[]`，但当前实现中 `player.handCount` 仍然保留（因为它在 PlayerState 上而非 zone 上）。不过，调用者看到 `handZone.cards = []` 时可能误以为对手 0 张手牌。建议保留手牌数量信息。
   136|- **建议**: 使用 `handZone.cards = new Array(handZone.cards.length).fill('__hidden__')` 保持数量，或添加注释说明 `player.handCount` 仍可用。
   137|- **优先级**: 🟡 中
   138|
   139|### REVIEW-010: findZone 回退搜索所有玩家区域存在歧义
   140|- **状态**: ✅ 已处理
   141|- **关联任务**: TASK-002
   142|- **日期**: 2026-05-17
   143|- **问题**: `findZone`（lines 97-101）在未指定 `playerId` 时遍历所有玩家的区域。如果两个玩家有相同 ID 的区域（如都有 "hand"），返回哪个取决于 Map 迭代顺序。
   144|- **建议**: 当 `fromPlayer`/`toPlayer` 未指定时，记录警告日志。
   145|- **优先级**: 🟡 中
   146|
   147|### REVIEW-011: 对不存在实体的事件静默忽略，无日志
   148|- **状态**: ✅ 已处理
   149|- **关联任务**: TASK-002
   150|- **日期**: 2026-05-17
   151|- **问题**: `CARD_DRAWN`、`CARD_PLAYED`、`CARD_DISCARDED`、`RESOURCE_CHANGED` 在目标玩家/资源/区域不存在时静默 no-op。违反 AGENTS.md 规则「不要吞掉错误，至少 log」。
   152|- **建议**: 添加 `console.warn` 记录异常事件数据。
   153|- **优先级**: 🟡 中
   154|
   155|**建议改进（🟢 低优先级）**：
   156|
   157|### REVIEW-012: CARD_PLAYED 仅处理手牌区域
   158|- **状态**: ✅ 已处理
   159|- **关联任务**: TASK-002
   160|- **日期**: 2026-05-17
   161|- **问题**: `CARD_PLAYED` reducer 只从 `hand` 区域移除卡牌，不处理装备区/场上打出的卡牌。
   162|- **建议**: 可通过 `CARD_MOVED` 事件替代，或扩展 `CARD_PLAYED` 支持 `fromZone` 参数。
   163|- **优先级**: 🟢 低
   164|
   165|### REVIEW-013: 测试 createEvent 辅助函数 type 参数使用 string
   166|- **状态**: ✅ 已处理
   167|- **关联任务**: TASK-002
   168|- **日期**: 2026-05-17
   169|- **问题**: `state.test.ts` 的 `createEvent` 辅助函数参数 `type: string` 而非 `EventTypeValue`，弱化了测试中的类型检查。
   170|- **建议**: 改为 `type: EventTypeValue | (string & {})` 或直接使用 `EventTypeValue`。
   171|- **优先级**: 🟢 低
   172|
   173|---
   174|
   175|## TASK-003 审查结果：PASS with Issues ⚠️
   176|
   177|**总体评价**：ZoneManager 实现完整，54 个测试全部通过。API 设计清晰，全局/玩家区域创建、卡牌 CRUD、洗牌、可见性过滤、容量限制等功能均正确实现。Fisher-Yates 洗牌算法正确。存在一个关键的原子性 bug。
   178|
   179|**必须修复（🔴 高优先级）**：
   180|
   181|### REVIEW-014: moveCard 非原子操作导致容量不足时卡牌丢失
   182|- **状态**: ✅ 已处理
   183|- **关联任务**: TASK-003
   184|- **日期**: 2026-05-17
   185|- **问题**: `moveCard`（lines 94-97）先调用 `removeCard` 移除卡牌，再调用 `addCard` 添加。如果 `addCard` 因目标区域容量不足失败（返回 false），卡牌已经从源区域移除但未添加到目标区域——卡牌凭空消失。测试 line 244-246 甚至确认了这个行为（"Card should still be in deck (removed then failed to add)"），但实际断言 `not.toContain` 表明卡牌已丢失。
   186|- **建议**: 实现为原子操作，先检查所有条件再执行修改：
   187|```ts
   188|moveCard(fromKey: string, toKey: string, cardId: CardInstanceId, position?: number): boolean {
   189|  const fromZone = this.zones.get(fromKey);
   190|  const toZone = this.zones.get(toKey);
   191|  if (!fromZone || !toZone) return false;
   192|  const index = fromZone.cards.indexOf(cardId);
   193|  if (index === -1) return false;
   194|  if (toZone.definition.maxSize !== undefined && toZone.cards.length >= toZone.definition.maxSize) return false;
   195|  
   196|  // All checks passed, now execute atomically
   197|  fromZone.cards.splice(index, 1);
   198|  if (position !== undefined) {
   199|    toZone.cards.splice(position, 0, cardId);
   200|  } else {
   201|    toZone.cards.push(cardId);
   202|  }
   203|  return true;
   204|}
   205|```
   206|- **优先级**: 🔴 高
   207|
   208|**建议修复（🟡 中优先级）**：
   209|
   210|### REVIEW-015: getVisibleZones 不处理全局 "owner" 可见性区域
   211|- **状态**: ✅ 已处理
   212|- **关联任务**: TASK-003
   213|- **日期**: 2026-05-17
   214|- **问题**: `getVisibleZones`（lines 117-123）中，全局区域如果设置 `visibility: "owner"`，由于 `zone.playerId` 为 `undefined`，永远不会出现在任何玩家的可见列表中。
   215|- **建议**: 如果设计上全局区域不应设为 "owner" 可见性，应在 `addGlobalZone` 时验证。否则需要额外逻辑处理。
   216|- **优先级**: 🟡 中
   217|
   218|**建议改进（🟢 低优先级）**：
   219|
   220|### REVIEW-016: 区域键（zone key）为原始字符串，无类型安全
   221|- **状态**: ✅ 已处理
   222|- **关联任务**: TASK-003
   223|- **日期**: 2026-05-17
   224|- **问题**: 区域键如 `"global:deck"`、`"player:p1:hand"` 都是原始字符串，拼写错误时静默返回 `undefined`。
   225|- **建议**: 提供类型安全的键构建器或品牌类型：
   226|```ts
   227|type ZoneKey = string & { readonly __zoneKey: true };
   228|function globalKey(id: ZoneId): ZoneKey { return `global:${id}` as ZoneKey; }
   229|function playerKey(playerId: PlayerId, zoneId: ZoneId): ZoneKey { return `player:${playerId}:${zoneId}` as ZoneKey; }
   230|```
   231|- **优先级**: 🟢 低
   232|
   233|### REVIEW-017: getCards 返回内部数组的可变引用
   234|- **状态**: ✅ 已处理
   235|- **关联任务**: TASK-003
   236|- **日期**: 2026-05-17
   237|- **问题**: `getCards`（line 54）在区域存在时直接返回内部 `cards` 数组引用，外部代码可以意外修改内部状态。`setCards` 正确使用了 `[...cardIds]` 克隆，但 `getCards` 没有。
   238|- **建议**: 改为 `return [...(this.zones.get(key)?.cards ?? [])]`，或明确文档标注返回的是只读引用。
   239|- **优先级**: 🟢 低
   240|
   241|---
   242|
   243|## TASK-004 审查结果：PASS with Issues ⚠️
   244|
   245|**总体评价**：PhaseManager 功能完整，41 个测试全部通过。阶段推进、动态条件、跳过、回合完成检测均正确实现。代码整洁无 `any`。存在一个安全风险和几个一致性问题。之前的 17 项审查意见均未修复。
   246|
   247|**必须修复（🔴 高优先级）**：
   248|
   249|### REVIEW-018: evaluateCondition 使用 new Function() 存在代码注入风险
   250|- **状态**: ✅ 已处理
   251|- **关联任务**: TASK-004
   252|- **提交**: 8697437
   253|- **日期**: 2026-05-18
   254|- **问题**: `phases.ts` 第 99 行使用 `new Function("state", \`return ${condition}\`)` 执行条件表达式，等同于 `eval()`。卡组定义中的 `condition` 字符串可以执行任意 JavaScript 代码。恶意卡组文件可以执行任意系统命令。
   255|- **建议**: 实现安全的表达式求值器，如属性路径解析器（`state.hasExtraDraw` 按 `.` 分割遍历对象），或使用沙箱库如 `jexl`。
   256|- **优先级**: 🔴 高
   257|
   258|**建议修复（🟡 中优先级）**：
   259|
   260|### REVIEW-019: evaluateCondition catch 块静默吞掉所有错误
   261|- **状态**: ✅ 已处理
   262|- **关联任务**: TASK-004
   263|- **提交**: 8697437
   264|- **日期**: 2026-05-18
   265|- **问题**: `phases.ts` 第 101-103 行 catch 块捕获所有错误（包括条件语法错误）并静默返回 `false`，违反 AGENTS.md「不要吞掉错误，至少 log」。
   266|- **建议**: 添加 `console.warn("evaluateCondition error:", e)` 记录异常。
   267|- **优先级**: 🟡 中
   268|
   269|### REVIEW-020: skipPhase 不评估动态条件，与 nextPhase 行为不一致
   270|- **状态**: ✅ 已处理
   271|- **关联任务**: TASK-004
   272|- **提交**: 8697437
   273|- **日期**: 2026-05-18
   274|- **问题**: `skipPhase()` 直接递增 `currentIndex` 跳到下一阶段，不评估下一阶段的 `condition`。而 `nextPhase()` 会评估条件。行为不一致可能导致跳入本应跳过的条件阶段。
   275|- **建议**: `skipPhase()` 内部调用 `nextPhase()` 的条件评估逻辑。
   276|- **优先级**: 🟡 中
   277|
   278|### REVIEW-021: sub-phases 在类型中定义但从未实现
   279|- **状态**: ✅ 已处理
   280|- **关联任务**: TASK-004
   281|- **提交**: 8697437
   282|- **日期**: 2026-05-18
   283|- **问题**: `types.ts` 定义了 `subPhases?: PhaseDefinition[]` 和 `subPhaseIndex?: number`，测试文件有 `phasesWithSub` fixture 但从未使用。PhaseManager 完全忽略子阶段功能。
   284|- **建议**: 要么实现子阶段支持，要么从类型定义中移除，避免误导。
   285|- **优先级**: 🟡 中
   286|
   287|**建议改进（🟢 低优先级）**：
   288|
   289|### REVIEW-022: goToPhase 不验证目标阶段条件
   290|- **状态**: ✅ 已处理
   291|- **关联任务**: TASK-004
   292|- **提交**: 8697437
   293|- **日期**: 2026-05-18
   294|- **问题**: `goToPhase()` 允许直接跳转到条件阶段而不验证条件，与 `nextPhase()` 行为不一致。可能是设计上的灵活性，但应文档说明。
   295|- **优先级**: 🟢 低
   296|
   297|### REVIEW-023: setPhases 不验证输入
   298|- **状态**: ✅ 已处理
   299|- **关联任务**: TASK-004
   300|- **提交**: 8697437
   301|- **日期**: 2026-05-18
   302|- **问题**: `setPhases()` 不验证阶段定义的必填字段（id、name、auto）、重复 ID、空数组等。
   303|- **建议**: 添加基本输入验证。
   304|- **优先级**: 🟢 低
   305|
   306|### REVIEW-024: 测试中 phasesWithSub fixture 未使用（死代码）
   307|- **状态**: ✅ 已处理
   308|- **关联任务**: TASK-004
   309|- **提交**: 8697437
   310|- **日期**: 2026-05-18
   311|- **问题**: `phases.test.ts` 第 37-49 行定义了 `phasesWithSub` 变量但从未在任何测试中使用。
   312|- **建议**: 添加子阶段测试或移除死代码。
   313|- **优先级**: 🟢 低
   314|
   315|---
   316|
   317|## 总体评估
   318|
   319|| 任务 | 评分 | 测试 | 关键问题 |
   320||------|------|------|----------|
| TASK-001 | ✅ PASS | 55/55 ✅ | 全部已处理 |
| TASK-002 | ✅ PASS | 30/30 ✅ | 类型守卫 & 原子性修复 |
| TASK-003 | ✅ PASS | 54/54 ✅ | moveCard 原子化 |
| TASK-004 | ✅ PASS | 43/43 ✅ | 安全条件求值 |
   325|
   326|**未处理审查意见**: 0 项（全部处理完毕）
- 🔴 高优先级: 0 项（全部已修复）
- 🟡 中优先级: 0 项（全部已修复）
- 🟢 低优先级: 0 项（全部已修复）
   330|
   331|**建议**：TASK-004 的新功能没有引入之前任务的修复。建议 Trae SOLO 在开始 TASK-005 前，集中修复所有 🔴 高优先级审查意见（REVIEW-001, 002, 003, 007, 008, 014, 018），否则技术债务会持续累积。
   332|
   333|---
   334|
   335|*审查人: Hermes Agent | 日期: 2026-05-18*
   336|