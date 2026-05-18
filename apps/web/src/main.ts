import { GameUI } from "./GameUI.js";
import type { CardData } from "./CardView.js";

interface DeckCard {
  id: string;
  name: string;
  category: string;
}

async function loadCards(): Promise<CardData[]> {
  const response = await fetch("/sanguosha/manifest.json");
  const manifest = await response.json();

  const cardPacks = manifest.cardPacks as string[];
  const allCards: CardData[] = [];

  for (const pack of cardPacks) {
    const packPath = pack.replace("./", "/sanguosha/");
    const packResponse = await fetch(packPath);
    const packData = await packResponse.json();

    const cards = (packData.cards ?? []) as DeckCard[];
    for (const card of cards) {
      const category = card.category ?? "basic";
      allCards.push({
        id: card.id,
        name: card.name,
        category,
        type: card.id,
      });
    }
  }

  return allCards;
}

async function main(): Promise<void> {
  const appRoot = document.getElementById("app");
  if (!appRoot) {
    document.body.innerHTML = '<div id="app" style="width:100%;height:100%;"></div>';
    return;
  }

  const allCards = await loadCards();
  const handCards: CardData[] = [];

  const dealTypes = ["sha", "shan", "tao", "tao", "jiu", "duel", "nanman"];
  for (const t of dealTypes) {
    const found = allCards.find((c) => c.id === t);
    if (found) {
      handCards.push({ ...found });
    }
  }

  if (handCards.length < 4) {
    for (const card of allCards) {
      if (!handCards.some((h) => h.id === card.id)) {
        handCards.push({ ...card });
        if (handCards.length >= 7) break;
      }
    }
  }

  const ui = new GameUI();
  await ui.init(appRoot, {
    playerName: "主公",
    handCards,
    turn: 1,
    phase: "play",
    health: 4,
    maxHealth: 4,
  });

  const actionBtn = document.createElement("div");
  actionBtn.style.cssText = `
    position: absolute;
    bottom: 24px;
    left: 50%;
    transform: translateX(-50%);
    display: flex;
    gap: 8px;
    z-index: 10;
  `;
  appRoot.style.position = "relative";
  appRoot.appendChild(actionBtn);

  function addButton(text: string, bg: string, action: () => void): void {
    const btn = document.createElement("button");
    btn.textContent = text;
    btn.style.cssText = `
      padding: 8px 20px;
      background: ${bg};
      color: #fff;
      border: none;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      font-family: Arial, sans-serif;
    `;
    btn.onclick = action;
    actionBtn.appendChild(btn);
  }

  addButton("出杀", "#cc4444", () => {
    const selected = ui.getSelectedCardIds();
    if (selected.length > 0) {
      ui.notifyAction("play", selected);
    }
  });

  addButton("取消", "#444444", () => {
    ui.clearSelection();
  });

  addButton("结束回合", "#336644", () => {
    ui.notifyAction("endTurn", []);
  });

  const phases = ["prepare", "judge", "draw", "play", "discard", "end"];
  let currentPhase = 0;
  let turnNum = 1;

  setInterval(() => {
    currentPhase = (currentPhase + 1) % phases.length;
    if (currentPhase === 0) {
      turnNum++;
    }
    ui.hud.updateTurn(turnNum);
    ui.hud.updatePhase(phases[currentPhase]);
  }, 3000);
}

main().catch((err) => {
  console.error("Failed to initialize CardVerse UI:", err);
  document.body.innerHTML = `<div style="color:#f44;padding:40px;font-family:Arial,sans-serif;">
    <h2>CardVerse 启动失败</h2>
    <p>${err instanceof Error ? err.message : String(err)}</p>
  </div>`;
});