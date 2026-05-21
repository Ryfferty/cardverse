import { GameUI } from "./GameUI.js";
import type { CardData } from "./CardView.js";
import type { HandCard } from "@cardverse/ai";
import { HeuristicAI } from "@cardverse/ai";
import { DeckLoader } from "@cardverse/deck";
import { Game } from "@cardverse/core";
import type {
  ZoneDefinition,
  PhaseDefinition,
  ResourceDefinition,
  PlayerId,
  CardInstanceId,
} from "@cardverse/shared";
import { ResponseDialog } from "./ResponseDialog.js";
import { DiscardDialog } from "./DiscardDialog.js";
import { GameLogPanel } from "./GameLogPanel.js";
import { GameOverScreen } from "./GameOverScreen.js";
import { OpponentPanel, type OpponentInfo } from "./OpponentPanel.js";

interface DeckCard {
  id: string;
  name: string;
  category: string;
  suit?: string;
  number?: string;
}

interface LoadedDeckData {
  deckJson: Record<string, unknown>;
  allCards: DeckCard[];
  deckId: string;
  manifest: Record<string, unknown>;
}

export class GameLauncher {
  private deckId: string;
  private game!: Game;
  private ui!: GameUI;
  private allCards: DeckCard[] = [];
  private players: PlayerId[] = [];
  private playerNames: string[] = [];
  private aiPlayers: Map<PlayerId, HeuristicAI> = new Map();
  private isHumanTurn = false;
  private runningAI = false;
  private opponentPanel!: OpponentPanel;
  private gameLogPanel!: GameLogPanel;
  private phases: PhaseDefinition[] = [];
  private appRoot!: HTMLElement;
  private manifest!: Record<string, unknown>;

  constructor(deckId: string) {
    this.deckId = deckId;
  }

