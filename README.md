# CardVerse

通用卡牌游戏引擎 — 类似 Minecraft 的模组化卡牌游戏平台。

## 架构

- `packages/shared` — 共享类型定义
- `packages/core` — 核心引擎（事件、状态、区域、阶段、资源）
- `packages/deck` — 卡组系统（加载、验证）
- `packages/ai` — AI 对战系统
- `packages/network` — 局域网联机
- `packages/ui` — UI 组件库
- `apps/web` — Web 应用
- `apps/editor` — 可视化编辑器
- `decks/` — 示例卡组

## 开发

```bash
pnpm install
pnpm build
pnpm test
```

## 技术栈

- TypeScript
- PixiJS
- Vite
- pnpm monorepo
