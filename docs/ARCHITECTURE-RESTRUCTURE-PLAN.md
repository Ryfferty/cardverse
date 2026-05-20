# CardVerse 架构问题审查与修复规划

> 起草：Hermes Agent | 日期：2026-05-21

---

## 一、问题核心

**CardVerse 从"通用卡牌游戏引擎"退化为"三国杀专用应用"**

### 原始设计意图
- **定位**：类似 Minecraft 的模组化卡牌游戏平台
- **核心**：`packages/core`（引擎）+ `decks/`（卡包）= 任意卡牌游戏
- **三国杀**：只是 `decks/sanguosha/` 中的一个卡包

### 当前实际问题

| 问题 | 严重程度 | 影响 |
|------|----------|------|
| 无主菜单/卡包选择界面 | 🔴 阻塞 | 用户无法选择游戏 |
| main.ts 硬编码 `/sanguosha/` 路径 | 🔴 阻塞 | 三国杀成为唯一入口 |
| 测试扑克牌卡包不完整 | 🔴 阻塞 | 无法验证引擎通用性 |
| 游戏启动后卡住无法操作 | 🔴 阻塞 | 完全无法使用 |
| 没有其他玩家/AI | 🔴 阻塞 | 游戏无法进行 |
| 游戏功能按钮无法使用 | 🔴 阻塞 | UI 功能残缺 |

### 问题根因

1. **开发方向偏差**：TASKS.md 中的任务大量描述三国杀的具体内容，而非引擎能力
2. **硬编码路径**：`main.ts` 中 `fetch("/sanguosha/...")` 不可配置
3. **缺少抽象层**：没有 `DeckSelector` 或 `GameLauncher` 组件
4. **测试覆盖不足**：只测试三国杀，引擎通用性未验证

---

## 二、修复目标

### 短期目标（阻塞问题）
1. ✅ 实现主菜单界面（卡包选择）
2. ✅ 修复游戏启动/AI/交互问题
3. ✅ 引擎加载任意卡包而非硬编码

### 中期目标（架构修复）
4. ✅ 测试扑克牌卡包完整可玩
5. ✅ 引擎验证：同时支持三国杀和测试扑克牌
6. ✅ AGENTS.md 更新：强调通用性约束

### 长期目标（生态建设）
7. ⬜ 添加更多卡包支持
8. ⬜ 可视化卡包编辑器
9. ⬜ 局域网联机功能

---

## 三、修复方案

### 阶段 0：问题确认与备份（本次操作）

**TASK-0A: 备份当前状态**
```bash
git branch backup-pre-restructure
git push origin backup-pre-restructure
```

**TASK-0B: 确认测试扑克牌卡包状态**
```bash
ls -la decks/test-poker/
# 期望：manifest.json, rules.json, cards/, characters/, effects/
# 实际：可能缺少 rules.json
```

**TASK-0C: 确认 main.ts 问题**
- 硬编码 `fetch("/sanguosha/...")` 而非可配置路径
- 缺少 `showDeckSelector()` 函数

---

### 阶段 1：主菜单与卡包选择（核心阻塞）

**TASK-1A: 实现卡包发现机制**
```typescript
// apps/web/src/deckDiscovery.ts
interface DiscoveredDeck {
  id: string;
  name: string;
  description: string;
  path: string;
  minPlayers: number;
  maxPlayers: number;
  preview?: string;
}

// 从 /decks/*/manifest.json 自动发现卡包
async function discoverDecks(): Promise<DiscoveredDeck[]>
```

**TASK-1B: 实现主菜单界面**
```typescript
// apps/web/src/MainMenu.ts
class MainMenu {
  async show(): Promise<string | null> // 返回选中的卡包 ID
}
```

**功能要求**：
- 显示所有可用卡包（从 decks/ 目录自动发现）
- 每张卡包显示：名称、描述、玩家人数范围
- 支持"创建房间"和"快速开始"两种模式
- 键盘/鼠标均可操作

**TASK-1C: 重构 main.ts 入口逻辑**
```typescript
// 新的启动流程
async function main(): Promise<void> {
  const menu = new MainMenu();
  const selectedDeckId = await menu.show();
  
  if (!selectedDeckId) {
    // 用户取消，显示重试选项
    return;
  }
  
  const gameLauncher = new GameLauncher(selectedDeckId);
  await gameLauncher.start();
}
```

**禁止事项**：
- ❌ 硬编码任何卡包路径
- ❌ 跳过主菜单直接进入游戏
- ❌ 假设只有三国杀一个卡包

---

### 阶段 2：游戏初始化修复

**TASK-2A: 诊断游戏启动问题**

根据用户描述"卡住使用不了"，可能原因：
1. `await game.start()` 死锁
2. AI 初始化失败
3. 事件监听器注册错误

**诊断步骤**：
```bash
# 1. 检查控制台错误
# 2. 添加启动日志
# 3. 逐阶段隔离问题
```

**TASK-2B: 修复 AI 玩家数量**

问题：用户反映"没有其他玩家"

可能原因：
- `aiPlayers` Map 未正确填充
- AI 回合函数 `runAITurn()` 有 bug
- 玩家状态初始化不正确

**修复方案**：
```typescript
// 验证玩家数量
const expectedPlayers = 4;
const actualPlayers = game.getState().players.size;
console.assert(actualPlayers === expectedPlayers, 
  `玩家数量不正确: 期望${expectedPlayers}, 实际${actualPlayers}`);

// 验证 AI 初始化
console.assert(aiPlayers.size === expectedPlayers - 1,
  `AI 数量不正确`);
```