  async start(): Promise<void> {
    const appRoot = document.getElementById("app");
    if (!appRoot) {
      document.body.innerHTML = '<div id="app" style="width:100%;height:100%;"></div>';
      return;
    }
    this.appRoot = appRoot;

    console.log(`[GameLauncher] Loading deck: ${this.deckId}`);

    const loaded = await this.loadDeckData();
    this.allCards = loaded.allCards;
    this.manifest = loaded.manifest;

    const loader = new DeckLoader();
    const deck = loader.loadFromJson(loaded.deckJson);

    const playerCount = this.resolvePlayerCount(loaded.manifest);
    console.log(`[GameLauncher] Player count: ${playerCount}`);

    this.game = Game.create({ deckId: deck.manifest.id, playerCount });

    const rules = loaded.deckJson.rules as Record<string, unknown>;
    const zones = rules.zones as ZoneDefinition[];
    const phases = rules.phases as PhaseDefinition[];
    const resources = rules.resources as ResourceDefinition[];
    this.phases = phases;

    this.game.initZones(zones);
    this.game.initResources(resources);
    this.game.setCardDefinitions(deck.cards);

    this.playerNames = [];
    for (let i = 0; i < playerCount; i++) {
      const pid: PlayerId = `player_${i}`;
      this.players.push(pid);
      const name = i === 0 ? "\u73A9\u5BB6" : `AI-${i}`;
      this.playerNames.push(name);
      this.game.addPlayer(pid, name);

      this.game.initPlayerZones(pid, zones.filter((z) => z.owner === "player"));

      for (const zone of zones.filter((z) => z.owner === "player")) {
        this.game.state.setPlayerZone(pid, zone.id, {
          definition: zone,
          cards: [],
          playerId: pid,
        });
      }

      for (const res of resources) {
        this.game.resources.initResource(pid, res.id);
      }
    }

    const deckZone = zones.find((z) => z.id === "deck");
    const discardZone = zones.find((z) => z.id === "discard");

    if (deckZone) {
      const allInstanceIds = (deck.instances ?? []).map(
        (inst: { instanceId: string }) => inst.instanceId
      );
      this.game.state.setGlobalZone("deck", {
        definition: deckZone,
        cards: allInstanceIds,
      });
    }

    if (discardZone) {
      this.game.state.setGlobalZone("discard", {
        definition: discardZone,
        cards: [],
      });
    }

    for (const pid of this.players) {
      this.game.state.updatePlayerHandCount(pid);
    }

    this.game.initPhases(phases);
    await this.game.start();

    const hasRoles = this.rulesHaveIdentities(rules);
    if (hasRoles) {
      const roleAssignments = this.game.assignRoles();
      const roleNameMap: Record<string, string> = {
        lord: "\u4E3B\u516C",
        loyalist: "\u5FE0\u81E3",
        rebel: "\u53CD\u8D3C",
        spy: "\u5185\u5978",
      };

      for (const assignment of roleAssignments) {
        const idx = parseInt(assignment.playerId.split("_")[1]);
        if (!isNaN(idx)) {
          const suffix = idx === 0 ? "\uFF08\u4F60\uFF09" : "\uFF08AI\uFF09";
          this.playerNames[idx] = `${roleNameMap[assignment.role] ?? assignment.role}${suffix}`;
          const player = this.game.getState().players.get(assignment.playerId);
          if (player) {
            player.name = this.playerNames[idx];
          }
        }
      }
    }

    const humanPid = this.getHumanPlayerId();
    const primaryResource = this.resolvePrimaryResource(resources);
    const healthValue = this.game.resources.getValue(humanPid, primaryResource) ?? 0;
    const maxHealthValue = this.game.resources.getValue(humanPid, "maxHealth")
      ?? this.game.resources.getValue(humanPid, "chips")
      ?? healthValue;

    this.ui = new GameUI();
    await this.ui.init(appRoot, {
      playerName: this.playerNames[0],
      handCards: [],
      turn: 1,
      phase: "play",
      health: healthValue,
      maxHealth: maxHealthValue,
    });

    for (let i = 1; i < playerCount; i++) {
      this.aiPlayers.set(
        this.players[i],
        new HeuristicAI(`AI_${this.playerNames[i]}`)
      );
    }

    this.opponentPanel = new OpponentPanel();
    this.opponentPanel.mount(appRoot);

    this.setupInteractionCallback();
    this.setupEventHandlers();
    this.setupActionButtons();

    const initialHandSize = this.getInitialHandSize(loaded.manifest);
    for (const pid of this.players) {
      try {
        await this.game.drawCards(pid, initialHandSize);
      } catch (e) {
        console.warn(
          "Initial deal failed for",
          pid,
          ":",
          e instanceof Error ? e.message : String(e)
        );
      }
    }

    this.updateGameUI();

    console.log(`[GameLauncher] Game initialized. Starting first turn...`);

    setTimeout(() => {
      this.startFirstTurn();
    }, 1000);
  }

