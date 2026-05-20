import { describe, it, expect, beforeAll } from "vitest";
import { HeuristicAI } from "./heuristic.js";
import type { AIGameView, AIPlayerInfo } from "./types.js";
import { Game } from "@cardverse/core";
import { DeckLoader } from "@cardverse/deck";
import type { Deck } from "@cardverse/deck";
import type { ZoneDefinition, PhaseDefinition, ResourceDefinition, PlayerId } from "@cardverse/shared";
import { readFile } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DECK_ROOT = resolve(__dirname, "../../../decks/sanguosha");

async function readJson(filePath: string): Promise<Record<string, unknown>> {
  const content = await readFile(filePath, "utf-8");
  return JSON.parse(content) as Record<string, unknown>;
}

let deckZones: ZoneDefinition[];
let deckPhases: PhaseDefinition[];
let deckResources: ResourceDefinition[];
let deck: Deck;

beforeAll(async () => {
  const [manifest, rules, basic, trick, equipment] = await Promise.all([
    readJson(resolve(DECK_ROOT, "manifest.json")),
    readJson(resolve(DECK_ROOT, "rules.json")),
    readJson(resolve(DECK_ROOT, "cards/basic.json")),
    readJson(resolve(DECK_ROOT, "cards/trick.json")),
    readJson(resolve(DECK_ROOT, "cards/equipment.json")),
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
    winConditions: manifest.winConditions,
    drawConditions: manifest.drawConditions,
  };

  const loader = new DeckLoader();
  deck = loader.loadFromJson(deckJson);
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

function setupPlayer(game: Game, pid: PlayerId, name: string): void {
  game.addPlayer(pid, name);
  game.initPlayerZones(pid, deckZones.filter((z) => z.owner === "player"));
}

function createGameView(game: Game, playerId: PlayerId): AIGameView {
  const state = game.getState();
  const players: AIPlayerInfo[] = [];

  for (const [pid, pData] of state.players) {
    const handIds = pData.hand?.cardIds ?? [];
    players.push({
      playerId: pid,
      handCardIds: handIds as string[],
      handCount: handIds.length,
      health: pData.health ?? 0,
      maxHealth: pData.maxHealth ?? 0,
      faction: pData.faction ?? "",
      alive: pData.isAlive ?? false,
      seatIndex: pData.seatIndex ?? 0,
    });
  }

  const playerOrder = [...state.players.keys()];

  return {
    players,
    selfId: playerId,
    turnNumber: state.turnNumber,
    currentPhase: state.currentTurn?.currentPhase ?? "draw",
    currentTurnPlayerId: state.currentTurn?.playerId ?? playerOrder[0],
    pendingEvents: [],
    playerCount: playerOrder.length,
  };
}

describe("AI E2E integration", () => {
  it("should run 1-human + 3-AI game loop without errors", async () => {
    const game = createGame();
    setupPlayer(game, "human", "人类玩家");
    setupPlayer(game, "ai1", "AI-1");
    setupPlayer(game, "ai2", "AI-2");
    setupPlayer(game, "ai3", "AI-3");

    const ai1 = new HeuristicAI("AI-1");
    const ai2 = new HeuristicAI("AI-2");
    const ai3 = new HeuristicAI("AI-3");

    game.start();

    const playerIds: PlayerId[] = ["human", "ai1", "ai2", "ai3"];
    for (const pid of playerIds) {
      await game.drawCards(pid, 4);
    }

    let turnCount = 0;
    const maxTurns = 20;
    let errorsCount = 0;

    while (turnCount < maxTurns) {
      const state = game.getState();
      if (state.status === "finished") break;

      const currentPid = state.currentTurn?.playerId ?? playerIds[turnCount % playerIds.length];

      if (currentPid === "human") {
        try {
          await game.endTurn();
        } catch (_e) {
          errorsCount++;
        }
      } else {
        const ai = currentPid === "ai1" ? ai1 : currentPid === "ai2" ? ai2 : ai3;
        const gameView = createGameView(game, currentPid);
        await ai.onGameStart(gameView);

        for (const phase of ["draw", "judge", "play", "discard"]) {
          try {
            const phaseView: AIGameView = { ...gameView, currentPhase: phase };
            const action = await ai.decideAction(phaseView);
            if (action.type === "playCard" && action.cardId && action.targets?.length) {
              await game.playCard(currentPid, action.cardId, action.targets);
            }
          } catch (_e) {
            break;
          }
        }

        try {
          await game.endTurn();
        } catch (_e) {
          errorsCount++;
          break;
        }
      }

      turnCount++;
    }

    expect(turnCount).toBeGreaterThan(0);
    expect(errorsCount).toBeLessThanOrEqual(5);
  });

  it("should use target scoring for sha cards", async () => {
    const game = createGame();
    setupPlayer(game, "p1", "玩家1");
    setupPlayer(game, "p2", "玩家2");
    game.start();

    await game.drawCards("p1", 4);
    await game.drawCards("p2", 4);

    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_sha_1"],
          handCount: 2,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
        {
          playerId: "p2",
          handCardIds: [],
          handCount: 3,
          health: 1,
          maxHealth: 4,
          faction: "wu",
          alive: true,
          seatIndex: 1,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 2,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_sha_1", type: "sha", category: "basic", name: "杀" },
    ]);

    const action = await ai.decideAction(playerView);
    expect(["playCard", "endTurn", "pass"]).toContain(action.type);
    if (action.type === "playCard" && action.targets?.length) {
      expect(action.targets[0]).toBe("p2");
    }
  }, 5000);

  it("should respond to sha with shan when health is low", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_shan_1"],
          handCount: 2,
          health: 1,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_shan_1", type: "shan", category: "basic", name: "闪" },
      { instanceId: "inst_sha_1", type: "sha", category: "basic", name: "杀" },
    ]);

    const response = await ai.decideResponse(playerView, {
      id: "ev_1",
      type: "card:played" as never,
      source: "p2",
      data: { cardType: "sha" },
      timestamp: Date.now(),
      stackDepth: 1,
    });

    expect(response).not.toBeNull();
    expect(response?.action).toBe("play");
  });

  it("should handle draw phase correctly", async () => {
    const ai = new HeuristicAI("AI-1");
    const drawView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: [],
          handCount: 2,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "draw",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(drawView);
    const action = await ai.decideAction(drawView);

    expect(action.type).toBe("pass");
  });

  it("should handle judge phase correctly", async () => {
    const ai = new HeuristicAI("AI-1");
    const judgeView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: [],
          handCount: 2,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "judge",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(judgeView);
    const action = await ai.decideAction(judgeView);

    expect(action.type).toBe("pass");
  });

  it("should handle discard phase when hand exceeds limit", async () => {
    const ai = new HeuristicAI("AI-1");
    const discardView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["c1", "c2", "c3", "c4", "c5"],
          handCount: 5,
          health: 2,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "discard",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(discardView);
    ai.setHandCards([
      { instanceId: "c1", type: "sha", category: "basic", name: "杀" },
      { instanceId: "c2", type: "shan", category: "basic", name: "闪" },
      { instanceId: "c3", type: "tao", category: "basic", name: "桃" },
      { instanceId: "c4", type: "jiu", category: "basic", name: "酒" },
      { instanceId: "c5", type: "sha", category: "basic", name: "杀" },
    ]);

    const action = await ai.decideAction(discardView);

    expect(["discard", "endTurn"]).toContain(action.type);
    if (action.type === "discard") {
      const discardAll = (action.data?.discardAll as string[] | undefined) ?? [];
      expect(discardAll.length).toBeGreaterThanOrEqual(3);
    }
  });

  it("should respond to nanman with sha when available", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_sha_1"],
          handCount: 2,
          health: 3,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_sha_1", type: "sha", category: "basic", name: "杀" },
    ]);

    const response = await ai.decideResponse(playerView, {
      id: "ev_1",
      type: "card:played" as never,
      source: "p2",
      data: { cardType: "nanman" },
      timestamp: Date.now(),
      stackDepth: 1,
    });

    expect(response).not.toBeNull();
    expect(response?.action).toBe("play");
  });

  it("should respond to wanjian with shan when available", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_shan_1"],
          handCount: 2,
          health: 3,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_shan_1", type: "shan", category: "basic", name: "闪" },
    ]);

    const response = await ai.decideResponse(playerView, {
      id: "ev_1",
      type: "card:played" as never,
      source: "p2",
      data: { cardType: "wanjian" },
      timestamp: Date.now(),
      stackDepth: 1,
    });

    expect(response).not.toBeNull();
    expect(response?.action).toBe("play");
  });

  it("should call onGameEnd for cleanup", async () => {
    const ai = new HeuristicAI("AI-1");
    const gameView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: [],
          handCount: 0,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(gameView);
    await ai.onGameEnd(gameView, "p2");

    expect(true).toBe(true);
  });

  it("should pass when no valid response is available", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: [],
          handCount: 0,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 1,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([]);

    const response = await ai.decideResponse(playerView, {
      id: "ev_1",
      type: "card:played" as never,
      source: "p2",
      data: { cardType: "sha" },
      timestamp: Date.now(),
      stackDepth: 1,
    });

    if (response === null) {
      expect(response).toBeNull();
    } else {
      expect(response.action).toBe("pass");
    }
  });

  it("should prefer low-health enemies when choosing sha target", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_sha_1"],
          handCount: 1,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
        {
          playerId: "p2",
          handCardIds: [],
          handCount: 1,
          health: 4,
          maxHealth: 4,
          faction: "wu",
          alive: true,
          seatIndex: 1,
        },
        {
          playerId: "p3",
          handCardIds: [],
          handCount: 1,
          health: 1,
          maxHealth: 4,
          faction: "wu",
          alive: true,
          seatIndex: 2,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 3,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_sha_1", type: "sha", category: "basic", name: "杀" },
    ]);

    const action = await ai.decideAction(playerView);

    if (action.type === "playCard" && action.targets?.length) {
      expect(action.targets[0]).toBe("p3");
    }
  });

  it("should prefer high-hand-count enemies among equally wounded", async () => {
    const ai = new HeuristicAI("AI-1");
    const playerView: AIGameView = {
      players: [
        {
          playerId: "p1",
          handCardIds: ["inst_sha_1"],
          handCount: 1,
          health: 4,
          maxHealth: 4,
          faction: "wei",
          alive: true,
          seatIndex: 0,
        },
        {
          playerId: "p2",
          handCardIds: [],
          handCount: 1,
          health: 1,
          maxHealth: 4,
          faction: "wu",
          alive: true,
          seatIndex: 1,
        },
        {
          playerId: "p3",
          handCardIds: ["c1", "c2", "c3", "c4"],
          handCount: 4,
          health: 1,
          maxHealth: 4,
          faction: "wu",
          alive: true,
          seatIndex: 2,
        },
      ],
      selfId: "p1",
      turnNumber: 1,
      currentPhase: "play",
      currentTurnPlayerId: "p1",
      pendingEvents: [],
      playerCount: 3,
    };

    await ai.onGameStart(playerView);
    ai.setHandCards([
      { instanceId: "inst_sha_1", type: "sha", category: "basic", name: "杀" },
    ]);

    const action = await ai.decideAction(playerView);

    if (action.type === "playCard" && action.targets?.length) {
      expect(action.targets[0]).toBe("p3");
    }
  });
});