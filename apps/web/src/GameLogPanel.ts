import type { GameEvent } from "@cardverse/shared";
import { EventType } from "@cardverse/shared";

export interface LogEntry {
  id: number;
  turn: number;
  text: string;
  category: "damage" | "heal" | "card" | "turn" | "system" | "discard";
  timestamp: number;
}

const MAX_LOG_ENTRIES = 200;

const CARD_NAME_MAP: Record<string, string> = {
  sha: "杀",
  shan: "闪",
  tao: "桃",
  jiu: "酒",
  wuzhongshengyou: "无中生有",
  juedou: "决斗",
  nanmanruqin: "南蛮入侵",
  wanjianqifa: "万箭齐发",
  guohechaiqiao: "过河拆桥",
  shunshouqianyang: "顺手牵羊",
  wuxiekezong: "无懈可击",
  zhugecrossbow: "诸葛连弩",
  qinglongspear: "青龙偃月刀",
  baguazhou: "八卦阵",
  juedying: "绝影",
  dilu: "的卢",
  chitu: "赤兔",
  zhuahuangfeidian: "爪黄飞电",
};

function getCardName(cardType: string): string {
  return CARD_NAME_MAP[cardType] ?? cardType;
}

function formatEvent(event: GameEvent, turnNumber: number): LogEntry | null {
  const category = categorizeEvent(event.type);
  const text = formatEventText(event, turnNumber);

  if (!text) return null;

  return {
    id: 0,
    turn: turnNumber,
    text,
    category,
    timestamp: event.timestamp,
  };
}

function categorizeEvent(eventType: string): LogEntry["category"] {
  if (eventType === EventType.DAMAGE_DEALT || eventType === EventType.DAMAGE_TAKEN || eventType === EventType.PLAYER_ELIMINATED) {
    return "damage";
  }
  if (eventType === EventType.HEAL_RECEIVED) {
    return "heal";
  }
  if (eventType === EventType.CARD_PLAYED || eventType === EventType.CARD_DRAWN) {
    return "card";
  }
  if (eventType === EventType.CARD_DISCARDED || eventType === EventType.DISCARD_PHASE || eventType === EventType.DISCARD_COMPLETED) {
    return "discard";
  }
  if (eventType === EventType.TURN_START || eventType === EventType.TURN_END || eventType === EventType.PHASE_START || eventType === EventType.PHASE_END) {
    return "turn";
  }
  return "system";
}

function formatEventText(event: GameEvent, turnNumber: number): string {
  const source = event.source ?? "系统";
  const data = event.data;

  switch (event.type) {
    case EventType.TURN_START:
      return `[回合${turnNumber}] ${source} 的回合开始`;
    case EventType.TURN_END:
      return `[回合${turnNumber}] ${source} 的回合结束`;
    case EventType.CARD_PLAYED: {
      const cardType = data.cardType as string | undefined;
      const cardName = cardType ? getCardName(cardType) : "未知卡牌";
      const targets = data.targets as string[] | undefined;
      if (targets && targets.length > 0) {
        return `[回合${turnNumber}] ${source} 对 ${targets.join("、")} 使用【${cardName}】`;
      }
      return `[回合${turnNumber}] ${source} 使用【${cardName}】`;
    }
    case EventType.CARD_DRAWN: {
      const count = (data.count as number) ?? 1;
      return `[回合${turnNumber}] ${source} 摸了 ${count} 张牌`;
    }
    case EventType.CARD_DISCARDED: {
      return `[回合${turnNumber}] ${source} 弃了一张牌`;
    }
    case EventType.DISCARD_PHASE: {
      const excess = data.excess as number;
      return `[回合${turnNumber}] ${source} 需要弃 ${excess} 张牌`;
    }
    case EventType.DISCARD_COMPLETED: {
      const discardedCards = data.discardedCards as string[] | undefined;
      const count = discardedCards?.length ?? 0;
      return `[回合${turnNumber}] ${source} 弃了 ${count} 张牌`;
    }
    case EventType.DAMAGE_DEALT: {
      const amount = (data.amount as number) ?? 1;
      const target = event.target ?? data.target as string ?? "未知";
      return `[回合${turnNumber}] ${source} 对 ${target} 造成 ${amount} 点伤害`;
    }
    case EventType.DAMAGE_TAKEN: {
      const amount = (data.amount as number) ?? 1;
      return `[回合${turnNumber}] ${source} 受到 ${amount} 点伤害`;
    }
    case EventType.HEAL_RECEIVED: {
      const amount = (data.amount as number) ?? 1;
      return `[回合${turnNumber}] ${source} 恢复 ${amount} 点体力`;
    }
    case EventType.PLAYER_ELIMINATED: {
      return `[回合${turnNumber}] ${source} 阵亡`;
    }
    case EventType.GAME_START:
      return "游戏开始";
    case EventType.GAME_END: {
      const winner = (data.winner as string) ?? "未知";
      return `游戏结束，${winner} 获胜`;
    }
    case EventType.RESPONSE_GIVEN: {
      const response = data.response as Record<string, unknown> | undefined;
      const action = response?.action as string | undefined;
      if (action === "play") {
        return `[回合${turnNumber}] ${source} 打出响应牌`;
      }
      return `[回合${turnNumber}] ${source} 选择不响应`;
    }
    case EventType.RESOURCE_CHANGED: {
      const resourceId = data.resourceId as string | undefined;
      if (resourceId === "health") {
        const delta = data.delta as number | undefined;
        if (delta && delta > 0) {
          return `[回合${turnNumber}] ${source} 体力 +${delta}`;
        }
        if (delta && delta < 0) {
          return `[回合${turnNumber}] ${source} 体力 ${delta}`;
        }
      }
      return "";
    }
    default:
      return "";
  }
}

