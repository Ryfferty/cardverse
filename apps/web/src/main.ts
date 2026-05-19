import { GameUI } from "./GameUI.js";
import type { CardData } from "./CardView.js";
import type { HandCard } from "@cardverse/ai";
import { HeuristicAI } from "@cardverse/ai";
import { DeckLoader } from "@cardverse/deck";
import { Game } from "@cardverse/core";
import type { ZoneDefinition, PhaseDefinition, ResourceDefinition, PlayerId, CardInstanceId } from "@cardverse/shared";
import { ResponseDialog } from "./ResponseDialog.js";
import { OpponentPanel, type OpponentInfo } from "./OpponentPanel.js";

interface DeckCard {
  id: string;
  name: string;
  category: string;
}

async function loadDeckData(): Promise<{
  deckJson: Record<string, unknown>;
  allCards: DeckCard[];
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
  };
}

function buildHandCards(allCards: DeckCard[], instanceIds: string[]): CardData[] {
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

function buildAIHandCards(allCards: DeckCard[], instanceIds: string[]): HandCard[] {
  return instanceIds.map((iid) => {
    const parts = iid.split("_");
    const defId = parts.length >= 2 ? parts[1] : iid;
    const card = allCards.find((c) => c.id === defId);
    const category = card?.category ?? "basic";
    return {
      instanceId: iid,
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
  game.setCardDefinitions(deck.cards);

  const playerNames = ["玩家", "AI-1", "AI-2", "AI-3"];
  const players: PlayerId[] = [];

  for (let i = 0; i < 4; i++) {
    const pid = `player_${i}`;
    players.push(pid);
    game.addPlayer(pid, playerNames[i]);

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
    const allInstanceIds = (deck.instances ?? []).map((inst: { instanceId: string }) => inst.instanceId);
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
  const roleAssignments = game.assignRoles();

  const roleNameMap: Record<string, string> = {
    lord: "主公",
    loyalist: "忠臣",
    rebel: "反贼",
    spy: "内奸",
  };

  for (const assignment of roleAssignments) {
    const idx = parseInt(assignment.playerId.split("_")[1]);
    if (!isNaN(idx)) {
      const suffix = idx === 0 ? "（你）" : "（AI）";
      playerNames[idx] = `${roleNameMap[assignment.role] ?? assignment.role}${suffix}`;
      const player = game.getState().players.get(assignment.playerId);
      if (player) {
        player.name = playerNames[idx];
      }
    }
  }

  const ui = new GameUI();
  await ui.init(appRoot, {
    playerName: playerNames[0],
    handCards: [],
    turn: 1,
    phase: "play",
    health: 4,
    maxHealth: 4,
  });

  const aiPlayers = new Map<PlayerId, HeuristicAI>();
  for (let i = 1; i < 4; i++) {
    aiPlayers.set(players[i], new HeuristicAI(`AI_${playerNames[i]}`));
  }

  const opponentPanel = new OpponentPanel();
  opponentPanel.mount(appRoot);

  let isHumanTurn = true;
  let runningAI = false;

  function getHumanPlayerId(): PlayerId {
    return players[0];
  }

  function updateGameUI(): void {
    const state = game.getState();
    const pid = getHumanPlayerId();

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

    const opponents: OpponentInfo[] = [];
    const _alivePlayers = getAlivePlayers();
    const currentTurnPlayer = state.currentTurn?.playerId;
    for (const pid of players) {
      if (pid === getHumanPlayerId()) continue;
      const p = state.players.get(pid);
      if (!p) continue;
      const hp = game.resources.getValue(pid, "health") ?? 0;
      const mhp = game.resources.getValue(pid, "maxHealth") ?? 4;
      const equipCardIds = game.getEquipmentCards(pid);
      const equipNames = equipCardIds.map((eid) => {
        const parts = eid.split("_");
        const defId = parts.length >= 2 ? parts[1] : eid;
        const cardDef = allCards.find((c) => c.id === defId);
        return cardDef?.name ?? defId;
      });

      const roleAssignment = game.getRoleAssignment(pid);

      opponents.push({
        playerId: pid,
        name: playerNames[parseInt(pid.split("_")[1])] ?? pid,
        health: hp,
        maxHealth: mhp,
        handCount: getAiHandCards(pid).length,
        isCurrentTurn: pid === currentTurnPlayer,
        seatIndex: game.getPlayerSeatIndex(pid),
        isAlive: p.status === "alive",
        equipment: equipNames,
        role: roleAssignment?.role,
        roleRevealed: roleAssignment?.revealed ?? false,
      });
    }
    opponentPanel.render(opponents);
  }

  function getAlivePlayers(): PlayerId[] {
    const state = game.getState();
    return Array.from(state.players.values())
      .filter((p) => p.status === "alive")
      .map((p) => p.id);
  }

  async function _getPlayerRole(pid: PlayerId): Promise<string> {
    const role = game.getPlayerRole(pid);
    if (role === "lord" || role === "loyalist") return "shu";
    if (role === "rebel") return "wei";
    return "qun";
  }

  async function buildAIGameView(aiPlayerId: PlayerId, isHuman: boolean): Promise<{
    players: Array<{
      playerId: string;
      handCardIds: string[];
      handCount: number;
      health: number;
      maxHealth: number;
      faction: string;
      alive: boolean;
      seatIndex: number;
    }>;
    selfId: string;
    turnNumber: number;
    currentPhase: string;
    currentTurnPlayerId: string;
    pendingEvents: Array<unknown>;
    playerCount: number;
  }> {
    const state = game.getState();
    const alivePlayers = getAlivePlayers();
    const playerCount = state.players.size;

    const viewPlayers = alivePlayers.map((pid, _idx) => {
      const p = state.players.get(pid)!;
      const handZone = p.zones.get("hand");

      let faction: string;
      if (pid === aiPlayerId) {
        faction = "self";
      } else if (isHuman && pid === getHumanPlayerId()) {
        faction = "human";
      } else {
        const role = game.getPlayerRole(pid);
        const aiRole = game.getPlayerRole(aiPlayerId);
        if (role === aiRole) {
          faction = "shu";
        } else if (
          (role === "lord" || role === "loyalist") &&
          (aiRole === "lord" || aiRole === "loyalist")
        ) {
          faction = "shu";
        } else if (
          role === "lord" &&
          aiRole === "loyalist"
        ) {
          faction = "shu";
        } else {
          faction = "wei";
        }
      }

      return {
        playerId: p.id,
        handCardIds: handZone?.cards ?? [],
        handCount: p.handCount,
        health: game.resources.getValue(p.id, "health") ?? 0,
        maxHealth: game.resources.getValue(p.id, "maxHealth") ?? 4,
        faction,
        alive: p.status === "alive",
        seatIndex: game.getPlayerSeatIndex(pid),
      };
    });

    const phaseIndex = state.currentTurn?.phaseIndex ?? 0;
    const currentPhaseId = phases[phaseIndex % phases.length]?.id ?? "play";

    return {
      players: viewPlayers,
      selfId: aiPlayerId,
      turnNumber: state.turnNumber,
      currentPhase: currentPhaseId,
      currentTurnPlayerId: state.currentTurn?.playerId ?? "",
      pendingEvents: [],
      playerCount,
    };
  }

  function getAiHandCards(pid: PlayerId): CardInstanceId[] {
    const state = game.getState();
    const handZone = state.players.get(pid)?.zones.get("hand");
    return handZone?.cards ?? [];
  }

  function removeCardFromHand(pid: PlayerId, cardId: CardInstanceId): void {
    game.discardCard(pid, cardId).catch((e) => {
      console.warn("discardCard failed:", e instanceof Error ? e.message : String(e));
    });
  }

  async function runAITurn(aiPlayerId: PlayerId): Promise<void> {
    runningAI = true;
    const ai = aiPlayers.get(aiPlayerId)!;

    try {
      const currentPlayerId = game.getState().currentTurn?.playerId;
      if (currentPlayerId !== aiPlayerId) return;

      await game.startTurn(aiPlayerId);

      while (!game.phases.isTurnComplete()) {
        const phase = game.phases.getCurrentPhase();
        const _phaseId = phase?.id ?? "";

        if (phase && !phase.auto) {
          const gameView = await buildAIGameView(aiPlayerId, false);
          const handCardIds = getAiHandCards(aiPlayerId);
          ai.setHandCards(buildAIHandCards(allCards, handCardIds));

          let actions = 0;
          const maxActions = 20;

          while (actions < maxActions) {
            const action = await ai.decideAction(gameView);

            if (action.type === "endTurn" || action.type === "pass") break;

            if (action.type === "playCard" && action.cardId) {
              removeCardFromHand(aiPlayerId, action.cardId);
              try {
                await game.playCard(aiPlayerId, action.cardId, action.targets);
              } catch (e) {
                console.warn("AI playCard failed:", e instanceof Error ? e.message : String(e));
              }
            }

            if (action.type === "respond" && action.data) {
              const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
              if (discardAll) {
                for (const cardId of discardAll) {
                  removeCardFromHand(aiPlayerId, cardId);
                }
              }
              break;
            }

            const newHandCards = getAiHandCards(aiPlayerId);
            ai.setHandCards(buildAIHandCards(allCards, newHandCards));
            actions++;
          }
        }

        await game.nextPhase();
      }

      await game.endTurn();
    } finally {
      runningAI = false;
    }
  }

  async function startNextTurnIfAI(): Promise<void> {
    if (runningAI) return;

    const alivePlayers = getAlivePlayers();
    if (alivePlayers.length <= 1) return;

    const currentTurnPlayer = game.getState().currentTurn?.playerId;
    if (!currentTurnPlayer || !alivePlayers.includes(currentTurnPlayer)) {
      return;
    }

    if (currentTurnPlayer === getHumanPlayerId()) {
      isHumanTurn = true;
      updateGameUI();
      return;
    }

    isHumanTurn = false;
    updateGameUI();
    ui.clearSelection();

    await runAITurn(currentTurnPlayer);
    updateGameUI();

    setTimeout(() => {
      startNextTurnIfAI().catch(console.error);
    }, 500);
  }

  ui.setInteractionCallback((action, cardIds) => {
    if (!isHumanTurn) return;

    if (action === "play" && cardIds.length > 0) {
      const humanPid = getHumanPlayerId();
      const currentPlayerId = game.getState().currentTurn?.playerId;
      if (currentPlayerId !== humanPid) return;

      const alivePlayers = getAlivePlayers();
      const targets = alivePlayers.filter((p) => p !== humanPid).slice(0, 1);

      removeCardFromHand(humanPid, cardIds[0]);

      game.playCard(humanPid, cardIds[0], targets).catch((e) => {
        console.error("Play card failed:", e);
      });

      updateGameUI();
    }

    if (action === "endTurn") {
      const humanPid = getHumanPlayerId();
      const currentPlayerId = game.getState().currentTurn?.playerId;
      if (currentPlayerId !== humanPid) return;

      game.endTurn().then(() => {
        isHumanTurn = false;
        updateGameUI();
        startNextTurnIfAI().catch(console.error);
      }).catch((e) => {
        console.error("End turn failed:", e);
      });
    }
  });

  game.eventBus.on("*", async (event) => {
    updateGameUI();

    if (event.type === "card:played" && event.data) {
      const cardType = event.data.cardType as string | undefined;
      const humanPid = getHumanPlayerId();

      if (cardType === "sha") {
        const targets = event.data.targets as string[] | undefined;
        if (targets && targets.includes(humanPid)) {
          await new Promise((r) => setTimeout(r, 300));

          const handCardIds = getAiHandCards(humanPid);
          const shanCards = buildHandCards(allCards, handCardIds)
            .filter((c) => c.type === "shan" || c.id.includes("_shan_"));

          const dialog = new ResponseDialog();
          const result = await dialog.prompt({
            title: "需要打出【闪】",
            message: `${event.source} 对你使用了【杀】，是否打出【闪】？`,
            availableCards: shanCards,
            timeout: 30000,
          });

          if (result && result.choice === "play" && result.cardId) {
            removeCardFromHand(humanPid, result.cardId);
            await game.respondToEvent(event.id, {
              playerId: humanPid,
              action: "play",
              cardId: result.cardId,
            });
          } else {
            await game.respondToEvent(event.id, {
              playerId: humanPid,
              action: "pass",
            });
          }
          updateGameUI();
        }
      }

      if (cardType === "wanjian") {
        await new Promise((r) => setTimeout(r, 300));

        const handCardIds = getAiHandCards(humanPid);
        const shanCards = buildHandCards(allCards, handCardIds)
          .filter((c) => c.type === "shan" || c.id.includes("_shan_"));

        const dialog = new ResponseDialog();
        const result = await dialog.prompt({
          title: "万箭齐发！",
          message: `${event.source} 使用了万箭齐发，是否打出【闪】？`,
          availableCards: shanCards,
          timeout: 30000,
        });

        if (result && result.choice === "play" && result.cardId) {
          removeCardFromHand(humanPid, result.cardId);
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "play",
            cardId: result.cardId,
          });
        } else {
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "pass",
          });
        }
        updateGameUI();
      }

      if (cardType === "nanman") {
        await new Promise((r) => setTimeout(r, 300));

        const handCardIds = getAiHandCards(humanPid);
        const shaCards = buildHandCards(allCards, handCardIds)
          .filter((c) => c.type === "sha" || c.id.includes("_sha_"));

        const dialog = new ResponseDialog();
        const result = await dialog.prompt({
          title: "南蛮入侵！",
          message: `${event.source} 使用了南蛮入侵，是否打出【杀】？`,
          availableCards: shaCards,
          timeout: 30000,
        });

        if (result && result.choice === "play" && result.cardId) {
          removeCardFromHand(humanPid, result.cardId);
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "play",
            cardId: result.cardId,
          });
        } else {
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "pass",
          });
        }
        updateGameUI();
      }

      if (cardType === "juedou") {
        await new Promise((r) => setTimeout(r, 300));

        const handCardIds = getAiHandCards(humanPid);
        const shaCards = buildHandCards(allCards, handCardIds)
          .filter((c) => c.type === "sha" || c.id.includes("_sha_"));

        const dialog = new ResponseDialog();
        const result = await dialog.prompt({
          title: "决斗！",
          message: `${event.source} 对你使用了【决斗】，是否打出【杀】？`,
          availableCards: shaCards,
          timeout: 30000,
        });

        if (result && result.choice === "play" && result.cardId) {
          removeCardFromHand(humanPid, result.cardId);
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "play",
            cardId: result.cardId,
          });
        } else {
          await game.respondToEvent(event.id, {
            playerId: humanPid,
            action: "pass",
          });
        }
        updateGameUI();
      }
    }
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

  addButton("出牌", "#cc4444", () => {
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
    updateGameUI();
  });

  for (const pid of players) {
    try {
      await game.drawCards(pid, 4);
    } catch (e) {
      console.warn("Initial deal failed for", pid, ":", e instanceof Error ? e.message : String(e));
    }
  }

  updateGameUI();

  // Start the first turn
  setTimeout(() => {
    const currentTurnPlayer = game.getState().currentTurn?.playerId;
    if (currentTurnPlayer === getHumanPlayerId()) {
      isHumanTurn = true;
      updateGameUI();
    } else {
      startNextTurnIfAI().catch(console.error);
    }
  }, 1000);
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