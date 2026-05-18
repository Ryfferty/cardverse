import type { PlayerId, GameEvent, EventResponse } from "@cardverse/shared";
import type { AIAdapter, AIGameView, AIAction, AIPlayerInfo, HandCard } from "./types.js";

const FALLBACK_ACTIONS: AIAction[] = [
  { type: "pass" },
  { type: "endTurn" },
];

function pickRandom<T>(arr: T[]): T | undefined {
  if (arr.length === 0) return undefined;
  return arr[Math.floor(Math.random() * arr.length)];
}

export class HeuristicAI implements AIAdapter {
  readonly name: string;
  private handCards: HandCard[] = [];
  private gameView: AIGameView | null = null;

  constructor(name?: string) {
    this.name = name ?? `AI_${Math.floor(Math.random() * 10000)}`;
  }

  setHandCards(cards: HandCard[]): void {
    this.handCards = cards;
  }

  private getSelf(): AIPlayerInfo {
    const gameView = this.gameView;
    if (!gameView) throw new Error("Game view not set");
    return gameView.players.find((p) => p.playerId === gameView.selfId) ?? {
      playerId: gameView.selfId,
      handCardIds: [],
      handCount: 0,
      health: 0,
      maxHealth: 0,
      faction: "",
      alive: false,
    };
  }

  private getEnemies(): AIPlayerInfo[] {
    if (!this.gameView) return [];
    const self = this.getSelf();
    return this.gameView.players.filter((p) => p.alive && p.playerId !== self.playerId && p.faction !== self.faction);
  }

  private getAllies(): AIPlayerInfo[] {
    if (!this.gameView) return [];
    const self = this.getSelf();
    return this.gameView.players.filter((p) => p.alive && p.playerId !== self.playerId && p.faction === self.faction);
  }

  private findCardsByType(type: string): HandCard[] {
    return this.handCards.filter((c) => c.type === type);
  }

  private hasCardType(type: string): boolean {
    return this.findCardsByType(type).length > 0;
  }

  async decideAction(gameView: AIGameView): Promise<AIAction> {
    this.gameView = gameView;
    const self = this.getSelf();

    try {
      if (gameView.currentPhase !== "play") {
        return { type: "pass" };
      }

      const shaCards = this.findCardsByType("sha");
      const taoCards = this.findCardsByType("tao");
      const equipmentCards = this.handCards.filter((c) => c.type === "equipment");

      const enemies = this.getEnemies();
      if (shaCards.length > 0 && enemies.length > 0) {
        const target = enemies[0];
        return {
          type: "playCard",
          cardId: shaCards[0].instanceId,
          targets: [target.playerId],
        };
      }

      if (taoCards.length > 0 && self.health < self.maxHealth) {
        return {
          type: "playCard",
          cardId: taoCards[0].instanceId,
          targets: [self.playerId],
        };
      }

      if (equipmentCards.length > 0) {
        return {
          type: "playCard",
          cardId: equipmentCards[0].instanceId,
        };
      }

      const trickCards = this.handCards.filter((c) => c.type === "trick");
      if (trickCards.length > 0 && enemies.length > 0) {
        return {
          type: "playCard",
          cardId: trickCards[0].instanceId,
          targets: [enemies[0].playerId],
        };
      }

      return { type: "endTurn" };
    } catch (e) {
      return pickRandom(FALLBACK_ACTIONS) ?? { type: "endTurn" };
    }
  }

  async decideResponse(gameView: AIGameView, event: GameEvent): Promise<EventResponse | null> {
    this.gameView = gameView;
    const self = this.getSelf();

    try {
      const eventType = event.type as string;

      if (eventType === "card:played") {
        const cardType = event.data.cardType as string | undefined;

        if (cardType === "sha" && this.hasCardType("shan")) {
          if (self.health <= 1 || self.health <= 2) {
            const shanCards = this.findCardsByType("shan");
            return {
              playerId: self.playerId,
              action: "play",
              cardId: shanCards[0].instanceId,
            };
          }

          if (self.health <= 2) {
            const shanCards = this.findCardsByType("shan");
            return {
              playerId: self.playerId,
              action: "play",
              cardId: shanCards[0].instanceId,
            };
          }

          if (this.handCards.length > 2) {
            const shanCards = this.findCardsByType("shan");
            return {
              playerId: self.playerId,
              action: "play",
              cardId: shanCards[0].instanceId,
            };
          }
        }

        if (cardType === "nanman" && this.hasCardType("sha")) {
          const shaCards = this.findCardsByType("sha");
          return {
            playerId: self.playerId,
            action: "play",
            cardId: shaCards[0].instanceId,
          };
        }

        if (cardType === "wanjian" && this.hasCardType("shan")) {
          const shanCards = this.findCardsByType("shan");
          return {
            playerId: self.playerId,
            action: "play",
            cardId: shanCards[0].instanceId,
          };
        }
      }

      if (eventType === "response:requested") {
        const requestType = event.data.type as string | undefined;

        if (requestType === "counter_sha" && this.hasCardType("sha")) {
          const shaCards = this.findCardsByType("sha");
          return {
            playerId: self.playerId,
            action: "play",
            cardId: shaCards[0].instanceId,
          };
        }

        return {
          playerId: self.playerId,
          action: "pass",
        };
      }

      return {
        playerId: self.playerId,
        action: "pass",
      };
    } catch (e) {
      return null;
    }
  }

  async onGameStart(gameView: AIGameView): Promise<void> {
    this.gameView = gameView;
  }

  async onGameEnd(_gameView: AIGameView, _winner: PlayerId): Promise<void> {
    this.gameView = null;
    this.handCards = [];
  }
}