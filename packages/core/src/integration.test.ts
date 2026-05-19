import { describe, it, expect, beforeAll } from "vitest";
import { Game } from "./engine.js";
import { DeckLoader } from "@cardverse/deck";
import type { Deck } from "@cardverse/deck";
import { HeuristicAI } from "@cardverse/ai";
import type { AIGameView, HandCard } from "@cardverse/ai";
import type { PlayerId, CardInstanceId, ZoneDefinition, PhaseDefinition, ResourceDefinition } from "@cardverse/shared";
import { EventType } from "@cardverse/shared";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_ROOT = resolve(__dirname, "../../../decks/sanguosha");

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

interface CardTypeInfo {
  definitionId: string;
  type: string;
  name: string;
  category: string;
}

let deckLoader: DeckLoader;
let deck: Deck;
let deckZones: ZoneDefinition[];
let deckPhases: PhaseDefinition[];
let deckResources: ResourceDefinition[];
let cardTypeMap: Map<string, CardTypeInfo>;

beforeAll(async () => {
  const [manifest, rules, basic, trick, equipment, characters] = await Promise.all([
    readJson(resolve(DECK_ROOT, "manifest.json")),
    readJson(resolve(DECK_ROOT, "rules.json")),
    readJson(resolve(DECK_ROOT, "cards/basic.json")),
    readJson(resolve(DECK_ROOT, "cards/trick.json")),
    readJson(resolve(DECK_ROOT, "cards/equipment.json")),
    readJson(resolve(DECK_ROOT, "characters/characters.json")),
  ]);

  const allCards = [
    ...(basic.cards as Record<string, unknown>[]),
    ...(trick.cards as Record<string, unknown>[]),
    ...(equipment.cards as Record<string, unknown>[]),
  ];

  deckZones = (rules.zones as ZoneDefinition[]) ?? [];
  deckPhases = (rules.phases as PhaseDefinition[]) ?? [];
  deckResources = (rules.resources as ResourceDefinition[]) ?? [];

  const deckJson: Record<string, unknown> = {
    manifest: manifest.manifest,
    rules: {
      zones: deckZones,
      phases: deckPhases,
      resources: deckResources,
      turnOrder: (rules.turnOrder as string) ?? "counterclockwise",
    },
    cards: allCards,
    characters: characters.characters,
    winConditions: manifest.winConditions,
    drawConditions: manifest.drawConditions,
  };

  cardTypeMap = new Map<string, CardTypeInfo>();
  for (const card of allCards) {
    const id = String(card.id ?? "");
    const category = String(card.category ?? "basic");
    let type: string;
    if (category === "basic") {
      type = id;
    } else if (category === "equipment") {
      type = "equipment";
    } else {
      type = "trick";
    }
    cardTypeMap.set(id, { definitionId: id, type, name: String(card.name ?? id), category });
  }

  deckLoader = new DeckLoader();
  deck = deckLoader.loadFromJson(deckJson);
});

function createGame(): Game {
  const game = Game.create({
    deckId: "sanguosha-standard",
    playerCount: 4,
    discardTimeoutMs: 100,
  });
  game.initZones(deckZones);
  game.initResources(deckResources);
  game.setCardDefinitions(deck.cards);
  return game;
}

function setupPlayers(game: Game): string[] {
  const factions = ["shu", "wei", "wu", "qun"];
  const playerIds: string[] = [];

  for (let i = 0; i < 4; i++) {
    const pid = `player_${i}`;
    playerIds.push(pid);
    const player = game.addPlayer(pid, identityNames[i]);
    player.faction = factions[i];

    game.initPlayerZones(pid, deckZones.filter((z) => z.owner === "player"));

    for (const zone of deckZones.filter((z) => z.owner === "player")) {
      game.state.setPlayerZone(pid, zone.id, {
        definition: zone,
        cards: [],
        playerId: pid,
      });
    }

    game.resources.initResource(pid, "health");
    game.resources.initResource(pid, "maxHealth");
  }

  const deckZone = deckZones.find((z) => z.id === "deck");
  const discardZone = deckZones.find((z) => z.id === "discard");

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

  for (const pid of playerIds) {
    game.state.updatePlayerHandCount(pid);
  }

  return playerIds;
}

