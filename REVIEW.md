     1|     1|# REVIEW.md — 审查意见
     2|     2|
     3|     3|> Hermes Agent 审查代码后在此写入意见。
     4|     4|> Trae SOLO 每次运行时检查本文件，处理未处理的意见。
     5|     5|> 状态：❌ 未处理 | ✅ 已处理
     6|     6|
     7|     7|---
     8|     8|
     9|     9|## 审查意见模板
    10|    10|
    11|    11|```
    12|    12|### REVIEW-XXX: 简短标题
    13|    13|- **状态**: ✅ 已处理
    14|    14|- **关联任务**: TASK-XXX
    15|    15|- **提交**: commit hash 或描述
    16|    16|- **日期**: YYYY-MM-DD
    17|    17|- **问题**: 详细描述问题
    18|    18|- **建议**: 如何修复
    19|    19|- **优先级**: 🔴 高 / 🟡 中 / 🟢 低
    20|    20|```
    21|    21|
    22|    22|---
    23|    23|
    24|    24|## 历史审查意见（REVIEW-001 ~ REVIEW-024）
    25|    25|
    26|    26|**状态**: ✅ 已全部处理（commit a30b6eb）
    27|    27|
    28|    28|以下 24 项审查意见已在 2026-05-18 的修复提交中全部解决：
    29|    29|
    30|    30|- ✅ REVIEW-001~006: TASK-001 事件系统（handler 异常、as any、超时、计数器、测试、类型）
    31|    31|- ✅ REVIEW-007~013: TASK-002 状态管理（类型断言、原子性、信息保留、静默错误等）
    32|    32|- ✅ REVIEW-014~017: TASK-003 区域系统（moveCard 原子性、可见性、类型安全等）
    33|    33|- ✅ REVIEW-018~024: TASK-004 阶段系统（代码注入、错误处理、skipPhase 一致性等）
    34|    34|
    35|    35|---
    36|    36|
    37|    37|## 构建修复：BLOCK-001
    38|    38|
    39|    39|### BLOCK-001: 修复提交 a30b6eb 构建失败（2 个 TS 类型错误）
    40|- **状态**: ✅ 已处理（commit f350636）
    41|    41|- **关联任务**: 全局
    42|    42|- **提交**: a30b6eb
    43|    43|- **日期**: 2026-05-18
    44|    44|- **问题**: 修复提交 `pnpm build` 失败，2 个 TypeScript 编译错误：
    45|    45|  1. `events.test.ts:15` — `Type 'string' is not assignable to type 'EventTypeValue'`。`EventType.GAME_START` 在 tsc 编译时被解析为 `string` 而非字面量 `"game:start"`。可能是 tsconfig 的 project references 和 `moduleResolution: "bundler"` 组合导致 `as const` 语义丢失。
    46|    46|  2. `events.test.ts:919` — `Type '() => Promise<unknown>' is not assignable to type 'ResponseHandler'`。REVIEW-003 修复将 `requestResponse` 改为 async（用 `Promise.race`），但 `ResponseHandler` 类型仍为同步 `(event: GameEvent) => EventResponse | null`，不接受返回 `Promise` 的 handler。
    47|    47|- **注意**: vitest 不做类型检查（用 esbuild 转译），所以 182 个测试全部通过但 tsc 编译失败。
    48|    48|- **建议**:
    49|    49|  1. **Line 15 修复**: 确认 tsconfig 项目引用正确解析 `as const`。尝试将 tsconfig.base.json 中的 `moduleResolution` 改为 `"node16"` 或 `"nodenext"`，或在 core 的 tsconfig 中直接 include shared 的源码。
    50|    50|  2. **Line 919 修复**: 更新 `ResponseHandler` 类型为支持异步：
    51|    51|     ```ts
    52|    52|     export type ResponseHandler = (event: GameEvent) => EventResponse | null | Promise<EventResponse | null>;
    53|    53|     ```
    54|    54|- **优先级**: 🔴 高（构建阻塞）
    55|    55|
    56|    56|---
    57|    57|
    58|    58|## TASK-004 审查确认
    59|    59|
    60|    60|TASK-004 之前的 7 项审查意见（REVIEW-018 ~ REVIEW-024）已在 a30b6eb 中修复，具体验证：
    61|    61|
    62|    62|| 审查 | 修复状态 | 验证 |
    63|    63||------|----------|------|
    64|    64|| REVIEW-018: new Function() 代码注入 | ✅ 已修复 | 改用安全属性路径解析器 |
    65|    65|| REVIEW-019: catch 静默吞错 | ✅ 已修复 | 添加 console.error 日志 |
    66|    66|| REVIEW-020: skipPhase 不评估条件 | ✅ 已修复 | 与 nextPhase 一致评估 |
    67|    67|| REVIEW-021: sub-phases 未实现 | ✅ 已处理 | 保留为预留特性 |
    68|    68|| REVIEW-022~024: 低优先级 | ✅ 已修复 | 输入验证、死代码清理等 |
    69|    69|
    70|    70|---
    71|    71|
    72|    72|---

## TASK-006 预审查（Game 引擎整合）

> 以下审查意见基于 TASK-006 开始前对 engine.ts 及相关模块的代码审查。
> engine.ts 已存在骨架（195 行），但整合逻辑不完整且有多个 bug。

