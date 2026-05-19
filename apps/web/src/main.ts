import { GameUI } from "./GameUI.js";
import type { CardData } from "./CardView.js";
import { DeckLoader } from "@cardverse/deck";
import { Game } from "@cardverse/core";
import type { ZoneDefinition, PhaseDefinition, ResourceDefinition } from "@cardverse/shared";

interface DeckCard {
  id: string;
  name: string;
  category: string;
}

interface DeckCharacter {
  id: string;
  name: string;
  hp: number;
  maxHp: number;
  skills: Array<{ id: string; name: string }>;
}

async function loadDeckData(): Promise<{
  deckJson: Record<string, unknown>;
  allCards: DeckCard[];
  characters: DeckCharacter[];
}> {
  const [manifest, rules, basic, trick, equipment, characters] = await Promise.all([
    fetch("/sanguosha/manifest.json").then((r) => r.json()),
    fetch("/sanguosha/rules.json").then((r) => r.json()),
    fetch("/sanguosha/cards/basic.json").then((r) => r.json()),
    fetch("/sanguosha/cards/trick.json").then((r) => r.json()),
    fetch("/sanguosha/cards/equipment.json").then((r) => r.json()),
    fetch("/sanguosha/characters/characters.json").then((r) => r.json()),
  ]);

  const allCards = [
    ...(basic.cards as DeckCard[]),
    ...(trick.cards as DeckCard[]),
    ...(equipment.cards as DeckCard[]),
  ];

  return {
    deckJson: {
      manifest: manifest.manifest,
      rules: {
        zones: rules.zones,
        phases: rules.phases,
        resources: rules.resources,
        turnOrder: rules.turnOrder ?? "counterclockwise",
      },
      cards: allCards,
      characters: characters.characters,
      winConditions: manifest.winConditions,
      drawConditions: manifest.drawConditions,
    },
    allCards,
    characters: characters.characters as DeckCharacter[],
  };
}

function buildHandCards(
  allCards: DeckCard[],
  instanceIds: string[]
): CardData[] {
  return instanceIds.map((iid) => {
    const parts = iid.split("_");
    const defId = parts.length >= 2 ? parts[1] : iid;
    const card = allCards.find((c) => c.id === defId);
    const category = card?.category ?? "basic";
    return {
      id: iid,
      name: card?.name ?? defId,
      category,
      type: category === "basic" ? defId : category === "equipment" ? "equipment" : "trick",
    };
  });
}

async function main(): Promise<void> {
  const appRoot = document.getElementById("app");
  if (!appRoot) {
    document.body.innerHTML = '<div id="app" style="width:100%;height:100%;"></div>';
    return;
  }

  const { deckJson, allCards } = await loadDeckData();

  const loader = new DeckLoader();
  const deck = loader.loadFromJson(deckJson);

  const game = Game.create({ deckId: deck.manifest.id, playerCount: 4 });

  const zones = (deckJson.rules as { zones: ZoneDefinition[] }).zones;
  const phases = (deckJson.rules as { phases: PhaseDefinition[] }).phases;
  const resources = (deckJson.rules as { resources: ResourceDefinition[] }).resources;

  game.initZones(zones);
  game.initResources(resources);

  const playerNames = ["主公", "忠臣", "反贼", "内奸"];
  const players: string[] = [];

  for (let i = 0; i < 4; i++) {
    const pid = `player_${i}`;
    players.push(pid);

    const player = game.addPlayer(pid, playerNames[i]);
    player.faction = ["shu", "wei", "wu", "qun"][i];

    game.initPlayerZones(pid, zones.filter((z) => z.owner === "player"));

    for (const zone of zones.filter((z) => z.owner === "player")) {
      game.state.setPlayerZone(pid, zone.id, {
        definition: zone,
        cards: [],
        playerId: pid,
      });
    }

    game.resources.initResource(pid, "health");
    game.resources.initResource(pid, "maxHealth");
  }

  const deckZone = zones.find((z) => z.id === "deck");
  const discardZone = zones.find((z) => z.id === "discard");

  if (deckZone) {
    const allInstanceIds = (deck.instances ?? []).map((inst) => inst.instanceId);
    game.state.setGlobalZone("deck", {
      definition: deckZone,
      cards: allInstanceIds,
    });
  }

  if (discardZone) {
    game.state.setGlobalZone("discard", {
      definition: discardZone,
      cards: [],
    });
  }

  for (const pid of players) {
    game.state.updatePlayerHandCount(pid);
  }

  game.initPhases(phases);
  await game.start();

  const ui = new GameUI();
  await ui.init(appRoot, {
    playerName: playerNames[0],
    handCards: [],
    turn: 1,
    phase: "play",
    health: 4,
    maxHealth: 4,
  });

  ui.setInteractionCallback((action, cardIds) => {
    if (action === "play" && cardIds.length > 0) {
      const currentPlayerId = game.getState().currentTurn?.playerId ?? players[0];
      game.playCard(currentPlayerId, cardIds[0], []).catch((e) => {
        console.error("Play card failed:", e);
      });
    }

    if (action === "endTurn") {
      game.endTurn().catch((e) => {
        console.error("End turn failed:", e);
      });
    }
  });

  function updateGameState(): void {
    const state = game.getState();
    const pid = players[0];

    const handZone = state.players.get(pid)?.zones.get("hand");
    const handCardIds = handZone?.cards ?? [];
    const handCards = buildHandCards(allCards, handCardIds);

    const health = game.resources.getValue(pid, "health") ?? 4;
    const maxHealth = game.resources.getValue(pid, "maxHealth") ?? 4;
    const currentTurn = state.currentTurn;
    const phaseIndex = currentTurn?.phaseIndex ?? 0;
    const currentPhaseId = phases[phaseIndex % phases.length]?.id ?? "play";

    ui.update({
      playerName: playerNames[0],
      handCards,
      turn: state.turnNumber,
      phase: currentPhaseId,
      health,
      maxHealth,
    });
  }

  game.eventBus.on("*", () => {
    updateGameState();
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

  addButton("下一步", "#335566", () => {
    game.nextPhase().catch((e) => {
      console.error("Next phase failed:", e);
    });
  });

  updateGameState();
}

main().catch((err) => {
  console.error("Failed to initialize CardVerse UI:", err);
  const container = document.createElement("div");
  container.style.cssText = "color:#f44;padding:40px;font-family:Arial,sans-serif;";
  const heading = document.createElement("h2");
  heading.textContent = "CardVerse 启动失败";
  const message = document.createElement("p");
  message.textContent = err instanceof Error ? err.message : String(err);
  container.appendChild(heading);
  container.appendChild(message);
  document.body.innerHTML = "";
  document.body.appendChild(container);
});