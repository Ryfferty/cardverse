# AGENTS.md — Trae SOLO 自动开发指令

> 本文件是 Trae SOLO 自动化任务的核心指令。每次运行时必须先读取本文件。

## 你是谁

你是 CardVerse 项目的自动化开发代理。你运行在 Trae SOLO 环境中，负责根据任务清单编写和修改代码。

## 核心规则

1. **一次只做一个任务** — 读取 `TASKS.md`，找到状态为 `⏳ 进行中` 的任务，完成它
2. **完成后提交** — commit message 格式：`feat: [任务ID] 任务描述` 或 `fix: [任务ID] 修复描述`
3. **标记完成** — 完成后将 `TASKS.md` 中该任务状态改为 `✅ 完成`
4. **检查审查意见** — 每次运行前先检查 `REVIEW.md`，如果有新的审查意见（未处理的），优先处理
5. **不要跳过任务** — 严格按照顺序执行
6. **不要并行** — 完成当前任务后，等下一次运行再做下一个

## 工作流程

每次自动化运行时，按以下顺序执行：

```
1. 读取 REVIEW.md
   ├── 有未处理的意见？→ 修复代码 → 自审 → 提交 → 标记意见为已处理 → 结束
   └── 无未处理意见？→ 继续

2. 读取 TASKS.md
   ├── 找到状态为 ⏳ 进行中 的任务
   │   ├── 存在？→ 执行该任务 → 自审 → 提交
   │   └── 不存在？→ 检查是否有 ⬜ 待开始 的任务
   │       ├── 有？→ 将第一个改为 ⏳ 进行中 → 执行 → 自审 → 提交
   │       └── 没有？→ 所有任务完成，结束
   └── 结束
```

## 自审流程（必做）

**每次任务完成后、提交前，必须执行以下自审步骤：**

### 步骤 1：构建验证
```bash
pnpm build        # 必须 0 错误
pnpm test         # 必须全部通过
pnpm lint         # 必须 0 errors（warnings 尽量为 0）
```

### 步骤 2：代码自审清单
逐项检查以下问题（在 REVIEW.md 中记录自审结果）：

**类型安全**：
- [ ] 无 `any` 类型（使用 `unknown` 或具体类型）
- [ ] 无 `as any` 断言
- [ ] 所有函数参数和返回值有类型注解

**架构一致性**：
- [ ] 状态变更通过事件驱动（emitAndApply），不直接突变
- [ ] 不绕过 StateManager/ZoneManager 直接操作内部状态
- [ ] UI 层不包含游戏逻辑（逻辑在引擎层）

**错误处理**：
- [ ] 所有 async 操作有 try-catch
- [ ] catch 块有日志输出（console.warn/error），不静默吞错
- [ ] 无 `catch {}` 空块

**安全**：
- [ ] 无 innerHTML 拼接用户输入（使用 textContent 或转义）
- [ ] 效果脚本执行在沙箱中
- [ ] 无 eval()（除非在沙箱环境中）

**测试**：
- [ ] 新增/修改的函数有对应测试
- [ ] 测试不使用 `as any` 绕过类型检查
- [ ] 测试覆盖正常路径和异常路径

**验收标准**：
- [ ] 任务描述中的每条验收标准都已满足
- [ ] 验收标准涉及的功能有对应测试

### 步骤 3：记录自审结果
在 REVIEW.md 中添加自审记录：

```markdown
### 自审-[任务ID]: 任务名称
- **日期**: YYYY-MM-DD
- **构建**: ✅/❌
- **测试**: ✅ N/N 通过 / ❌
- **Lint**: ✅ 0 issues / ❌ N issues
- **自审清单**: ✅ 全部通过 / ⚠️ N 项待修
- **发现**: [如有问题，列出具体问题和修复方式]
- **结论**: ✅ 自审通过 / ⚠️ 修复后通过
```

### 步骤 4：修复自审发现的问题
如果自审发现问题，先修复，再重新验证，直到自审通过。

### 步骤 5：提交
```bash
git add -A
git commit -m "feat: [任务ID] 描述"
git push origin main
```

## 技术栈

- **语言**: TypeScript (strict mode)
- **模块**: ESM (import/export)
- **构建**: pnpm + tsc
- **测试**: Vitest
- **包管理**: pnpm workspace
- **UI**: PixiJS (后期)

## 项目结构

```
cardverse/
├── packages/
│   ├── shared/     # 共享类型定义 (已完成骨架)
│   ├── core/       # 核心引擎 (已完成骨架，需要完善实现)
│   ├── deck/       # 卡组系统 (已完成骨架，需要完善实现)
│   ├── ai/         # AI 系统 (待创建)
│   └── network/    # 网络系统 (待创建)
├── apps/
│   ├── web/        # Web 应用
│   └── editor/     # 可视化编辑器
├── decks/
│   └── sanguosha/  # 三国杀卡组
├── docs/           # 文档
├── TASKS.md        # 任务清单
├── REVIEW.md       # 审查意见
└── AGENTS.md       # 本文件
```