  private async loadDeckData(): Promise<LoadedDeckData> {
    const deckPath = `/${this.deckId}`;

    const manifestResp = await fetch(`${deckPath}/manifest.json`);
    if (!manifestResp.ok) {
      throw new Error(`Failed to fetch manifest for deck "${this.deckId}": ${manifestResp.status}`);
    }
    const manifest = (await manifestResp.json()) as Record<string, unknown>;

    let rules: Record<string, unknown>;
    const rulesField = manifest.rules as Record<string, unknown> | undefined;
    if (rulesField?.source) {
      const rulesResp = await fetch(`${deckPath}/${rulesField.source}`);
      rules = (await rulesResp.json()) as Record<string, unknown>;
    } else if (rulesField?.zones) {
      rules = rulesField;
    } else {
      throw new Error(`Deck "${this.deckId}" has no rules defined`);
    }

    const allCards: DeckCard[] = [];
    const cardPacks = manifest.cardPacks as Array<{ type: string; source: string }> | undefined;
    if (Array.isArray(cardPacks)) {
      for (const pack of cardPacks) {
        try {
          const packResp = await fetch(`${deckPath}/${pack.source}`);
          if (!packResp.ok) {
            console.warn(`Card pack "${pack.source}" not found for deck "${this.deckId}"`);
            continue;
          }
          const packData = (await packResp.json()) as Record<string, unknown>;
          const cards = packData.cards as DeckCard[] | undefined;
          if (Array.isArray(cards)) {
            allCards.push(...cards);
          }
        } catch (e) {
          console.warn(`Failed to load card pack "${pack.source}":`, e);
        }
      }
    }

    let characters: unknown[] = [];
    const characterPack = manifest.characterPack as { source: string } | undefined;
    if (characterPack?.source) {
      try {
        const charResp = await fetch(`${deckPath}/${characterPack.source}`);
        if (charResp.ok) {
          const charData = (await charResp.json()) as Record<string, unknown>;
          characters = (charData.characters as unknown[]) ?? [];
        }
      } catch (e) {
        console.warn(`Failed to load characters for deck "${this.deckId}":`, e);
      }
    }

    const manifestSection = manifest.manifest as Record<string, unknown>;

    const deckJson: Record<string, unknown> = {
      manifest: manifestSection,
      rules: {
        zones: rules.zones,
        phases: rules.phases,
        resources: rules.resources,
        turnOrder: (rules.turnOrder as string) ?? "clockwise",
        identities: rules.identities,
        gameFlow: rules.gameFlow,
      },
      cards: allCards,
      characters,
      winConditions: manifest.winConditions,
      drawConditions: manifest.drawConditions,
    };

    return { deckJson, allCards, deckId: this.deckId, manifest };
  }

  private resolvePlayerCount(manifest: Record<string, unknown>): number {
    const m = manifest.manifest as Record<string, unknown> | undefined;
    if (!m) return 4;
    const max = Number(m.maxPlayers ?? 8);
    const min = Number(m.minPlayers ?? 2);
    return Math.min(Math.max(4, min), max);
  }

  private rulesHaveIdentities(rules: Record<string, unknown>): boolean {
    const identities = rules.identities;
    return Array.isArray(identities) && identities.length > 0;
  }

  private resolvePrimaryResource(resources: ResourceDefinition[]): string {
    if (resources.some((r) => r.id === "health")) return "health";
    if (resources.some((r) => r.id === "chips")) return "chips";
    return resources[0]?.id ?? "health";
  }

  private getInitialHandSize(manifest: Record<string, unknown>): number {
    const rulesField = manifest.rules as Record<string, unknown> | undefined;
    const gameFlow = (rulesField as Record<string, unknown>)?.gameFlow as Record<string, unknown> | undefined;
    if (gameFlow?.setup) {
      const setup = gameFlow.setup as Record<string, unknown>;
      if (typeof setup.initialHandSize === "number") {
        return setup.initialHandSize;
      }
    }
    return 4;
  }

  private getHumanPlayerId(): PlayerId {
    return this.players[0];
  }

  private buildHandCards(instanceIds: string[]): CardData[] {
    return instanceIds.map((iid) => {
      const parts = iid.split("_");
      const defId = parts.length >= 2 ? parts[1] : iid;
      const card = this.allCards.find((c) => c.id === defId);
      const category = card?.category ?? "basic";
      return {
        id: iid,
        name: card?.name ?? defId,
        category,
        type:
          category === "basic"
            ? defId
            : category === "equipment"
              ? "equipment"
              : "trick",
        suit: card?.suit,
        number: card?.number,
      };
    });
  }

  private buildAIHandCards(instanceIds: string[]): HandCard[] {
    return instanceIds.map((iid) => {
      const parts = iid.split("_");
      const defId = parts.length >= 2 ? parts[1] : iid;
      const card = this.allCards.find((c) => c.id === defId);
      const category = card?.category ?? "basic";
      return {
        instanceId: iid,
        name: card?.name ?? defId,
        category,
        type:
          category === "basic"
            ? defId
            : category === "equipment"
              ? "equipment"
              : "trick",
      };
    });
  }

  private getAlivePlayers(): PlayerId[] {
    const state = this.game.getState();
    return Array.from(state.players.values())
      .filter((p) => p.status === "alive")
      .map((p) => p.id);
  }