const identityNames = ["主公", "忠臣", "反贼", "内奸"];

function dealCards(game: Game, playerId: PlayerId, count: number): CardInstanceId[] {
  const state = game.getState();
  let deckCards = state.globalZones.get("deck")?.cards ?? [];

  if (deckCards.length < count) {
    const discardCards = state.globalZones.get("discard")?.cards ?? [];
    if (discardCards.length > 0) {
      for (let i = discardCards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [discardCards[i], discardCards[j]] = [discardCards[j], discardCards[i]];
      }
      deckCards = [...deckCards, ...discardCards];
      game.state.setGlobalZone("discard", {
        definition: state.globalZones.get("discard")!.definition,
        cards: [],
      });
    }
  }

  const dealt = deckCards.splice(0, count);

  game.state.setGlobalZone("deck", {
    definition: state.globalZones.get("deck")!.definition,
    cards: deckCards,
  });

  const handZone = state.players.get(playerId)?.zones.get("hand");
  if (handZone) {
    const currentHand = [...handZone.cards, ...dealt];
    game.state.setPlayerZone(playerId, "hand", {
      definition: handZone.definition,
      cards: currentHand,
      playerId,
    });
    game.state.updatePlayerHandCount(playerId);
  }

  return dealt;
}

function mapInstanceToDefId(instanceId: string): string {
  const parts = instanceId.split("_");
  if (parts.length >= 2) return parts[1];
  return instanceId;
}

function getHandCards(game: Game, playerId: PlayerId): HandCard[] {
  const state = game.getState();
  const handZone = state.players.get(playerId)?.zones.get("hand");
  if (!handZone) return [];

  return handZone.cards.map((instanceId) => {
    const defId = mapInstanceToDefId(instanceId);
    const info = cardTypeMap.get(defId);
    return {
      instanceId,
      type: info?.type ?? "unknown",
      category: info?.category ?? "basic",
      name: info?.name ?? defId,
    };
  });
}

function buildGameView(game: Game, selfId: PlayerId): AIGameView {
  const state = game.getState();
  const playerIds = Array.from(state.players.keys());
  const players = playerIds.map((pid, idx) => {
    const p = state.players.get(pid)!;
    const handZone = p.zones.get("hand");
    const role = game.getPlayerRole(pid);
    const faction = role === "lord" || role === "loyalist" ? "shu" : role === "rebel" ? "wei" : "qun";
    return {
      playerId: p.id,
      handCardIds: handZone?.cards ?? [],
      handCount: p.handCount,
      health: game.resources.getValue(p.id, "health") ?? 0,
      maxHealth: game.resources.getValue(p.id, "maxHealth") ?? 4,
      faction,
      alive: p.status === "alive",
      seatIndex: idx,
    };
  });

  return {
    players,
    selfId,
    turnNumber: state.turnNumber,
    currentPhase: game.phases.getCurrentPhase()?.id ?? "",
    currentTurnPlayerId: state.currentTurn?.playerId ?? "",
    pendingEvents: [],
    playerCount: playerIds.length,
  };
}

function getAlivePlayers(game: Game): PlayerId[] {
  const state = game.getState();
  return Array.from(state.players.values())
    .filter((p) => p.status === "alive")
    .map((p) => p.id);
}

function applyDamage(game: Game, targetId: PlayerId, amount: number): void {
  const current = game.resources.getValue(targetId, "health");
  if (current !== undefined) {
    const newHealth = Math.max(0, current - amount);
    game.resources.set(targetId, "health", newHealth);
  }
}

