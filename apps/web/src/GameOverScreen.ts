import type { PlayerId } from "@cardverse/shared";

export interface GameOverData {
  winner: string;
  condition: string;
  players: Array<{
    playerId: PlayerId;
    name: string;
    role: string;
    alive: boolean;
  }>;
  stats: {
    turnCount: number;
    cardsPlayed: number;
    damageDealt: number;
  };
}

export class GameOverScreen {
  private container: HTMLDivElement | null = null;
  private logPanel: HTMLElement | null = null;

  onRestart: (() => void) | null = null;
  onShowLog: (() => void) | null = null;

  show(data: GameOverData): void {
    this.dismiss();

    this.container = document.createElement("div");
    this.container.id = "game-over-screen";
    this.container.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 2000;
      font-family: Arial, sans-serif;
    `;

    const box = document.createElement("div");
    box.style.cssText = `
      background: #1a1a2e;
      border: 2px solid #cc9944;
      border-radius: 16px;
      padding: 32px;
      width: 90%;
      max-width: 500px;
      color: #e0d5c0;
      text-align: center;
    `;

    const title = document.createElement("h2");
    title.style.cssText = "margin:0 0 8px;color:#ffcc44;font-size:28px;";
    title.textContent = "游戏结束";
    box.appendChild(title);

    const winnerText = document.createElement("p");
    winnerText.style.cssText = "margin:0 0 20px;color:#ffcc44;font-size:18px;";
    const winnerLabel = this.getWinnerLabel(data.winner, data.condition);
    winnerText.textContent = winnerLabel;
    box.appendChild(winnerText);

    const playerList = document.createElement("div");
    playerList.style.cssText = `
      text-align: left;
      margin-bottom: 20px;
    `;

    const playerHeader = document.createElement("h3");
    playerHeader.style.cssText = "margin:0 0 8px;color:#aaa;font-size:14px;";
    playerHeader.textContent = "玩家身份";
    playerList.appendChild(playerHeader);

    for (const player of data.players) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: 6px 12px;
        margin-bottom: 4px;
        background: ${player.alive ? "rgba(68,170,68,0.15)" : "rgba(204,68,68,0.15)"};
        border-radius: 4px;
        font-size: 14px;
      `;

      const nameSpan = document.createElement("span");
      nameSpan.style.cssText = `color: ${player.alive ? "#88dd88" : "#cc6666"};`;
      nameSpan.textContent = `${player.name} ${player.alive ? "" : "(阵亡)"}`;

      const roleSpan = document.createElement("span");
      roleSpan.style.cssText = `color: ${this.getRoleColor(player.role)}; font-weight: bold;`;
      roleSpan.textContent = this.getRoleLabel(player.role);

      row.appendChild(nameSpan);
      row.appendChild(roleSpan);
      playerList.appendChild(row);
    }
    box.appendChild(playerList);

    const statsDiv = document.createElement("div");
    statsDiv.style.cssText = `
      text-align: left;
      margin-bottom: 20px;
      padding: 12px;
      background: rgba(255,255,255,0.05);
      border-radius: 8px;
    `;

    const statsHeader = document.createElement("h3");
    statsHeader.style.cssText = "margin:0 0 8px;color:#aaa;font-size:14px;";
    statsHeader.textContent = "游戏统计";
    statsDiv.appendChild(statsHeader);

    const statsItems = [
      { label: "总回合数", value: String(data.stats.turnCount) },
      { label: "出牌总数", value: String(data.stats.cardsPlayed) },
      { label: "伤害总量", value: String(data.stats.damageDealt) },
    ];

    for (const item of statsItems) {
      const row = document.createElement("div");
      row.style.cssText = `
        display: flex;
        justify-content: space-between;
        padding: 4px 0;
        font-size: 14px;
      `;

      const label = document.createElement("span");
      label.style.cssText = "color: #aaa;";
      label.textContent = item.label;

      const value = document.createElement("span");
      value.style.cssText = "color: #ffcc44; font-weight: bold;";
      value.textContent = item.value;

      row.appendChild(label);
      row.appendChild(value);
      statsDiv.appendChild(row);
    }
    box.appendChild(statsDiv);

    const buttons = document.createElement("div");
    buttons.style.cssText = "display:flex;gap:12px;justify-content:center;";

    const restartBtn = document.createElement("button");
    restartBtn.textContent = "再来一局";
    restartBtn.style.cssText = `
      padding: 12px 28px;
      background: #cc4444;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
      font-weight: bold;
    `;
    restartBtn.onclick = () => {
      this.dismiss();
      this.onRestart?.();
    };
    buttons.appendChild(restartBtn);

    const logBtn = document.createElement("button");
    logBtn.textContent = "查看日志";
    logBtn.style.cssText = `
      padding: 12px 28px;
      background: #4488cc;
      color: #fff;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      font-size: 16px;
    `;
    logBtn.onclick = () => {
      this.onShowLog?.();
    };
    buttons.appendChild(logBtn);

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

  setLogPanel(panel: HTMLElement | null): void {
    this.logPanel = panel;
  }

  private getWinnerLabel(winner: string, condition: string): string {
    if (winner === "lord") return "主公阵营获胜！";
    if (winner === "rebel") return "反贼阵营获胜！";
    if (winner === "spy") return "内奸获胜！";
    if (condition === "draw") return "平局！";
    return `${winner} 获胜！`;
  }

  private getRoleLabel(role: string): string {
    const labels: Record<string, string> = {
      lord: "主公",
      loyalist: "忠臣",
      rebel: "反贼",
      spy: "内奸",
    };
    return labels[role] ?? role;
  }

  private getRoleColor(role: string): string {
    const colors: Record<string, string> = {
      lord: "#ffcc44",
      loyalist: "#44cc44",
      rebel: "#cc4444",
      spy: "#8844cc",
    };
    return colors[role] ?? "#aaa";
  }
}