  private getPlayerHandCards(pid: PlayerId): CardInstanceId[] {
    const state = this.game.getState();
    const handZone = state.players.get(pid)?.zones.get("hand");
    return handZone?.cards ?? [];
  }

  private removeCardFromHand(pid: PlayerId, cardId: CardInstanceId): void {
    this.game.discardCard(pid, cardId).catch((e) => {
      console.warn("discardCard failed:", e instanceof Error ? e.message : String(e));
    });
  }

  private updateGameUI(): void {
    const state = this.game.getState();
    const pid = this.getHumanPlayerId();

    const handZone = state.players.get(pid)?.zones.get("hand");
    const handCardIds = handZone?.cards ?? [];
    const handCards = this.buildHandCards(handCardIds);

    const health = this.game.resources.getValue(pid, "health") ?? this.game.resources.getValue(pid, "chips") ?? 0;
    const maxHealth = this.game.resources.getValue(pid, "maxHealth") ?? this.game.resources.getValue(pid, "chips") ?? health;
    const currentTurn = state.currentTurn;
    const phaseIndex = currentTurn?.phaseIndex ?? 0;
    const currentPhaseId = this.phases[phaseIndex % this.phases.length]?.id ?? "play";

    this.ui.update({
      playerName: this.playerNames[0],
      handCards,
      turn: state.turnNumber,
      phase: currentPhaseId,
      health,
      maxHealth,
    });

    const opponents: OpponentInfo[] = [];
    const currentTurnPlayer = state.currentTurn?.playerId;

    for (const opid of this.players) {
      if (opid === this.getHumanPlayerId()) continue;
      const p = state.players.get(opid);
      if (!p) continue;

      const hp = this.game.resources.getValue(opid, "health") ?? this.game.resources.getValue(opid, "chips") ?? 0;
      const mhp = this.game.resources.getValue(opid, "maxHealth") ?? this.game.resources.getValue(opid, "chips") ?? hp;
      const equipCardIds = this.game.getEquipmentCards(opid);
      const equipNames = equipCardIds.map((eid) => {
        const parts = eid.split("_");
        const defId = parts.length >= 2 ? parts[1] : eid;
        const cardDef = this.allCards.find((c) => c.id === defId);
        return cardDef?.name ?? defId;
      });

      const roleAssignment = this.game.getRoleAssignment(opid);

      opponents.push({
        playerId: opid,
        name: this.playerNames[parseInt(opid.split("_")[1])] ?? opid,
        health: hp,
        maxHealth: mhp,
        handCount: this.getPlayerHandCards(opid).length,
        isCurrentTurn: opid === currentTurnPlayer,
        seatIndex: this.game.getPlayerSeatIndex(opid),
        isAlive: p.status === "alive",
        equipment: equipNames,
        role: roleAssignment?.role,
        roleRevealed: roleAssignment?.revealed ?? false,
      });
    }
    this.opponentPanel.render(opponents);
  }