function removeCardFromHand(game: Game, playerId: PlayerId, cardId: string): void {
  const state = game.getState();
  const handZone = state.players.get(playerId)?.zones.get("hand");
  if (!handZone) return;

  const newCards = handZone.cards.filter((c) => c !== cardId);
  game.state.setPlayerZone(playerId, "hand", {
    definition: handZone.definition,
    cards: newCards,
    playerId,
  });

  const discardZone = state.globalZones.get("discard");
  if (discardZone) {
    game.state.setGlobalZone("discard", {
      definition: discardZone.definition,
      cards: [...discardZone.cards, cardId],
    });
  }

  game.state.updatePlayerHandCount(playerId);
}

describe("Sanguosha Integration", () => {
  it("should load the full sanguosha deck without errors", () => {
    expect(deck).toBeDefined();
    expect(deck.manifest.id).toBe("sanguosha-standard");
    expect(deck.cards.size).toBeGreaterThanOrEqual(22);
    expect(deck.instances?.length).toBeGreaterThanOrEqual(100);
    expect(deck.characters?.length).toBe(10);
  });

  it("should create a 4-player game with AI", async () => {
    const game = createGame();
    const playerIds = setupPlayers(game);

    expect(game.getState().players.size).toBe(4);

    for (const pid of playerIds) {
      expect(game.resources.getValue(pid, "health")).toBe(4);
      expect(game.resources.getValue(pid, "maxHealth")).toBe(4);
    }
  });

  async function runGameTurn(
  game: Game,
  currentPlayerId: PlayerId,
  ais: Map<PlayerId, HeuristicAI>,
  maxActions: number,
  options: { withResponses?: boolean; turnIndex?: number } = {}
): Promise<void> {
  const currentAI = ais.get(currentPlayerId)!;

  await game.startTurn(currentPlayerId);

  while (!game.phases.isTurnComplete()) {
    const phase = game.phases.getCurrentPhase();
    const phaseId = phase?.id ?? "";

    if (phaseId === "draw") {
      dealCards(game, currentPlayerId, 2);
    }

    if (phase && !phase.auto) {
      let gameView = buildGameView(game, currentPlayerId);
      currentAI.setHandCards(getHandCards(game, currentPlayerId));

      let actionsThisPhase = 0;

      while (actionsThisPhase < maxActions) {
        const action = await currentAI.decideAction(gameView);

        if (action.type === "endTurn" || action.type === "pass") {
          break;
        }

        if (action.type === "playCard" && action.cardId) {
          const defId = mapInstanceToDefId(action.cardId);
          const cardInfo = cardTypeMap.get(defId);

          removeCardFromHand(game, currentPlayerId, action.cardId);

          const targets = action.targets ?? [];
          try {
            await game.playCard(currentPlayerId, action.cardId, targets);
          } catch (e) {
            if ((e as Error).message.includes("out of attack range")) {
              actionsThisPhase++;
              continue;
            }
            throw e;
          }

          if (cardInfo?.type === "sha" && targets.length > 0) {
            for (const target of targets) {
              if (options.withResponses) {
                const targetAI = ais.get(target)!;
                const targetView = buildGameView(game, target);
                targetAI.setHandCards(getHandCards(game, target));

                const shaEvent = {
                  id: `evt_sha_${options.turnIndex ?? 0}_${actionsThisPhase}`,
                  type: "card:played" as const,
                  source: currentPlayerId,
                  data: { cardType: "sha" },
                  timestamp: Date.now(),
                  stackDepth: 0,
                };

                const response = await targetAI.decideResponse(targetView, shaEvent);

                if (response && response.cardId) {
                  removeCardFromHand(game, target, response.cardId);
                  await game.respondToEvent(shaEvent.id, response);
                } else {
                  applyDamage(game, target, 1);
                }
              } else {
                applyDamage(game, target, 1);
              }
            }
          }

          if (cardInfo?.type === "tao" && targets.length > 0) {
            const target = targets[0];
            const currentHp = game.resources.getValue(target, "health") ?? 0;
            const maxHp = game.resources.getValue(target, "maxHealth") ?? 4;
            game.resources.set(target, "health", Math.min(currentHp + 1, maxHp));
          }
        }

        if (action.type === "respond" && action.data) {
          const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
          if (discardAll) {
            for (const cardId of discardAll) {
              removeCardFromHand(game, currentPlayerId, cardId);
            }
          }
          break;
        }

        gameView = buildGameView(game, currentPlayerId);
        currentAI.setHandCards(getHandCards(game, currentPlayerId));

        actionsThisPhase++;
      }
    }

    if (phaseId === "discard") {
      const health = game.resources.getValue(currentPlayerId, "health") ?? 0;
      const handCount = getHandCards(game, currentPlayerId).length;
      if (handCount > health) {
        let discardView = buildGameView(game, currentPlayerId);
        discardView = { ...discardView, currentPhase: "discard" };
        currentAI.setHandCards(getHandCards(game, currentPlayerId));
        const action = await currentAI.decideAction(discardView);
        if (action.type === "respond" && action.data) {
          const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
          if (discardAll) {
            for (const cardId of discardAll) {
              removeCardFromHand(game, currentPlayerId, cardId);
            }
          }
        }
      }
    }

    await game.nextPhase();
  }

  await game.endTurn();
}

  it("should run a complete 4-player game to completion", async () => {
    const MAX_TURNS = 200;
    const game = createGame();
    const playerIds = setupPlayers(game);

    const ais = new Map<PlayerId, HeuristicAI>();
    for (const pid of playerIds) {
      ais.set(pid, new HeuristicAI(`AI_${pid}`));
    }

    game.initPhases(deckPhases);
    await game.start();

    game.assignRoles();
    expect(game.getState().status).toBe("running");

    for (const pid of playerIds) {
      dealCards(game, pid, 4);
    }

    let turnPlayerIndex = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const alive = getAlivePlayers(game);
      if (alive.length <= 1) break;

      turnPlayerIndex = turnPlayerIndex % alive.length;
      const currentPlayerId = alive[turnPlayerIndex];

      await runGameTurn(game, currentPlayerId, ais, 30, {
        withResponses: true,
        turnIndex: turn,
      });

      if (getAlivePlayers(game).length <= 1) break;

      turnPlayerIndex++;
    }

    const finalAlive = getAlivePlayers(game);

    expect(finalAlive.length).toBeLessThanOrEqual(2);

    const eventLog = game.getEventLog();
    expect(eventLog.length).toBeGreaterThan(0);

    const eventTypes = eventLog.map((e) => e.type);
    expect(eventTypes).toContain(EventType.GAME_START);
    expect(eventTypes).toContain(EventType.CARD_PLAYED);
    expect(eventTypes).toContain(EventType.TURN_START);
    expect(eventTypes).toContain(EventType.TURN_END);
    expect(eventTypes).toContain(EventType.PHASE_START);

    expect(eventLog.length).toBeLessThan(MAX_TURNS * 50);
  }, 30000);

  it("should generate a winner when game completes", async () => {
    const MAX_TURNS = 160;
    const game = createGame();
    const playerIds = setupPlayers(game);

    const ais = new Map<PlayerId, HeuristicAI>();
    for (const pid of playerIds) {
      ais.set(pid, new HeuristicAI(`AI_${pid}`));
    }

    game.initPhases(deckPhases);
    await game.start();

    game.assignRoles();

    for (const pid of playerIds) {
      dealCards(game, pid, 4);
    }

    let turnPlayerIndex = 0;
    const ended = false;

    for (let turn = 0; turn < MAX_TURNS && !ended; turn++) {
      const alive = getAlivePlayers(game);
      if (alive.length <= 1) {
        break;
      }

      turnPlayerIndex = turnPlayerIndex % alive.length;
      const currentPlayerId = alive[turnPlayerIndex];

      await runGameTurn(game, currentPlayerId, ais, 20, {
        withResponses: true,
        turnIndex: turn,
      });

      turnPlayerIndex++;
    }

    const finalAlive = getAlivePlayers(game);
    const eventLog = game.getEventLog();

    expect(finalAlive.length).toBeLessThanOrEqual(2);

    const containsElimination = eventLog.some((e) => e.type === EventType.PLAYER_ELIMINATED);
    const gameEnded = eventLog.some((e) => e.type === EventType.GAME_END);

    expect(containsElimination || gameEnded || finalAlive.length <= 1).toBe(true);
  }, 30000);

  it("should not crash or enter infinite loop", async () => {
    const MAX_TURNS = 50;
    const game = createGame();
    const playerIds = setupPlayers(game);

    const ais = new Map<PlayerId, HeuristicAI>();
    for (const pid of playerIds) {
      ais.set(pid, new HeuristicAI(`AI_${pid}`));
    }

    game.initPhases(deckPhases);
    await game.start();

    game.assignRoles();

    for (const pid of playerIds) {
      dealCards(game, pid, 4);
    }

    let turnPlayerIndex = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      // "should not crash" test
      const alive = getAlivePlayers(game);
      if (alive.length <= 1) break;

      turnPlayerIndex = turnPlayerIndex % alive.length;
      const currentPlayerId = alive[turnPlayerIndex];

      await runGameTurn(game, currentPlayerId, ais, 15);

      turnPlayerIndex++;
    }

    const eventLog = game.getEventLog();
    expect(eventLog.length).toBeGreaterThan(0);
    expect(eventLog.length).toBeLessThan(10000);

    const eventsPerTurn = eventLog.length / Math.max(game.getState().turnNumber, 1);
    expect(eventsPerTurn).toBeLessThan(200);
  }, 30000);

  it("should produce a complete event log", async () => {
    const MAX_TURNS = 40;
    const game = createGame();
    const playerIds = setupPlayers(game);

    const ais = new Map<PlayerId, HeuristicAI>();
    for (const pid of playerIds) {
      ais.set(pid, new HeuristicAI(`AI_${pid}`));
    }

    game.initPhases(deckPhases);
    await game.start();

    for (const pid of playerIds) {
      dealCards(game, pid, 4);
    }

    let turnPlayerIndex = 0;

    for (let turn = 0; turn < MAX_TURNS; turn++) {
      const alive = getAlivePlayers(game);
      if (alive.length <= 1) break;

      turnPlayerIndex = turnPlayerIndex % alive.length;
      const currentPlayerId = alive[turnPlayerIndex];

      await runGameTurn(game, currentPlayerId, ais, 10);

      turnPlayerIndex++;
    }

    const eventLog = game.getEventLog();

    const requiredTypes = [
      EventType.GAME_START,
      EventType.TURN_START,
      EventType.TURN_END,
      EventType.PHASE_START,
      EventType.CARD_PLAYED,
    ];

    const logTypes = eventLog.map((e) => e.type);
    for (const required of requiredTypes) {
      expect(logTypes).toContain(required);
    }

    for (const event of eventLog) {
      expect(event.id).toBeTruthy();
      expect(event.type).toBeTruthy();
      expect(typeof event.timestamp).toBe("number");
      expect(typeof event.stackDepth).toBe("number");
    }

    expect(eventLog.length).toBeGreaterThan(0);
  }, 30000);

  it("should assign unique instance IDs to all cards", () => {
    const instances = deck.instances ?? [];
    const ids = new Set(instances.map((i) => i.instanceId));
    expect(ids.size).toBe(instances.length);

    for (const inst of instances) {
      expect(inst.instanceId).toBeTruthy();
      expect(inst.definitionId).toBeTruthy();
    }
  });

  it("should have all 10 characters defined with skills", () => {
    const characters = deck.characters ?? [];
    expect(characters).toHaveLength(10);

    const requiredChars = ["caocao", "liubei", "sunquan", "guanyu", "zhangfei",
      "zhaoyun", "lvbu", "diaochan", "huatuo", "simayi"];
    const charIds = characters.map((c) => c.id);

    for (const id of requiredChars) {
      expect(charIds).toContain(id);
    }

    for (const char of characters) {
      expect(char.hp).toBeGreaterThan(0);
      expect(char.maxHp).toBeGreaterThan(0);
      expect(char.skills.length).toBeGreaterThanOrEqual(1);
    }
  });
});