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

## TASK-005 审查（资源系统）

### REVIEW-032: getPlayerResourceCount/getPlayerResources 有前缀碰撞 bug
- **状态**: ✅ 已处理
- **关联任务**: TASK-005
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 将 `resources` 从 `Map<string, ResourceState>` 改为 `Map<PlayerId, Map<ResourceId, ResourceState>>` 嵌套结构，消除前缀匹配，查询变为 O(1)。

### REVIEW-033: initResource 静默失败
- **状态**: ✅ 已处理
- **关联任务**: TASK-005
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 添加 `console.warn`，在 definition 不存在时输出警告信息。

### REVIEW-034: resetToDefault 不触发 RESOURCE_CHANGED 事件
- **状态**: ✅ 已处理
- **关联任务**: TASK-005
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: `resetToDefault` 改为 async，内部调用 `this.set()` 触发 RESOURCE_CHANGED 事件。添加对应测试。

### REVIEW-035: modify 返回值歧义
- **状态**: ✅ 已处理
- **关联任务**: TASK-005
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: `modify` 在资源不存在时抛出 Error 而非返回 0。调用者可通过 try-catch 区分"资源不存在"和"资源值为 0"。相应测试已更新。

---

## TASK-006 预审查（Game 引擎整合）

### REVIEW-025: playCard 事件字段名与 StateManager reducer 不匹配
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: playCard() 发送 `data: { cardId: cardInstanceId, playerId, targets }`，与 StateManager reducer 字段名一致。

### REVIEW-026: addPlayer 使用 `as any` 绕过封装
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 使用 StateManager 新增的 `addPlayer()`、`setPlayerZone()`、`setGlobalZone()`、`updatePlayerHandCount()` 方法进行初始化，消除 `as any`。

### REVIEW-027: respondToEvent 绕过状态管理
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: respondToEvent() 改用 `emitAndApply()`，事件进入 EventStack 和 eventLog，replay 可追溯。

### REVIEW-028: 缺少回合流程整合方法
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 添加 `startTurn()`、`endTurn()`、`nextPhase()` 方法，实现 PhaseManager → EventBus → StateManager 联动。endTurn() 包含资源再生和玩家淘汰判定。

### REVIEW-029: StateManager 与 ZoneManager 区域操作双轨制
- **状态**: ✅ 已处理（已知限制）
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 当前设计以 StateManager 为主要数据源（事件驱动状态变更），ZoneManager 用于初始化和查询。两者共存但方向明确——Game 引擎通过 StateManager 操作 zones，ZoneManager 用于读取和初始设置。

### REVIEW-030: 缺少 engine.test.ts
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: 创建 engine.test.ts，26 个测试覆盖：游戏生命周期、出牌/摸牌流程、响应流程、回合推进、隐藏信息、集成测试。253 个测试全部通过。

### REVIEW-031: emitAndApply 顺序问题
- **状态**: ✅ 已处理
- **关联任务**: TASK-006
- **提交**: f096e65
- **日期**: 2026-05-18
- **修复**: emitAndApply 顺序为 push → apply → emit，确保 handler 触发时 StateManager 已更新到最新状态。

---

## TASK-005 & TASK-006 修复验证

> Hermes Agent 对 Trae SOLO 的修复提交 `f096e65` 进行逐项验证。

**构建**: ✅ pnpm build 通过（shared + core + deck + web）
**测试**: ✅ 253/253 通过（6 个测试文件，含新增 engine.test.ts 26 个测试）
**类型检查**: ✅ tsc --noEmit 零错误

| 审查 | 问题 | 验证结果 | 说明 |
|------|------|----------|------|
| 025 | playCard 字段名不匹配 | ✅ 正确修复 | `data: { cardId, playerId, targets }` 与 reducer 一致 |
| 026 | addPlayer `as any` | ✅ 正确修复 | StateManager 新增 `addPlayer()`/`setPlayerZone()`/`setGlobalZone()` |
| 027 | respondToEvent 绕过状态 | ✅ 正确修复 | 改为 async，走 `emitAndApply()` 完整 pipeline |
| 028 | 缺少回合流程方法 | ✅ 正确修复 | 新增 `startTurn()`/`nextPhase()`/`endTurn()`，含资源再生+淘汰判定 |
| 029 | 区域操作双轨制 | ✅ 合理处理 | StateManager 为主数据源，ZoneManager 用于初始化/查询 |
| 030 | 缺少 engine.test.ts | ✅ 正确修复 | 534 行、26 测试，覆盖完整生命周期+集成测试 |
| 031 | emitAndApply 顺序 | ✅ 正确修复 | 改为 push → apply → emit，handler 能读到最新状态 |
| 032 | 前缀碰撞 bug | ✅ 正确修复 | 改为 `Map<PlayerId, Map<ResourceId, ResourceState>>` 嵌套结构 |
| 033 | initResource 静默失败 | ✅ 正确修复 | 添加 `console.warn` 日志 |
| 034 | resetToDefault 无事件 | ✅ 正确修复 | 改为 async，内部调用 `this.set()` 触发事件 |
| 035 | modify 返回值歧义 | ✅ 正确修复 | 资源不存在时抛出 Error |

