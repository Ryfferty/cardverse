export interface OpponentInfo {
  playerId: string;
  name: string;
  health: number;
  maxHealth: number;
  handCount: number;
  isCurrentTurn: boolean;
  seatIndex: number;
}

export class OpponentPanel {
  private container: HTMLDivElement;

  constructor() {
    this.container = document.createElement("div");
    this.container.style.cssText = `
      position: absolute;
      right: 12px;
      top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      z-index: 10;
      font-family: Arial, sans-serif;
    `;
  }

  mount(parent: HTMLElement): void {
    parent.style.position = "relative";
    parent.appendChild(this.container);
  }

  render(opponents: OpponentInfo[]): void {
    this.container.innerHTML = "";

    for (const opp of opponents) {
      const card = document.createElement("div");
      const isTurn = opp.isCurrentTurn;

      card.style.cssText = `
        background: ${isTurn ? "#2a2a4e" : "#1a1a2e"};
        border: 2px solid ${isTurn ? "#cc9944" : "#444"};
        border-radius: 8px;
        padding: 8px 12px;
        color: #e0d5c0;
        min-width: 180px;
        transition: border-color 0.3s;
      `;

      const header = document.createElement("div");
      header.style.cssText = "display:flex;justify-content:space-between;margin-bottom:4px;";

      const nameEl = document.createElement("span");
      nameEl.textContent = opp.name;
      nameEl.style.cssText = `font-size:14px;font-weight:600;${isTurn ? "color:#ffcc44;" : ""}`;
      header.appendChild(nameEl);

      const handEl = document.createElement("span");
      handEl.textContent = `手牌: ${opp.handCount}`;
      handEl.style.cssText = "font-size:12px;color:#aaa;";
      header.appendChild(handEl);

      card.appendChild(header);

      const hpBar = document.createElement("div");
      hpBar.style.cssText = `
        width: 100%;
        height: 10px;
        background: #333;
        border-radius: 4px;
        overflow: hidden;
        margin-top: 4px;
      `;

      const hpPct = (opp.health / opp.maxHealth) * 100;
      const hpColor = hpPct > 60 ? "#44cc44" : hpPct > 30 ? "#cc9944" : "#cc4444";

      const hpFill = document.createElement("div");
      hpFill.style.cssText = `
        width: ${hpPct}%;
        height: 100%;
        background: ${hpColor};
        border-radius: 4px;
        transition: width 0.3s;
      `;
      hpBar.appendChild(hpFill);

      const hpLabel = document.createElement("div");
      hpLabel.textContent = `${opp.health} / ${opp.maxHealth}`;
      hpLabel.style.cssText = "font-size:11px;color:#888;text-align:right;margin-top:2px;";

      card.appendChild(hpBar);
      card.appendChild(hpLabel);
      this.container.appendChild(card);
    }
  }
}