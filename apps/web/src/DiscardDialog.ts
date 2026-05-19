import type { CardData } from "./CardView.js";

export interface DiscardDialogConfig {
  title: string;
  message: string;
  availableCards: CardData[];
  discardCount: number;
  timeout?: number;
}

export class DiscardDialog {
  private container: HTMLDivElement | null = null;
  private resolve: ((selected: string[] | null) => void) | null = null;
  private selectedCardIds: Set<string> = new Set();

  async prompt(config: DiscardDialogConfig): Promise<string[] | null> {
    if (config.availableCards.length === 0) {
      return [];
    }

    if (config.discardCount >= config.availableCards.length) {
      return config.availableCards.map((c) => c.id);
    }

    return new Promise<string[] | null>((resolve) => {
      this.resolve = resolve;
      this.selectedCardIds = new Set();
      this.show(config);

      if (config.timeout && config.timeout > 0) {
        setTimeout(() => {
          if (!this.resolve) return;
          const autoSelected = this.autoSelectLowestValue(config.availableCards, config.discardCount);
          this.dismiss();
          this.resolve(autoSelected);
          this.resolve = null;
        }, config.timeout);
      }
    });
  }

  private autoSelectLowestValue(cards: CardData[], count: number): string[] {
    const priority: Record<string, number> = {
      jiu: 0,
      sha: 1,
      shan: 2,
      trick: 3,
      equipment: 4,
      tao: 5,
    };

    const sorted = [...cards].sort((a, b) => {
      const pa = priority[a.type] ?? 3;
      const pb = priority[b.type] ?? 3;
      return pa - pb;
    });

    return sorted.slice(0, count).map((c) => c.id);
  }

  private show(config: DiscardDialogConfig): void {
    this.container = document.createElement("div");
    this.container.id = "discard-dialog";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0,0,0,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      font-family: Arial, sans-serif;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background: #1a1a2e;
      border: 2px solid #cc9944;
      border-radius: 12px;
      padding: 24px;
      width: 90%;
      max-width: 600px;
      color: #e0d5c0;
    `;

    const title = document.createElement("h3");
    title.textContent = config.title;
    title.style.cssText = "margin:0 0 8px;color:#ffcc44;font-size:18px;";
    box.appendChild(title);

    const msg = document.createElement("p");
    msg.textContent = config.message;
    msg.style.cssText = "margin:0 0 16px;color:#ccc;font-size:14px;";
    box.appendChild(msg);

    const counterEl = document.createElement("p");
    counterEl.style.cssText = "margin:0 0 12px;color:#ff9944;font-size:14px;";
    counterEl.textContent = `已选: 0 / ${config.discardCount}`;
    box.appendChild(counterEl);

    const cardList = document.createElement("div");
    cardList.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
      max-height: 250px;
      overflow-y: auto;
    `;

    for (const card of config.availableCards) {
      const cardEl = document.createElement("div");
      cardEl.style.cssText = `
        padding: 8px 14px;
        background: #2a2a3e;
        border: 2px solid #444;
        border-radius: 6px;
        cursor: pointer;
        color: #e0d5c0;
        font-size: 14px;
        transition: all 0.2s;
        user-select: none;
      `;
      cardEl.textContent = card.name;

      cardEl.onclick = () => {
        if (this.selectedCardIds.has(card.id)) {
          this.selectedCardIds.delete(card.id);
          cardEl.style.background = "#2a2a3e";
          cardEl.style.borderColor = "#444";
        } else if (this.selectedCardIds.size < config.discardCount) {
          this.selectedCardIds.add(card.id);
          cardEl.style.background = "#cc6622";
          cardEl.style.borderColor = "#ff9944";
        }
        counterEl.textContent = `已选: ${this.selectedCardIds.size} / ${config.discardCount}`;
      };

      cardList.appendChild(cardEl);
    }
    box.appendChild(cardList);

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

    const confirmBtn = document.createElement("button");
    confirmBtn.textContent = "确认弃牌";
    confirmBtn.style.cssText = `
      padding: 8px 20px;
      background: #cc4444;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    confirmBtn.onclick = () => {
      if (this.selectedCardIds.size !== config.discardCount) return;
      const result = Array.from(this.selectedCardIds);
      this.dismiss();
      this.resolve?.(result);
      this.resolve = null;
    };
    buttons.appendChild(confirmBtn);

    box.appendChild(buttons);
    this.container.appendChild(box);
    document.body.appendChild(this.container);
  }

  dismiss(): void {
    if (this.container) {
      this.container.remove();
      this.container = null;
    }
  }
}
