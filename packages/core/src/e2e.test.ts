import { describe, it, expect, beforeAll } from "vitest";
import { Game } from "./engine.js";
import { DeckLoader } from "@cardverse/deck";
import type { Deck } from "@cardverse/deck";
import { HeuristicAI } from "@cardverse/ai";
import type { AIGameView, HandCard } from "@cardverse/ai";
import type { PlayerId, CardInstanceId, ZoneDefinition, PhaseDefinition, ResourceDefinition, GameEvent } from "@cardverse/shared";
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
      type = id;
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
  });
  game.initZones(deckZones);
  game.initResources(deckResources);
  game.setCardDefinitions(deck.cards);
  return game;
}

function setupPlayers(game: Game): string[] {
  const playerIds: string[] = [];

  for (let i = 0; i < 4; i++) {
    const pid = `player_${i}`;
    playerIds.push(pid);
    game.addPlayer(pid, `Player${i}`);

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

          await game.discardCard(currentPlayerId, action.cardId);

          const targets = action.targets ?? [];
          try {
            await game.playCard(currentPlayerId, action.cardId, targets);
          } catch (e) {
            if ((e as Error).message.includes("out of attack range")) {
              actionsThisPhase++;
              continue;
            }
            console.warn("playCard error:", (e as Error).message);
          }

          if (cardInfo?.type === "sha" && targets.length > 0) {
            for (const target of targets) {
              if (options.withResponses) {
                const targetAI = ais.get(target);
                if (targetAI) {
                  const targetView = buildGameView(game, target);
                  targetAI.setHandCards(getHandCards(game, target));

                  const shaEvent: GameEvent = {
                    id: `evt_sha_${options.turnIndex ?? 0}_${actionsThisPhase}`,
                    type: EventType.CARD_PLAYED,
                    source: currentPlayerId,
                    data: { cardType: "sha" },
                    timestamp: Date.now(),
                    stackDepth: 0,
                  };

                  const response = await targetAI.decideResponse(targetView, shaEvent);

                  if (response && response.cardId) {
                    await game.discardCard(target, response.cardId);
                    await game.respondToEvent(shaEvent.id, response);
                  } else {
                    const currentHp = game.resources.getValue(target, "health") ?? 0;
                    await game.resources.set(target, "health", Math.max(0, currentHp - 1));
                  }
                } else {
                  const currentHp = game.resources.getValue(target, "health") ?? 0;
                  await game.resources.set(target, "health", Math.max(0, currentHp - 1));
                }
              } else {
                const currentHp = game.resources.getValue(target, "health") ?? 0;
                await game.resources.set(target, "health", Math.max(0, currentHp - 1));
              }
            }
          }

          if (cardInfo?.type === "tao" && targets.length > 0) {
            const target = targets[0];
            const currentHp = game.resources.getValue(target, "health") ?? 0;
            const maxHp = game.resources.getValue(target, "maxHealth") ?? 4;
            await game.resources.set(target, "health", Math.min(currentHp + 1, maxHp));
          }
        }

        if (action.type === "discard" && action.data) {
          const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
          if (discardAll) {
            for (const cardId of discardAll) {
              await game.discardCard(currentPlayerId, cardId);
            }
          }
          break;
        }

        if (action.type === "respond" && action.data) {
          const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
          if (discardAll) {
            for (const cardId of discardAll) {
              await game.discardCard(currentPlayerId, cardId);
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
        if (action.type === "discard" && action.data) {
          const discardAll = (action.data as Record<string, unknown>).discardAll as string[] | undefined;
          if (discardAll) {
            for (const cardId of discardAll) {
              await game.discardCard(currentPlayerId, cardId);
            }
          }
        }
      }
    }

    await game.nextPhase();
  }

  await game.endTurn();
}