  private async buildAIGameView(
    aiPlayerId: PlayerId,
    isHuman: boolean
  ): Promise<{
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
    const state = this.game.getState();
    const alivePlayers = this.getAlivePlayers();
    const playerCount = state.players.size;

    const viewPlayers = alivePlayers.map((pid) => {
      const p = state.players.get(pid)!;
      const handZone = p.zones.get("hand");

      let faction: string;
      if (pid === aiPlayerId) {
        faction = "self";
      } else if (isHuman && pid === this.getHumanPlayerId()) {
        faction = "human";
      } else {
        const role = this.game.getPlayerRole(pid);
        const aiRole = this.game.getPlayerRole(aiPlayerId);
        if (role && aiRole) {
          if (role === aiRole) {
            faction = "shu";
          } else if (
            (role === "lord" || role === "loyalist") &&
            (aiRole === "lord" || aiRole === "loyalist")
          ) {
            faction = "shu";
          } else {
            faction = "wei";
          }
        } else {
          faction = "neutral";
        }
      }

      return {
        playerId: p.id,
        handCardIds: handZone?.cards ?? [],
        handCount: p.handCount,
        health: this.game.resources.getValue(p.id, "health") ?? this.game.resources.getValue(p.id, "chips") ?? 0,
        maxHealth: this.game.resources.getValue(p.id, "maxHealth") ?? this.game.resources.getValue(p.id, "chips") ?? 0,
        faction,
        alive: p.status === "alive",
        seatIndex: this.game.getPlayerSeatIndex(pid),
      };
    });

    const phaseIndex = state.currentTurn?.phaseIndex ?? 0;
    const currentPhaseId = this.phases[phaseIndex % this.phases.length]?.id ?? "play";

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

  private async runAITurn(aiPlayerId: PlayerId): Promise<void> {
    this.runningAI = true;
    const ai = this.aiPlayers.get(aiPlayerId);
    if (!ai) {
      this.runningAI = false;
      return;
    }

    try {
      const currentPlayerId = this.game.getState().currentTurn?.playerId;
      if (currentPlayerId !== aiPlayerId) return;

      await this.game.startTurn(aiPlayerId);

      while (!this.game.phases.isTurnComplete()) {
        const phase = this.game.phases.getCurrentPhase();

        if (phase && !phase.auto) {
          const gameView = await this.buildAIGameView(aiPlayerId, false);
          const handCardIds = this.getPlayerHandCards(aiPlayerId);
          ai.setHandCards(this.buildAIHandCards(handCardIds));

          let actions = 0;
          const maxActions = 20;

          while (actions < maxActions) {
            const action = await ai.decideAction(gameView);

            if (action.type === "endTurn" || action.type === "pass") break;

            if (action.type === "playCard" && action.cardId) {
              this.removeCardFromHand(aiPlayerId, action.cardId);
              try {
                await this.game.playCard(aiPlayerId, action.cardId, action.targets);
              } catch (e) {
                console.warn("AI playCard failed:", e instanceof Error ? e.message : String(e));
              }
            }

            if (action.type === "discard" && action.data) {
              const discardAll = (action.data as Record<string, unknown>)
                .discardAll as string[] | undefined;
              if (discardAll) {
                await this.game.selectDiscardCards(aiPlayerId, discardAll);
              }
              break;
            }

            const newHandCards = this.getPlayerHandCards(aiPlayerId);
            ai.setHandCards(this.buildAIHandCards(newHandCards));
            actions++;
          }
        }

        await this.game.nextPhase();
      }

      await this.game.endTurn();
    } finally {
      this.runningAI = false;
    }
  }

  private getNextPlayer(currentPid: PlayerId): PlayerId | null {
    const alivePlayers = this.getAlivePlayers();
    if (alivePlayers.length <= 1) return null;

    const currentIdx = alivePlayers.indexOf(currentPid);
    if (currentIdx < 0) return alivePlayers[0] ?? null;

    const nextIdx = (currentIdx + 1) % alivePlayers.length;
    return alivePlayers[nextIdx];
  }

  private async advanceToNextTurn(): Promise<void> {
    const currentTurnInfo = this.game.phases.getTurnInfo();
    const currentPid = currentTurnInfo?.playerId;
    if (!currentPid) return;

    const nextPid = this.getNextPlayer(currentPid);
    if (!nextPid) return;

    if (nextPid === this.getHumanPlayerId()) {
      await this.game.startTurn(nextPid);
      this.isHumanTurn = true;
      this.updateGameUI();
    } else {
      this.isHumanTurn = false;
      this.updateGameUI();
      this.ui.clearSelection();

      await this.runAITurn(nextPid);
      this.updateGameUI();

      setTimeout(() => {
        this.advanceToNextTurn().catch(console.error);
      }, 500);
    }
  }

  private startFirstTurn(): void {
    const firstPid = this.players[0];
    this.game
      .startTurn(firstPid)
      .then(() => {
        this.isHumanTurn = true;
        this.updateGameUI();
        console.log(`[GameLauncher] First turn started for ${firstPid}`);
      })
      .catch((e) => {
        console.error("Failed to start first turn:", e);
      });
  }

  private setupInteractionCallback(): void {
    this.ui.setInteractionCallback((action, cardIds) => {
      if (!this.isHumanTurn) return;

      if (action === "play" && cardIds.length > 0) {
        const humanPid = this.getHumanPlayerId();
        const currentPlayerId = this.game.getState().currentTurn?.playerId;
        if (currentPlayerId !== humanPid) return;

        const alivePlayers = this.getAlivePlayers();
        const targets = alivePlayers.filter((p) => p !== humanPid).slice(0, 1);

        this.removeCardFromHand(humanPid, cardIds[0]);

        this.game.playCard(humanPid, cardIds[0], targets).catch((e) => {
          console.error("Play card failed:", e);
        });

        this.updateGameUI();
      }

      if (action === "endTurn") {
        const humanPid = this.getHumanPlayerId();
        const currentPlayerId = this.game.getState().currentTurn?.playerId;
        if (currentPlayerId !== humanPid) return;

        this.game
          .endTurn()
          .then(() => {
            this.isHumanTurn = false;
            this.updateGameUI();
            this.advanceToNextTurn().catch(console.error);
          })
          .catch((e) => {
            console.error("End turn failed:", e);
          });
      }
    });
  }

  private setupEventHandlers(): void {
    this.gameLogPanel = new GameLogPanel();
    this.gameLogPanel.mount(this.appRoot);

    this.game.eventBus.on("*", async (event) => {
      this.updateGameUI();
      this.gameLogPanel.addEvent(event);

      if (event.type === "turn:start" && event.source) {
        const turnNum = this.game.getState().turnNumber;
        this.gameLogPanel.setTurn(turnNum);
      }

      if (event.type === "card:played" && event.data) {
        await this.handleCardPlayedEvent(event);
      }

      if (event.type === "discard:phase" && event.data) {
        await this.handleDiscardPhaseEvent(event);
      }

      if (event.type === "game:end" && event.data) {
        this.handleGameEndEvent(event);
      }
    });
  }

  private async handleCardPlayedEvent(event: Record<string, unknown>): Promise<void> {
    const data = event.data as Record<string, unknown>;
    const cardType = data.cardType as string | undefined;
    const humanPid = this.getHumanPlayerId();

    const targets = data.targets as string[] | undefined;
    const isTargetingHuman = targets?.includes(humanPid) ?? false;

    if (cardType === "sha" && isTargetingHuman) {
      await this.promptResponse(
        "\u9700\u8981\u6253\u51FA\u3010\u95EA\u3011",
        `${event.source} \u5BF9\u4F60\u4F7F\u7528\u4E86\u3010\u6740\u3011\uFF0C\u662F\u5426\u6253\u51FA\u3010\u95EA\u3011\uFF1F`,
        "shan"
      );
    }

    if (cardType === "wanjian" && isTargetingHuman) {
      await this.promptResponse(
        "\u4E07\u7BAD\u9F50\u53D1\uFF01",
        `${event.source} \u4F7F\u7528\u4E86\u4E07\u7BAD\u9F50\u53D1\uFF0C\u662F\u5426\u6253\u51FA\u3010\u95EA\u3011\uFF1F`,
        "shan"
      );
    }

    if (cardType === "nanman" && isTargetingHuman) {
      await this.promptResponse(
        "\u5357\u86EE\u5165\u4FB5\uFF01",
        `${event.source} \u4F7F\u7528\u4E86\u5357\u86EE\u5165\u4FB5\uFF0C\u662F\u5426\u6253\u51FA\u3010\u6740\u3011\uFF1F`,
        "sha"
      );
    }

    if (cardType === "juedou" && isTargetingHuman) {
      await this.promptResponse(
        "\u51B3\u6597\uFF01",
        `${event.source} \u5BF9\u4F60\u4F7F\u7528\u4E86\u3010\u51B3\u6597\u3011\uFF0C\u662F\u5426\u6253\u51FA\u3010\u6740\u3011\uFF1F`,
        "sha"
      );
    }
  }

  private async promptResponse(
    title: string,
    message: string,
    cardType: string
  ): Promise<void> {
    await new Promise((r) => setTimeout(r, 300));

    const humanPid = this.getHumanPlayerId();
    const handCardIds = this.getPlayerHandCards(humanPid);
    const responseCards = this.buildHandCards(handCardIds).filter(
      (c) => c.type === cardType || c.id.includes(`_${cardType}_`)
    );

    const dialog = new ResponseDialog();
    const result = await dialog.prompt({
      title,
      message,
      availableCards: responseCards,
      timeout: 30000,
    });

    if (result && result.choice === "play" && result.cardId) {
      this.removeCardFromHand(humanPid, result.cardId);
      await this.game.respondToEvent(
        result.eventId ?? "",
        {
          playerId: humanPid,
          action: "play",
          cardId: result.cardId,
        }
      );
    } else {
      const eventId = (dialog as unknown as { lastEventId?: string }).lastEventId ?? "";
      await this.game.respondToEvent(eventId, {
        playerId: humanPid,
        action: "pass",
      });
    }
    this.updateGameUI();
  }

  private async handleDiscardPhaseEvent(event: Record<string, unknown>): Promise<void> {
    const data = event.data as Record<string, unknown>;
    const discardPlayerId = data.playerId as string | undefined;
    const humanPid = this.getHumanPlayerId();

    if (discardPlayerId === humanPid) {
      const excess = data.excess as number;
      const handCardIds = this.getPlayerHandCards(humanPid);
      const handCards = this.buildHandCards(handCardIds);

      const dialog = new DiscardDialog();
      const selected = await dialog.prompt({
        title: "\u5F03\u724C\u9636\u6BB5",
        message: `\u4F60\u9700\u8981\u5F03 ${excess} \u5F20\u724C`,
        availableCards: handCards,
        discardCount: excess,
        timeout: 30000,
      });

      if (selected && selected.length === excess) {
        await this.game.selectDiscardCards(humanPid, selected);
      }
      this.updateGameUI();
    }
  }

  private handleGameEndEvent(event: Record<string, unknown>): void {
    const data = event.data as Record<string, unknown>;
    const gameOverScreen = new GameOverScreen();
    const state = this.game.getState();
    const eventLog = this.game.getEventLog();

    const players: Array<{
      playerId: PlayerId;
      name: string;
      role: string;
      alive: boolean;
    }> = [];

    for (const [pid, p] of state.players) {
      const role = this.game.getPlayerRole(pid) ?? "unknown";
      players.push({
        playerId: pid,
        name: p.name,
        role,
        alive: p.status === "alive",
      });
    }

    const cardsPlayed = eventLog.filter((e) => e.type === "card:played").length;
    const damageEvents = eventLog.filter(
      (e) => e.type === "damage:dealt" || e.type === "damage:taken"
    );
    const damageDealt = damageEvents.reduce(
      (sum, e) => sum + ((e.data.amount as number) ?? 1),
      0
    );

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
      winner: (data.winner as string) ?? "unknown",
      condition: (data.condition as string) ?? "",
      players,
      stats: {
        turnCount: state.turnNumber,
        cardsPlayed,
        damageDealt,
      },
    });
  }

  private setupActionButtons(): void {
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
    this.appRoot.style.position = "relative";
    this.appRoot.appendChild(actionBtn);

    const addButton = (text: string, bg: string, action: () => void): void => {
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
    };

    addButton("\u51FA\u724C", "#cc4444", () => {
      const selected = this.ui.getSelectedCardIds();
      if (selected.length > 0) {
        this.ui.notifyAction("play", selected);
      }
    });

    addButton("\u53D6\u6D88", "#444444", () => {
      this.ui.clearSelection();
    });

    addButton("\u7ED3\u675F\u56DE\u5408", "#336644", () => {
      this.ui.notifyAction("endTurn", []);
    });

    addButton("\u4E0B\u4E00\u6B65", "#335566", () => {
      this.game.nextPhase().catch((e) => {
        console.error("Next phase failed:", e);
      });
      this.updateGameUI();
    });
  }
}