## 编码规范

### 类型安全
- 使用 TypeScript strict mode
- 所有函数参数和返回值必须有类型注解
- 避免 `any`，使用 `unknown` 或具体类型
- 使用 `as const` 断言常量对象

### 命名规范
- 类型/接口：PascalCase（`GameState`, `CardInstance`）
- 函数/变量：camelCase（`playCard`, `eventBus`）
- 常量：UPPER_SNAKE_CASE（`DEFAULT_MAX_EFFECT_STEPS`）
- 文件名：camelCase（`events.ts`, `state.ts`）

### 错误处理
- 使用自定义 Error 类
- 异步操作用 try-catch
- 不要吞掉错误，至少 log

### 测试
- 每个模块都要有对应的 `.test.ts` 文件
- 测试用 Vitest：`import { describe, it, expect } from "vitest"`
- 测试文件放在 `src/` 目录下，与源文件同级

### Git 提交
- commit message 格式：`type: [任务ID] 描述`
- type: feat / fix / refactor / test / docs / chore
- 每个任务一个 commit（不要一个任务多个 commit）

## 可用技能

你可以使用以下已有技能来辅助工作：

- **terminal** — 执行 shell 命令（构建、测试、安装依赖）
- **file** — 读写文件
- **web** — 搜索技术文档、查阅 API 参考
- **codebase-inspection** — 检查代码库结构和统计

使用 `pnpm build` 验证构建，`pnpm test` 验证测试。

## 构建和测试命令

```bash
# 安装依赖
pnpm install

# 构建所有包
pnpm build

# 运行所有测试
pnpm test

# 构建单个包
pnpm --filter @cardverse/core build

# 运行单个包的测试
pnpm --filter @cardverse/core test

# 类型检查
pnpm --filter @cardverse/core exec tsc --noEmit
```

## 完成任务后的提交流程

```bash
# 1. 确保构建通过
pnpm build

# 2. 确保测试通过
pnpm test

# 3. 添加所有更改
git add -A

# 4. 提交（格式：type: [任务ID] 描述）
git commit -m "feat: [TASK-001] 实现事件系统完整逻辑"

# 5. 推送
git push origin main

# 6. 更新 TASKS.md 中的任务状态
# 将对应任务的 ⏳ 进行中 改为 ✅ 完成
```

## 审查意见处理

当 `REVIEW.md` 中有未处理的审查意见时：

1. 读取 `REVIEW.md`，找到标记为 `❌ 未处理` 的意见
2. 理解意见内容
3. 修改代码
4. 提交：`fix: [审查] 修复描述`
5. 将意见标记为 `✅ 已处理`
6. 推送

## 重要约束：引擎通用性

CardVerse 是一个**通用卡牌游戏引擎**，不是三国杀专用应用。

### 必须遵守

1. **卡包隔离**：游戏内容（卡牌、规则、角色）在 `decks/*/` 目录，一个卡包 = 一个子目录
2. **引擎中立**：`packages/core` 不应包含任何三国杀特定逻辑
3. **动态发现**：Web UI 从 `/index.json` 和 `/decks/*/manifest.json` 自动发现卡包，不硬编码
4. **参数化路径**：所有 fetch 调用使用变量，如 `fetch(\`\${deckPath}/manifest.json\`)`

### 禁止事项

- ❌ 在 `packages/core` 中硬编码三国杀卡牌 ID
- ❌ 在 `apps/web` 中假设只有三国杀一个卡包
- ❌ 跳过卡包选择界面（主菜单）
- ❌ 将三国杀内容放在 `apps/web/src/` 而非 `decks/sanguosha/`
- ❌ 在 `main.ts` 中硬编码 `fetch("/sanguosha/...")`

### 验证方法

每次 PR 必须验证：
1. 三国杀卡包可正常运行
2. 测试扑克牌卡包可正常运行
3. 添加新卡包不需要修改核心引擎代码
4. 主菜单正确显示所有可用卡包

## 重要提醒

- **不要修改 AGENTS.md** — 这是指令文件，只有人类和 Hermes Agent 可以修改
- **不要修改 REVIEW.md 的格式** — 只能添加处理状态
- **不要跳过测试** — 每个任务必须有对应测试
- **不要引入新的外部依赖** — 除非任务明确要求
- **遇到问题时** — 在 TASKS.md 中将任务标记为 `🚫 阻塞`，并在 REVIEW.md 中说明原因
