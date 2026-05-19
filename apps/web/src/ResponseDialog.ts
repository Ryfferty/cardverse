import type { CardData } from "./CardView.js";

export type ResponseChoice = "play" | "pass";

export interface ResponseDialogConfig {
  title: string;
  message: string;
  availableCards: CardData[];
  timeout?: number;
}

export class ResponseDialog {
  private container: HTMLDivElement | null = null;
  private resolve: ((choice: ResponseChoice) => void) | null = null;
  private selectedCardId: string | null = null;

  async prompt(config: ResponseDialogConfig): Promise<{ choice: ResponseChoice; cardId?: string } | null> {
    if (config.availableCards.length === 0) {
      return { choice: "pass" };
    }

    return new Promise<{ choice: ResponseChoice; cardId?: string } | null>((resolve) => {
      this.resolve = resolve;
      this.selectedCardId = config.availableCards.length > 0 ? config.availableCards[0].id : null;
      this.show(config);

      if (config.timeout && config.timeout > 0) {
        setTimeout(() => {
          if (!this.resolve) return;
          this.dismiss();
          this.resolve(null);
          this.resolve = null;
        }, config.timeout);
      }
    });
  }

  private show(config: ResponseDialogConfig): void {
    this.container = document.createElement("div");
    this.container.id = "response-dialog";
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
      max-width: 500px;
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

    if (config.availableCards.length > 0) {
      const cardList = document.createElement("div");
      cardList.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-bottom: 16px;
        max-height: 200px;
        overflow-y: auto;
      `;

      for (const card of config.availableCards) {
        const cardEl = document.createElement("div");
        const isSelected = card.id === this.selectedCardId;
        cardEl.style.cssText = `
          padding: 8px 14px;
          background: ${isSelected ? "#cc6622" : "#2a2a3e"};
          border: 2px solid ${isSelected ? "#ff9944" : "#444"};
          border-radius: 6px;
          cursor: pointer;
          color: #e0d5c0;
          font-size: 14px;
          transition: all 0.2s;
        `;
        cardEl.textContent = card.name;
        cardEl.onclick = () => {
          this.selectedCardId = card.id;
          const all = cardList.querySelectorAll("div");
          all.forEach((el) => {
            (el as HTMLElement).style.background = "#2a2a3e";
            (el as HTMLElement).style.borderColor = "#444";
          });
          cardEl.style.background = "#cc6622";
          cardEl.style.borderColor = "#ff9944";
        };
        cardList.appendChild(cardEl);
      }
      box.appendChild(cardList);
    }

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:8px;justify-content:flex-end;";

    if (config.availableCards.length > 0) {
      const playBtn = document.createElement("button");
      playBtn.textContent = "出牌响应";
      playBtn.style.cssText = `
        padding: 8px 20px;
        background: #cc4444;
        color: #fff;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      `;
      playBtn.onclick = () => {
        this.dismiss();
        this.resolve?.({ choice: "play", cardId: this.selectedCardId ?? undefined });
        this.resolve = null;
      };
      buttons.appendChild(playBtn);
    }

    const passBtn = document.createElement("button");
    passBtn.textContent = "不响应";
    passBtn.style.cssText = `
      padding: 8px 20px;
      background: #555;
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
    `;
    passBtn.onclick = () => {
      this.dismiss();
      this.resolve?.({ choice: "pass" });
      this.resolve = null;
    };
    buttons.appendChild(passBtn);

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