### REVIEW-025: playCard 事件字段名与 StateManager reducer 不匹配
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.ts:128-132`, `state.ts:182-184`
- **日期**: 2026-05-18
- **问题**: `playCard()` 发送事件 `{ data: { cardInstanceId, targets } }`，但 StateManager 的 CARD_PLAYED reducer 读取 `event.data.cardId` 和 `event.data.playerId`。字段名完全不匹配：`cardInstanceId` vs `cardId`，且 `playerId` 在 `event.source` 而非 `event.data` 中。**这会导致出牌时手牌不会被正确移除。**
- **建议**: 统一字段名。推荐修改 engine.ts 的 playCard：
  ```ts
  data: { cardId: cardInstanceId, playerId, targets }
  ```
  或修改 state.ts reducer 使用 `cardInstanceId` 和 `event.source`。
- **优先级**: 🔴 高（核心功能 bug）

### REVIEW-026: addPlayer 使用 `as any` 绕过封装
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.ts:91`
- **日期**: 2026-05-18
- **问题**: `(this.state as any).currentState = currentState` 直接操作 StateManager 的私有字段。StateManager 的 `getCurrentState()` 返回深拷贝，这里拿到拷贝修改后用 `as any` 写回，破坏了封装性和类型安全。
- **建议**: 为 StateManager 添加 `addPlayer(player: PlayerState): void` 方法，或通过 GAME_START 事件的 data 携带初始玩家列表。初始化阶段（waiting 状态）可走专用初始化路径而非事件溯源。
- **优先级**: 🔴 高（类型安全 / 架构）

### REVIEW-027: respondToEvent 绕过状态管理
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.ts:138-148`
- **日期**: 2026-05-18
- **问题**: `respondToEvent()` 直接调用 `eventBus.emit()` 而不经过 `emitAndApply()`。RESPONSE_GIVEN 事件不会进入 EventStack、不会被 StateManager 记录。这意味着响应操作对游戏状态不可见，replay 会丢失响应历史。
- **建议**: 将 `respondToEvent` 改为使用 `emitAndApply()`，或至少将事件推入 EventStack 和 eventLog。
- **优先级**: 🔴 高（事件溯源完整性）

### REVIEW-028: 缺少回合流程整合方法
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.ts`
- **日期**: 2026-05-18
- **问题**: Game 类缺少回合管理的核心方法：
  - `startTurn()` / `endTurn()` — 回合开始/结束
  - 阶段自动推进（PhaseManager.nextPhase → emit PHASE_START/PHASE_END → StateManager 联动）
  - 资源再生触发（ResourceManager.applyRegen 在回合开始时）
  - 玩家淘汰判定（HP <= 0 → PLAYER_ELIMINATED）
  - 响应超时处理（requestResponse 的 timeout 机制）
  当前 Game 只有 start/end/playCard/respond 四个动作，无法驱动完整游戏流程。
- **建议**: 补充 `startTurn()`、`endTurn()`、`nextPhase()` 方法，实现 PhaseManager ↔ EventBus ↔ StateManager 的联动。参考 TASKS.md 的具体要求。
- **优先级**: 🟡 中（TASK-006 核心交付物）

### REVIEW-029: StateManager 与 ZoneManager 区域操作双轨制
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `state.ts:182-198`, `zones.ts`
- **日期**: 2026-05-18
- **问题**: StateManager 的 CARD_PLAYED/CARD_DRAWN/CARD_DISCARDED/CARD_MOVED reducer 直接操作 `GameState.zones` 中的 cards 数组，而 ZoneManager 也维护独立的 zones Map 并有 `moveCard`/`addCard`/`removeCard` 方法。**Game 类同时持有两者，但没有同步机制，极易产生不一致。**
- **建议**: 确定单一数据源策略：
  - 方案 A: StateManager 是唯一数据源，ZoneManager 变为纯查询层（读取 StateManager 的状态）
  - 方案 B: ZoneManager 管理区域，StateManager reducer 不直接操作 zones，而是通过 ZoneManager
  - 方案 C: Game 类在 emitAndApply 后同步两者
  推荐方案 A，保持事件溯源的纯粹性。
- **优先级**: 🟡 中（架构一致性）

### REVIEW-030: 缺少 engine.test.ts
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.test.ts`（不存在）
- **日期**: 2026-05-18
- **问题**: Game 类没有任何单元测试。作为核心整合层，它是所有子系统的入口，缺少测试意味着整合逻辑未经验证。TASKS.md 要求测试覆盖率 > 85%。
- **建议**: 编写 engine.test.ts，至少覆盖：
  1. 游戏创建 → 添加玩家 → 开始 → 结束的完整生命周期
  2. 出牌流程（CARD_PLAYED 事件正确传播到 StateManager）
  3. 响应流程（EventStack 机制）
  4. 隐藏信息（getStateForPlayer 正确过滤）
  5. 错误场景（人数不足、非法出牌等）
  6. 集成测试：模拟 2 回合游戏
- **优先级**: 🟡 中（TASK-006 验收标准）

### REVIEW-031: emitAndApply 顺序问题 — 先 emit 后 apply
- **状态**: ❌ 未处理
- **关联任务**: TASK-006
- **文件**: `engine.ts:188-194`
- **日期**: 2026-05-18
- **问题**: `emitAndApply` 先调用 `eventBus.emit(event)` 再调用 `state.applyEvent(event)`。这意味着事件 handler 触发时，StateManager 还没有更新状态。如果 handler 需要读取最新状态（如判断玩家是否存活），会拿到旧数据。
- **建议**: 考虑是否应该先 apply 再 emit，或者提供 `beforeEvent`/`afterEvent` 两个钩子。需要明确事件时序语义。
- **优先级**: 🟢 低（设计决策，取决于事件语义）

---

*审查人: Hermes Agent | 日期: 2026-05-18*
    73|    73|