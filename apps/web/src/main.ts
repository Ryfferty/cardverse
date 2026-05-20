import { GameUI } from "./GameUI.js";
import type { CardData } from "./CardView.js";
import type { HandCard } from "@cardverse/ai";
import { HeuristicAI } from "@cardverse/ai";
import { DeckLoader } from "@cardverse/deck";
import { Game } from "@cardverse/core";
import type { ZoneDefinition, PhaseDefinition, ResourceDefinition, PlayerId, CardInstanceId } from "@cardverse/shared";
import { ResponseDialog } from "./ResponseDialog.js";
import { DiscardDialog } from "./DiscardDialog.js";
import { GameLogPanel } from "./GameLogPanel.js";
import { GameOverScreen } from "./GameOverScreen.js";
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
      suit: (card as Record<string, unknown> | undefined)?.suit as string | undefined,
      number: (card as Record<string, unknown> | undefined)?.number as string | undefined,
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

  let step = 0;
  const log = (msg: string) => console.log(`[CardVerse init ${++step}] ${msg}`);

  const loadingDiv = document.createElement("div");
  loadingDiv.style.cssText = `
    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
    background: #0a0a1a; display: flex; flex-direction: column;
    align-items: center; justify-content: center; z-index: 9999;
    font-family: Arial, sans-serif; color: #e0d5c0;
  `;
  loadingDiv.innerHTML = `
    <div style="font-size: 24px; font-weight: bold; margin-bottom: 20px; color: #ffcc44;">
      CardVerse 三国杀
    </div>
    <div id="init-status" style="font-size: 14px; color: #aaa;">
      正在加载...
    </div>
  `;
  appRoot.appendChild(loadingDiv);

  function setStatus(msg: string): void {
    const el = document.getElementById("init-status");
    if (el) el.textContent = msg;
    log(msg);
  }

  setStatus("加载卡组数据...");
  const { deckJson, allCards } = await loadDeckData();
  setStatus("解析卡组...");

  const loader = new DeckLoader();
  const deck = loader.loadFromJson(deckJson);

  setStatus("创建游戏实例...");
  const game = Game.create({ deckId: deck.manifest.id, playerCount: 4, discardTimeoutMs: 30000 });

  const zones = (deckJson.rules as { zones: ZoneDefinition[] }).zones;
  const phases = (deckJson.rules as { phases: PhaseDefinition[] }).phases;
  const resources = (deckJson.rules as { resources: ResourceDefinition[] }).resources;

  setStatus("初始化区域...");
  game.initZones(zones);
  game.initResources(resources);
  game.setCardDefinitions(deck.cards);

  const playerNames = ["玩家", "AI-1", "AI-2", "AI-3"];
  const players: PlayerId[] = [];

  setStatus("创建玩家...");
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

  setStatus("初始化游戏阶段...");
  game.initPhases(phases);
  setStatus("启动游戏...");
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

  setStatus("初始化游戏界面...");
  const ui = new GameUI();
  try {
    await ui.init(appRoot, {
      playerName: playerNames[0],
      handCards: [],
      turn: 1,
      phase: "play",
      health: 4,
      maxHealth: 4,
    });
  } catch (uiError) {
    console.error("GameUI init failed:", uiError);
    setStatus("游戏界面初始化失败: " + (uiError instanceof Error ? uiError.message : String(uiError)));
    return;
  }

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

            if (action.type === "discard" && action.data) {
              const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
              if (discardAll) {
                await game.selectDiscardCards(aiPlayerId, discardAll);
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

  async function getNextPlayer(currentPlayerId: PlayerId | undefined): Promise<PlayerId | undefined> {
    const alivePlayers = getAlivePlayers();
    if (alivePlayers.length === 0) return undefined;
    
    if (!currentPlayerId) {
      return alivePlayers[0];
    }

    const currentIndex = game.getPlayerSeatIndex(currentPlayerId);
    if (currentIndex < 0) return alivePlayers[0];

    const allPlayers = Array.from(game.getState().players.keys());
    for (let offset = 1; offset < allPlayers.length; offset++) {
      const nextIndex = (currentIndex + offset) % allPlayers.length;
      const nextPlayerId = allPlayers[nextIndex];
      if (alivePlayers.includes(nextPlayerId)) {
        return nextPlayerId;
      }
    }

    return undefined;
  }

  async function startNextTurnIfAI(): Promise<void> {
    if (runningAI) return;

    const alivePlayers = getAlivePlayers();
    if (alivePlayers.length <= 1) return;

    let currentTurnPlayer = game.getState().currentTurn?.playerId;

    if (!currentTurnPlayer) {
      currentTurnPlayer = await getNextPlayer(undefined);
      if (!currentTurnPlayer) return;
      
      await game.startTurn(currentTurnPlayer);
    }

    currentTurnPlayer = game.getState().currentTurn?.playerId;
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

    const nextPlayer = await getNextPlayer(currentTurnPlayer);
    if (nextPlayer && getAlivePlayers().includes(nextPlayer)) {
      if (nextPlayer === getHumanPlayerId()) {
        isHumanTurn = true;
        updateGameUI();
      } else {
        setTimeout(() => {
          startNextTurnIfAI().catch(console.error);
        }, 500);
      }
    }
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

  const gameLogPanel = new GameLogPanel();
  gameLogPanel.mount(appRoot);

  game.eventBus.on("*", async (event) => {
    updateGameUI();
    gameLogPanel.addEvent(event);

    if (event.type === "turn:start" && event.source) {
      const turnNum = game.getState().turnNumber;
      gameLogPanel.setTurn(turnNum);
    }

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

    if (event.type === "discard:phase" && event.data) {
      const discardPlayerId = event.data.playerId as string | undefined;
      const humanPid = getHumanPlayerId();

      if (discardPlayerId === humanPid) {
        const excess = event.data.excess as number;
        const handCardIds = getAiHandCards(humanPid);
        const handCards = buildHandCards(allCards, handCardIds);

        const dialog = new DiscardDialog();
        const selected = await dialog.prompt({
          title: "弃牌阶段",
          message: `你需要弃 ${excess} 张牌`,
          availableCards: handCards,
          discardCount: excess,
          timeout: 30000,
        });

        if (selected && selected.length === excess) {
          await game.selectDiscardCards(humanPid, selected);
        }
        updateGameUI();
      }
    }

    if (event.type === "game:end" && event.data) {
      const gameOverScreen = new GameOverScreen();
      const state = game.getState();
      const eventLog = game.getEventLog();

      const players: Array<{
        playerId: PlayerId;
        name: string;
        role: string;
        alive: boolean;
      }> = [];

      for (const [pid, p] of state.players) {
        const role = game.getPlayerRole(pid) ?? "unknown";
        players.push({
          playerId: pid,
          name: p.name,
          role,
          alive: p.status === "alive",
        });
      }

      const cardsPlayed = eventLog.filter((e) => e.type === "card:played").length;
      const damageEvents = eventLog.filter((e) => e.type === "damage:dealt" || e.type === "damage:taken");
      const damageDealt = damageEvents.reduce((sum, e) => sum + ((e.data.amount as number) ?? 1), 0);

      gameOverScreen.onRestart = () => {
        window.location.reload();
      };
      gameOverScreen.onShowLog = () => {
        const logPanel = document.getElementById("game-log-panel");
        if (logPanel) {
          logPanel.style.display = logPanel.style.display === "none" ? "block" : "none";
        }
      };

      gameOverScreen.show({
        winner: (event.data.winner as string) ?? "unknown",
        condition: (event.data.condition as string) ?? "",
        players,
        stats: {
          turnCount: state.turnNumber,
          cardsPlayed,
          damageDealt,
        },
      });
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

  setStatus("开始发牌...");
  for (const pid of players) {
    try {
      await game.drawCards(pid, 4);
    } catch (e) {
      console.warn("Initial deal failed for", pid, ":", e instanceof Error ? e.message : String(e));
    }
  }

  updateGameUI();

  if (loadingDiv.parentNode) loadingDiv.remove();

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