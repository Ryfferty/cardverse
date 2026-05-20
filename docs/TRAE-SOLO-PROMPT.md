# Trae SOLO 提示词：修复 CardVerse 架构问题

## 重要背景

CardVerse 是一个**通用卡牌游戏引擎**，而非三国杀专用应用。原始设计是：
- 引擎（`packages/core`）+ 卡包（`decks/*/`）= 任意卡牌游戏
- 三国杀只是 `decks/sanguosha/` 中的一个卡包

**当前严重问题**：
1. 启动后直接进入三国杀，没有选择界面
2. 游戏卡住无法使用
3. 没有其他玩家/AI
4. 功能按钮无法使用
5. 测试扑克牌卡包不完整

---

## 工作流程

### 第一步：读取规划文档
```bash
cat docs/ARCHITECTURE-RESTRUCTURE-PLAN.md
```

### 第二步：检查当前状态
```bash
# 检查测试扑克牌卡包结构
ls -la decks/test-poker/

# 检查 main.ts 是否硬编码
grep -n "sanguosha" apps/web/src/main.ts
```

### 第三步：按优先级执行任务

**优先级 🔴（阻塞问题）：**

#### TASK-1B: 实现主菜单界面
在 `apps/web/src/MainMenu.ts` 创建主菜单类：

```typescript
// apps/web/src/MainMenu.ts
interface DeckInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
}

export class MainMenu {
  async show(): Promise<string | null> {
    // 1. 从 /decks/*/manifest.json 发现所有卡包
    const decks = await this.discoverDecks();
    
    // 2. 渲染主菜单 UI
    // 3. 用户选择后返回卡包 ID
    // 4. 用户取消返回 null
  }
  
  private async discoverDecks(): Promise<DeckInfo[]> {
    // 动态发现 /decks/*/manifest.json
  }
}
```

**关键要求**：
- ✅ 自动发现所有卡包（不硬编码）
- ✅ 支持键盘和鼠标操作
- ✅ 用户取消时优雅处理

#### TASK-1C: 重构 main.ts 入口
```typescript
// apps/web/src/main.ts
import { MainMenu } from "./MainMenu.js";
import { GameLauncher } from "./GameLauncher.js";

async function main(): Promise<void> {
  // 显示主菜单
  const menu = new MainMenu();
  const selectedDeckId = await menu.show();
  
  if (!selectedDeckId) {
    console.log("用户取消选择");
    return;
  }
  
  // 启动游戏
  const launcher = new GameLauncher(selectedDeckId);
  await launcher.start();
}
```

**禁止**：
- ❌ 硬编码 `fetch("/sanguosha/...")`
- ❌ 跳过主菜单
- ❌ 假设只有三国杀

#### TASK-2B: 修复 AI 玩家
问题："没有其他玩家"

诊断步骤：
```bash
# 添加调试日志
grep -n "aiPlayers" apps/web/src/main.ts
```

修复方案：
```typescript
// 确保 4 个玩家
const expectedPlayers = 4;
const actualPlayers = game.getState().players.size;
console.log(`[Init] 玩家数量: ${actualPlayers}`);

// 确保 AI 数量正确
const aiCount = expectedPlayers - 1; // 3 个 AI
console.log(`[Init] AI 数量: ${aiCount}`);
```

#### TASK-3A: 完善测试扑克牌卡包
创建缺失文件：
```bash
# 1. 创建 rules.json
cat > decks/test-poker/rules.json << 'EOF'
{
  "zones": [
    { "id": "deck", "owner": "global", "visible": false, "ordered": true, "capacity": -1 },
    { "id": "hand", "owner": "player", "visible": false, "ordered": false, "capacity": 5 },
    { "id": "play", "owner": "player", "visible": true, "ordered": false, "capacity": -1 },
    { "id": "discard", "owner": "global", "visible": true, "ordered": false, "capacity": -1 }
  ],
  "phases": [
    { "id": "draw", "auto": false },
    { "id": "action", "auto": false },
    { "id": "discard", "auto": false }
  ],
  "resources": [
    { "id": "chips", "defaultValue": 100, "minValue": 0 }
  ],
  "turnOrder": "clockwise"
}
EOF

# 2. 创建 characters/characters.json
cat > decks/test-poker/characters/characters.json << 'EOF'
{
  "characters": []
}
EOF

# 3. 创建 effects 目录
mkdir -p decks/test-poker/effects
```

**优先级 🟡（架构完善）：**

#### TASK-4A: 更新 AGENTS.md
在 AGENTS.md 添加通用性约束（见下方「AGENTS.md 更新内容」）

---

## 自审清单

每次任务完成后，必须验证：

### 构建验证
```bash
pnpm build    # 必须 0 错误
pnpm test     # 必须全部通过
pnpm lint     # 必须 0 errors
```

### 功能验证
```bash
# 启动 dev server
cd apps/web && pnpm dev

# 验证主菜单显示
# 验证卡包选择功能
# 验证两个卡包都能正常加载
```

### 架构验证
- [ ] `packages/core` 无硬编码三国杀内容
- [ ] `apps/web/src/main.ts` 使用变量路径
- [ ] 新增卡包不需要修改引擎

---

## AGENTS.md 更新内容

在 AGENTS.md 的「重要提醒」部分后添加：

```markdown
## 重要约束：引擎通用性

CardVerse 是一个**通用卡牌游戏引擎**，不是三国杀专用应用。

### 必须遵守

1. **卡包隔离**：游戏内容在 `decks/*/` 目录，一个卡包 = 一个子目录
2. **引擎中立**：`packages/core` 不应包含任何特定卡包逻辑
3. **动态发现**：Web UI 从 `/decks/*/manifest.json` 自动发现卡包
4. **参数化路径**：所有 fetch 使用变量，如 `fetch(\`\${deckPath}/manifest.json\`)`

### 禁止事项

- ❌ 在核心包中硬编码卡包特定内容
- ❌ 假设只有特定卡包存在
- ❌ 跳过主菜单直接进入游戏
- ❌ 将卡包内容放在 `apps/web/src/` 而非 `decks/*/`

### 验证方法

每次 PR 验证：
1. 三国杀卡包可正常运行
2. 测试扑克牌卡包可正常运行
3. 新增卡包不需要修改引擎代码
```

---

## 提交格式

```bash
# 修复类
git commit -m "fix: [TASK-ID] 修复描述"

# 重构类
git commit -m "refactor: [TASK-ID] 重构描述"

# 示例
git commit -m "feat: [TASK-1B] 实现主菜单界面"
git commit -m "fix: [TASK-2B] 修复 AI 玩家初始化"
```

---

## 遇到问题时的处理

如果遇到阻塞问题：
1. 在 TASKS.md 中标记为 `🚫 阻塞`
2. 在 REVIEW.md 中说明原因
3. 等待人工审查

不要尝试"凑合"的方案，必须找到正确解法后再继续。