**TASK-2C: 修复游戏循环**

问题：游戏"卡住"无法继续

可能原因：
- `isHumanTurn` 状态机错误
- `startNextTurnIfAI()` 递归调用失败
- 阶段切换逻辑错误

**修复方案**：
```typescript
// 添加状态机日志
function logTurnState(reason: string) {
  const state = game.getState();
  console.log(`[Turn] ${reason}: turn=${state.turnNumber}, player=${state.currentTurn?.playerId}, phase=${state.currentTurn?.phaseIndex}`);
}

// 在关键节点调用
logTurnState("turn started");
logTurnState("phase advanced");
logTurnState("turn ended");
```

---

### 阶段 3：测试扑克牌卡包完善

**TASK-3A: 完成卡包结构**

当前状态：
```
decks/test-poker/
├── manifest.json  ✅
├── rules.json     ❌ 缺失
├── cards/
│   └── basic.json ✅ (仅 5 张牌)
├── characters/    ❌ 缺失
└── effects/       ❌ 缺失
```

需要创建：
1. `rules.json` — 区域、阶段、资源定义
2. `cards/basic.json` — 完整的 52 张扑克牌
3. `characters/characters.json` — 玩家定义（可选）
4. `effects/` — 效果脚本（可选，扑克牌不需要复杂效果）

**TASK-3B: 扑克牌规则设计**

```json
{
  "zones": [
    { "id": "deck", "owner": "global", "visible": false },
    { "id": "hand", "owner": "player", "visible": false },
    { "id": "play", "owner": "player", "visible": true },
    { "id": "discard", "owner": "global", "visible": true }
  ],
  "phases": [
    { "id": "draw", "auto": false },
    { "id": "action", "auto": false },
    { "id": "discard", "auto": false }
  ],
  "resources": [
    { "id": "chips", "defaultValue": 100 }
  ],
  "turnOrder": "clockwise"
}
```

**TASK-3C: 验证引擎通用性**

测试场景：
1. 加载三国杀 → 正常游戏
2. 加载测试扑克牌 → 正常游戏
3. 同一引擎，不同卡包数据 → 功能一致

---

### 阶段 4：AGENTS.md 更新（防止回退）

**TASK-4A: 添加通用性约束**

在 AGENTS.md 中添加：

```markdown
## 重要约束：引擎通用性

CardVerse 是一个**通用卡牌游戏引擎**，不是三国杀专用应用。

### 必须遵守

1. **卡包隔离**：游戏内容（卡牌、规则、角色）在 `decks/*/` 目录，一个卡包 = 一个子目录
2. **引擎中立**：`packages/core` 不应包含任何三国杀特定逻辑
3. **动态发现**：Web UI 从 `/decks/*/manifest.json` 自动发现可用卡包，不硬编码
4. **参数化路径**：所有 fetch 调用使用变量，如 `fetch(\`\${deckPath}/manifest.json\`)`

### 禁止事项

- ❌ 在 `packages/core` 中硬编码三国杀卡牌 ID
- ❌ 在 `apps/web` 中假设只有三国杀一个卡包
- ❌ 跳过卡包选择界面
- ❌ 将三国杀内容放在 `apps/web/src/` 而非 `decks/sanguosha/`

### 验证方法

每次 PR 必须验证：
```bash
# 1. 三国杀卡包可正常运行
# 2. 测试扑克牌卡包可正常运行  
# 3. 添加新卡包不需要修改核心引擎代码
```
```

---

## 四、任务清单

| 任务 ID | 名称 | 状态 | 优先级 |
|---------|------|------|--------|
| TASK-0A | 备份当前状态 | ⬜ | 🔴 |
| TASK-1A | 实现卡包发现机制 | ⬜ | 🔴 |
| TASK-1B | 实现主菜单界面 | ⬜ | 🔴 |
| TASK-1C | 重构 main.ts 入口 | ⬜ | 🔴 |
| TASK-2A | 诊断游戏启动问题 | ⬜ | 🔴 |
| TASK-2B | 修复 AI 玩家数量 | ⬜ | 🔴 |
| TASK-2C | 修复游戏循环 | ⬜ | 🔴 |
| TASK-3A | 完成测试扑克牌卡包结构 | ⬜ | 🔴 |
| TASK-3B | 扑克牌规则设计 | ⬜ | 🟡 |
| TASK-3C | 验证引擎通用性 | ⬜ | 🟡 |
| TASK-4A | 更新 AGENTS.md | ⬜ | 🟡 |

---

## 五、Trae SOLO 操作指令

详见下方「Trae SOLO 提示词」章节。

---

## 六、验证清单

### 功能验证

- [ ] 启动后显示主菜单
- [ ] 主菜单列出所有可用卡包
- [ ] 选择三国杀后可正常游戏
- [ ] 选择测试扑克牌后可正常游戏
- [ ] AI 玩家正常行动
- [ ] 出牌、结束回合功能正常
- [ ] 游戏结束判定正常

### 架构验证

- [ ] `packages/core` 无三国杀硬编码
- [ ] `apps/web/src/main.ts` 无硬编码卡包路径
- [ ] 新增卡包不需要修改引擎代码
- [ ] AGENTS.md 包含通用性约束

### 测试验证

- [ ] `pnpm build` 通过
- [ ] `pnpm test` 全部通过
- [ ] 引擎测试覆盖多种卡包格式