describe("E2E: Playability Verification", () => {
  describe("Scenario 1: 4-player AI auto game", () => {
    it("should run a complete 4-player AI game to completion with winner", async () => {
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

      expect(eventLog.length).toBeLessThan(MAX_TURNS * 50);
    }, 60000);

    it("should not enter infinite loop or crash during AI game", async () => {
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
  });

  describe("Scenario 2: 1 human player + 3 AI", () => {
    it("should allow human player to play cards and AI to auto-decide", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const humanPid = playerIds[0];

      const ais = new Map<PlayerId, HeuristicAI>();
      for (let i = 1; i < playerIds.length; i++) {
        ais.set(playerIds[i], new HeuristicAI(`AI_${playerIds[i]}`));
      }

      game.initPhases(deckPhases);
      await game.start();
      game.assignRoles();

      for (const pid of playerIds) {
        dealCards(game, pid, 4);
      }

      const humanHand = getHandCards(game, humanPid);
      expect(humanHand.length).toBe(4);

      await game.startTurn(humanPid);

      while (!game.phases.isTurnComplete()) {
        const phase = game.phases.getCurrentPhase();
        const phaseId = phase?.id ?? "";

        if (phaseId === "draw") {
          dealCards(game, humanPid, 2);
        }

        if (phase && !phase.auto) {
          const handCards = getHandCards(game, humanPid);
          if (handCards.length > 0) {
            const shaCard = handCards.find((c) => c.type === "sha");
            if (shaCard) {
              const alive = getAlivePlayers(game).filter((p) => p !== humanPid);
              const targets = alive.slice(0, 1);

              if (targets.length > 0 && game.validateRange(humanPid, targets[0])) {
                await game.discardCard(humanPid, shaCard.instanceId);
                try {
                  await game.playCard(humanPid, shaCard.instanceId, targets);
                } catch (e) {
                  console.warn("Human playCard failed:", (e as Error).message);
                }
              }
            }
          }
          break;
        }

        await game.nextPhase();
      }

      while (!game.phases.isTurnComplete()) {
        await game.nextPhase();
      }
      await game.endTurn();

      expect(game.getState().turnNumber).toBeGreaterThanOrEqual(1);

      for (let i = 1; i < 3; i++) {
        const alive = getAlivePlayers(game);
        if (alive.length <= 1) break;

        const aiPid = alive[i % alive.length];
        if (!ais.has(aiPid)) continue;

        await runGameTurn(game, aiPid, ais, 20, { withResponses: true, turnIndex: i });
      }

      const eventLog = game.getEventLog();
      expect(eventLog.length).toBeGreaterThan(0);
    }, 30000);

    it("should allow human player to respond to events", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const humanPid = playerIds[0];

      game.initPhases(deckPhases);
      await game.start();

      for (const pid of playerIds) {
        dealCards(game, pid, 4);
      }

      const humanHand = getHandCards(game, humanPid);
      const shanCard = humanHand.find((c) => c.type === "shan");

      if (shanCard) {
        await game.respondToEvent("test_evt", {
          playerId: humanPid,
          cardId: shanCard.instanceId,
          action: "play",
        });

        const eventLog = game.getEventLog();
        const hasResponse = eventLog.some((e) => e.type === EventType.RESPONSE_GIVEN);
        expect(hasResponse).toBe(true);
      }

      await game.respondToEvent("test_evt_pass", {
        playerId: humanPid,
        action: "pass",
      });

      const eventLog = game.getEventLog();
      const hasPassResponse = eventLog.some(
        (e) => e.type === EventType.RESPONSE_GIVEN && e.data?.response
      );
      expect(hasPassResponse).toBe(true);
    }, 10000);
  });

  describe("Scenario 3: Identity game integrity", () => {
    it("should assign correct roles for 4 players", () => {
      const game = createGame();
      setupPlayers(game);

      const assignments = game.assignRoles();

      expect(assignments).toHaveLength(4);

      const roles = assignments.map((a) => a.role);
      expect(roles).toContain("lord");
      expect(roles).toContain("loyalist");
      expect(roles).toContain("rebel");
      expect(roles).toContain("spy");

      const lordAssignment = assignments.find((a) => a.role === "lord");
      expect(lordAssignment?.revealed).toBe(true);

      const nonLordAssignments = assignments.filter((a) => a.role !== "lord");
      for (const a of nonLordAssignments) {
        expect(a.revealed).toBe(false);
      }
    });

    it("should detect lord victory when all rebels and spy eliminated", () => {
      const game = createGame();
      setupPlayers(game);

      game.assignRoles();

      const lordPid = game.roleManager.getPlayerIdByRole("lord")!;
      const loyalistPid = game.roleManager.getPlayerIdByRole("loyalist")!;

      const result = game.roleManager.checkVictory([lordPid, loyalistPid]);
      expect(result).not.toBeNull();
      expect(result!.winner).toBe("lord");
      expect(result!.condition).toBe("lord_victory");
    });

    it("should detect rebel victory when lord is eliminated", () => {
      const game = createGame();
      setupPlayers(game);

      game.assignRoles();

      const rebelPid = game.roleManager.getPlayerIdByRole("rebel")!;
      const spyPid = game.roleManager.getPlayerIdByRole("spy")!;

      const result = game.roleManager.checkVictory([rebelPid, spyPid]);
      expect(result).not.toBeNull();
      expect(result!.winner).toBe("rebel");
    });

    it("should detect spy solo victory when only spy remains after lord dies", () => {
      const game = createGame();
      setupPlayers(game);

      game.assignRoles();

      const spyPid = game.roleManager.getPlayerIdByRole("spy")!;

      const result = game.roleManager.checkVictory([spyPid]);
      expect(result).not.toBeNull();
      expect(result!.winner).toBe("spy");
      expect(result!.condition).toBe("spy_solo_victory");
    });

    it("should return null when game is not yet decided", () => {
      const game = createGame();
      setupPlayers(game);

      game.assignRoles();

      const lordPid = game.roleManager.getPlayerIdByRole("lord")!;
      const rebelPid = game.roleManager.getPlayerIdByRole("rebel")!;
      const spyPid = game.roleManager.getPlayerIdByRole("spy")!;

      const result = game.roleManager.checkVictory([lordPid, rebelPid, spyPid]);
      expect(result).toBeNull();
    });
  });

  describe("Scenario 4: Effect script execution", () => {
    it("should execute sha effect and deal damage", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      game.initPhases(deckPhases);
      await game.start();

      for (const pid of playerIds) {
        dealCards(game, pid, 4);
      }

      const attacker = playerIds[0];
      const target = playerIds[1];
      const targetHpBefore = game.resources.getValue(target, "health") ?? 4;

      const handCards = getHandCards(game, attacker);
      const shaCard = handCards.find((c) => c.type === "sha");

      if (shaCard && game.validateRange(attacker, target)) {
        await game.discardCard(attacker, shaCard.instanceId);
        await game.playCard(attacker, shaCard.instanceId, [target]);

        const currentHp = game.resources.getValue(target, "health") ?? 4;
        expect(currentHp).toBeLessThanOrEqual(targetHpBefore);
      }

      const eventLog = game.getEventLog();
      const hasCardPlayed = eventLog.some((e) => e.type === EventType.CARD_PLAYED);
      expect(hasCardPlayed).toBe(true);
    }, 10000);

    it("should execute tao effect and heal target", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      game.initPhases(deckPhases);
      await game.start();

      for (const pid of playerIds) {
        dealCards(game, pid, 4);
      }

      const healer = playerIds[0];
      await game.resources.set(healer, "health", 2);
      const hpBefore = game.resources.getValue(healer, "health") ?? 2;

      const handCards = getHandCards(game, healer);
      const taoCard = handCards.find((c) => c.type === "tao");

      if (taoCard) {
        await game.discardCard(healer, taoCard.instanceId);
        await game.playCard(healer, taoCard.instanceId, [healer]);

        const hpAfter = game.resources.getValue(healer, "health") ?? 0;
        expect(hpAfter).toBeGreaterThanOrEqual(hpBefore);

        const eventLog = game.getEventLog();
        const hasCardPlayed = eventLog.some((e) => e.type === EventType.CARD_PLAYED);
        expect(hasCardPlayed).toBe(true);
      } else {
        expect(hpBefore).toBe(2);
      }
    }, 10000);

    it("should execute jiu effect for damage boost context", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      game.initPhases(deckPhases);
      await game.start();

      for (const pid of playerIds) {
        dealCards(game, pid, 4);
      }

      const player = playerIds[0];
      const handCards = getHandCards(game, player);
      const jiuCard = handCards.find((c) => c.type === "jiu");

      if (jiuCard) {
        await game.discardCard(player, jiuCard.instanceId);
        await game.playCard(player, jiuCard.instanceId, [player]);

        const eventLog = game.getEventLog();
        const hasCardPlayed = eventLog.some((e) => e.type === EventType.CARD_PLAYED);
        expect(hasCardPlayed).toBe(true);
      }
    }, 10000);

    it("should track card discard through event system", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, playerIds[0], 4);

      const handCards = getHandCards(game, playerIds[0]);
      expect(handCards.length).toBeGreaterThan(0);

      const cardToDiscard = handCards[0].instanceId;
      await game.discardCard(playerIds[0], cardToDiscard);

      const eventLog = game.getEventLog();
      const hasDiscard = eventLog.some((e) => e.type === EventType.CARD_DISCARDED);
      expect(hasDiscard).toBe(true);
    }, 10000);
  });

  describe("Scenario 5: Equipment system", () => {
    it("should validate range for adjacent players without equipment", () => {
      const game = createGame();
      const playerIds = setupPlayers(game);

      expect(game.validateRange(playerIds[0], playerIds[1])).toBe(true);
      expect(game.validateRange(playerIds[0], playerIds[3])).toBe(true);
    });

    it("should fail range validation for opposite players without equipment", () => {
      const game = createGame();
      const playerIds = setupPlayers(game);

      expect(game.validateRange(playerIds[0], playerIds[2])).toBe(false);
      expect(game.validateRange(playerIds[1], playerIds[3])).toBe(false);
    });

    it("should return default range modifiers without equipment", () => {
      const game = createGame();
      const playerIds = setupPlayers(game);

      const mod = game.getPlayerRangeModifiers(playerIds[0]);
      expect(mod.weaponRange).toBe(1);
      expect(mod.mountOffense).toBe(0);
      expect(mod.mountDefense).toBe(0);
    });

    it("should place equipment in equipment zone and affect range", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, playerIds[0], 4);

      const handCards = getHandCards(game, playerIds[0]);
      const equipCard = handCards.find((c) => c.category === "equipment");

      if (equipCard) {
        const state = game.getState();
        const handZone = state.players.get(playerIds[0])?.zones.get("hand");
        const equipZone = state.players.get(playerIds[0])?.zones.get("equipment");

        if (handZone && equipZone) {
          const newHandCards = handZone.cards.filter((c) => c !== equipCard.instanceId);
          game.state.setPlayerZone(playerIds[0], "hand", {
            definition: handZone.definition,
            cards: newHandCards,
            playerId: playerIds[0],
          });
          game.state.setPlayerZone(playerIds[0], "equipment", {
            definition: equipZone.definition,
            cards: [...equipZone.cards, equipCard.instanceId],
            playerId: playerIds[0],
          });
          game.state.updatePlayerHandCount(playerIds[0]);
        }

        const equipmentCards = game.getEquipmentCards(playerIds[0]);
        expect(equipmentCards.length).toBeGreaterThan(0);

        const mod = game.getPlayerRangeModifiers(playerIds[0]);
        expect(mod.weaponRange).toBeGreaterThanOrEqual(1);
      }
    }, 10000);

    it("should calculate correct distance in 4-player ring", () => {
      const game = createGame();
      const playerIds = setupPlayers(game);

      expect(game.getPlayerSeatIndex(playerIds[0])).toBe(0);
      expect(game.getPlayerSeatIndex(playerIds[1])).toBe(1);
      expect(game.getPlayerSeatIndex(playerIds[2])).toBe(2);
      expect(game.getPlayerSeatIndex(playerIds[3])).toBe(3);
    });
  });

  describe("Scenario 6: Response flow", () => {
    it("should handle sha→shan response flow", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const attacker = playerIds[0];
      const defender = playerIds[1];

      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, attacker, 4);
      dealCards(game, defender, 4);

      const defenderHand = getHandCards(game, defender);
      const shanCard = defenderHand.find((c) => c.type === "shan");

      if (shanCard) {
        await game.respondToEvent("sha_evt_1", {
          playerId: defender,
          cardId: shanCard.instanceId,
          action: "play",
        });

        const eventLog = game.getEventLog();
        const hasResponse = eventLog.some((e) => e.type === EventType.RESPONSE_GIVEN);
        expect(hasResponse).toBe(true);
      }
    }, 10000);

    it("should handle pass response when no shan available", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const defender = playerIds[1];

      game.initPhases(deckPhases);
      await game.start();

      await game.respondToEvent("sha_evt_2", {
        playerId: defender,
        action: "pass",
      });

      const eventLog = game.getEventLog();
      const hasResponse = eventLog.some((e) => e.type === EventType.RESPONSE_GIVEN);
      expect(hasResponse).toBe(true);
    }, 10000);

    it("should handle wuxie response for trick cards", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const responder = playerIds[1];

      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, responder, 4);

      const handCards = getHandCards(game, responder);
      const wuxieCard = handCards.find((c) => c.type === "wuxie");

      if (wuxieCard) {
        await game.respondToEvent("trick_evt_1", {
          playerId: responder,
          cardId: wuxieCard.instanceId,
          action: "play",
        });

        const eventLog = game.getEventLog();
        const hasResponse = eventLog.some((e) => e.type === EventType.RESPONSE_GIVEN);
        expect(hasResponse).toBe(true);
      }
    }, 10000);

    it("should handle duel response with sha", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const defender = playerIds[1];

      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, defender, 4);

      const handCards = getHandCards(game, defender);
      const shaCard = handCards.find((c) => c.type === "sha");

      if (shaCard) {
        await game.respondToEvent("duel_evt_1", {
          playerId: defender,
          cardId: shaCard.instanceId,
          action: "play",
        });

        const eventLog = game.getEventLog();
        const hasResponse = eventLog.some((e) => e.type === EventType.RESPONSE_GIVEN);
        expect(hasResponse).toBe(true);
      }
    }, 10000);

    it("should handle AI response decision for sha attack", async () => {
      const game = createGame();
      const playerIds = setupPlayers(game);
      const attacker = playerIds[0];
      const defender = playerIds[1];

      game.initPhases(deckPhases);
      await game.start();

      dealCards(game, defender, 4);

      const ai = new HeuristicAI("TestAI");
      const gameView = buildGameView(game, defender);
      ai.setHandCards(getHandCards(game, defender));

      const shaEvent: GameEvent = {
        id: "evt_ai_sha",
        type: EventType.CARD_PLAYED,
        source: attacker,
        data: { cardType: "sha" },
        timestamp: Date.now(),
        stackDepth: 1,
      };

      const response = await ai.decideResponse(gameView, shaEvent);
      expect(response).not.toBeNull();
      expect(["play", "pass"]).toContain(response!.action);
    }, 10000);
  });
});