const CATEGORY_STYLES: Record<LogEntry["category"], string> = {
  damage: "color: #ff4444;",
  heal: "color: #44cc44;",
  card: "color: #4488ff;",
  turn: "color: #ffcc44;",
  system: "color: #aaaaaa;",
  discard: "color: #cc88ff;",
};

export class GameLogPanel {
  private container: HTMLDivElement | null = null;
  private logList: HTMLDivElement | null = null;
  private entries: LogEntry[] = [];
  private nextId = 0;
  private currentTurn = 0;

  mount(parent: HTMLElement): void {
    this.container = document.createElement("div");
    this.container.id = "game-log-panel";
    this.container.style.cssText = `
      position: absolute;
      right: 8px;
      top: 8px;
      width: 280px;
      height: 400px;
      background: rgba(10, 10, 20, 0.85);
      border: 1px solid #444;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      font-family: Arial, sans-serif;
      z-index: 100;
      overflow: hidden;
    `;

    const header = document.createElement("div");
    header.style.cssText = `
      padding: 8px 12px;
      background: #1a1a2e;
      border-bottom: 1px solid #333;
      color: #ffcc44;
      font-size: 14px;
      font-weight: bold;
    `;
    header.textContent = "游戏日志";
    this.container.appendChild(header);

    this.logList = document.createElement("div");
    this.logList.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 4px 8px;
      font-size: 12px;
      line-height: 1.6;
    `;
    this.container.appendChild(this.logList);

    parent.appendChild(this.container);
  }

  unmount(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
      this.logList = null;
    }
  }

  setTurn(turn: number): void {
    this.currentTurn = turn;
  }

  addEvent(event: GameEvent): void {
    const entry = formatEvent(event, this.currentTurn);
    if (!entry) return;

    entry.id = this.nextId++;
    this.entries.push(entry);

    if (this.entries.length > MAX_LOG_ENTRIES) {
      this.entries = this.entries.slice(-MAX_LOG_ENTRIES);
      if (this.logList) {
        while (this.logList.childElementCount > MAX_LOG_ENTRIES) {
          this.logList.removeChild(this.logList.firstChild!);
        }
      }
    }

    this.renderEntry(entry);
  }

  private renderEntry(entry: LogEntry): void {
    if (!this.logList) return;

    const el = document.createElement("div");
    el.style.cssText = `
      ${CATEGORY_STYLES[entry.category]}
      padding: 2px 0;
      border-bottom: 1px solid rgba(255,255,255,0.05);
      word-break: break-all;
    `;
    el.textContent = entry.text;

    this.logList.appendChild(el);
    this.logList.scrollTop = this.logList.scrollHeight;
  }

  getEntries(): LogEntry[] {
    return [...this.entries];
  }

  clear(): void {
    this.entries = [];
    this.nextId = 0;
    if (this.logList) {
      this.logList.textContent = "";
    }
  }
}