**结论**: 11 项审查意见全部正确修复，无新问题引入。TASK-006 可标记完成。

---

---

## TASK-007 审查（卡组加载器）

> 290 tests pass (core: 253 + deck: 37)，pnpm build 通过，tsc --noEmit 通过。

### REVIEW-036: 模块级 instanceCounter 全局状态污染
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: `let instanceCounter = 0` 改为 `private instanceCounter = 0` 实例级属性，每个 DeckLoader 实例独立计数。

### REVIEW-037: DeckError 未从 index.ts 导出
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: index.ts 添加 `export { DeckLoader, DeckError } from "./loader.js"`。

### REVIEW-038: validator.ts 使用 `as any[]` 违反编码规范
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: `(json.cards as any[])` 改为 `(json.cards as Record<string, unknown>[])`，消除 any 类型。

### REVIEW-039: parseManifest 未防御 NaN
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: 添加 `safeInt()` 私有方法，使用 `Number.isNaN()` 检查，NaN 时返回 0。`minPlayers`/`maxPlayers` 均使用 `this.safeInt()`。

### REVIEW-040: 重复 effect ID 静默覆盖
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: `parseEffects` 中添加 `if (effects.has(id)) console.warn(...)` 警告。

### REVIEW-041: CardDefinitionWithCount 接口死代码
- **状态**: ✅ 已处理
- **关联任务**: TASK-007
- **提交**: 6aff32d
- **日期**: 2026-05-18
- **修复**: 删除未使用的 `CardDefinitionWithCount` 接口定义。

---

---

## TASK-007 修复验证

> 验证提交范围内的 6 项审查意见修复情况。

**测试**: ✅ 109/109 通过（deck: validator 72 + loader 37）
**类型检查**: ✅ tsc --noEmit 零错误

| 审查 | 问题 | 验证 | 说明 |
|------|------|------|------|
| 036 | instanceCounter 全局污染 | ✅ 正确修复 | 改为 `private instanceCounter = 0` 实例级 |
| 037 | DeckError 未导出 | ✅ 正确修复 | index.ts 已导出 DeckError |
| 038 | validator `as any[]` | ✅ 正确修复 | 改为 `as Record<string, unknown>[]` |
| 039 | NaN 未防御 | ✅ 正确修复 | 新增 `safeInt()` 方法，isNaN 返回 0 |
| 040 | 重复 effect ID 静默覆盖 | ✅ 正确修复 | 添加 `console.warn` |
| 041 | CardDefinitionWithCount 死代码 | ✅ 正确修复 | 已删除 |

**结论**: 6 项全部正确修复。

---

## TASK-008 审查（卡组验证器）

> 362 tests pass (core: 253 + deck: 109)，pnpm build 通过，tsc --noEmit 通过。
> 验收标准全部满足：合法卡组通过 ✅ / 非法卡组给具体位置 ✅ / 警告不影响结果 ✅

### REVIEW-042: 缺少 effects 验证逻辑
- **状态**: ❌ 未处理
- **关联任务**: TASK-008
- **文件**: `validator.ts`
- **日期**: 2026-05-18
- **问题**: 没有 `validateEffects()` 方法。卡牌内嵌的 effects（`card.effects[]`）的 id/type 等字段完全未校验。
- **建议**: 在 `validateCards()` 中验证 `card.effects` 数组每个 effect 的 id/type 必填性。
- **优先级**: 🟡 中

### REVIEW-043: 缺少 cross-reference 验证
- **状态**: ❌ 未处理
- **关联任务**: TASK-008
- **文件**: `validator.ts`
- **日期**: 2026-05-18
- **问题**: 卡牌 effect 引用的 effect ID 是否存在、卡牌引用的 resource ID 是否存在于 rules.resources 中，均未验证。
- **建议**: 至少在 validateCards 中检查 effect ID 引用的有效性。
- **优先级**: 🟡 中

### REVIEW-044: 缺少 cards 时静默通过
- **状态**: ❌ 未处理
- **关联任务**: TASK-008
- **文件**: `validator.ts:291`
- **日期**: 2026-05-18
- **问题**: `validateCards()` 在 `json.cards` 不存在时直接 return，无 error/warning。没有卡牌的"卡组"能通过验证。
- **建议**: 缺少 cards 时至少产生一个 warning。
- **优先级**: 🟡 中

### REVIEW-045: winConditions/drawConditions 非数组仅报 warning
- **状态**: ❌ 未处理
- **关联任务**: TASK-008
- **文件**: `validator.ts`
- **日期**: 2026-05-18
- **问题**: `winConditions`/`drawConditions` 非数组报 warning，但 `cards`/`characters` 非数组报 error。语义不一致——非数组类型应视为数据结构错误。
- **建议**: `WIN_NOT_ARRAY` 和 `DRAW_NOT_ARRAY` 从 warning 升级为 error。
- **优先级**: 🟡 中

---

*审查人: Hermes Agent | 日期: 2026-05-18*
    73|    73|