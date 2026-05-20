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
      seatIndex: 0,
    };
  }

  private getDistance(from: PlayerId, to: PlayerId): number {
    if (!this.gameView) return Infinity;
    const alive = this.gameView.players.filter((p) => p.alive);
    const fromPlayer = alive.find((p) => p.playerId === from);
    const toPlayer = alive.find((p) => p.playerId === to);
    if (!fromPlayer || !toPlayer) return Infinity;

    const total = this.gameView.playerCount;
    if (total <= 2) return 1;

    const clockwise = (toPlayer.seatIndex - fromPlayer.seatIndex + total) % total;
    const counterclockwise = (fromPlayer.seatIndex - toPlayer.seatIndex + total) % total;
    return Math.min(clockwise, counterclockwise);
  }

  private getEnemies(): AIPlayerInfo[] {
    if (!this.gameView) return [];
    const self = this.getSelf();
    return this.gameView.players
      .filter((p) => p.alive && p.playerId !== self.playerId && p.faction !== self.faction)
      .sort((a, b) => a.health - b.health);
  }

  private getEnemiesInRange(attackRange: number): AIPlayerInfo[] {
    const self = this.getSelf();
    return this.getEnemies().filter(
      (e) => this.getDistance(self.playerId, e.playerId) <= attackRange
    );
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

  private getAttackRange(): number {
    const equipCards = this.findCardsByType("equipment");
    let range = 1;

    for (const card of equipCards) {
      const tags = card.tags ?? [];
      if (tags.includes("weapon")) {
        for (const tag of tags) {
          const match = tag.match(/^range-(\d+)$/);
          if (match) {
            range = Math.max(range, parseInt(match[1], 10));
          }
        }
      }
    }

    return range;
  }

  private selectBestTarget(enemies: AIPlayerInfo[]): AIPlayerInfo | undefined {
    if (enemies.length === 0) return undefined;
    if (enemies.length === 1) return enemies[0];

    const self = this.getSelf();
    let best = enemies[0];
    let bestScore = -Infinity;

    for (const enemy of enemies) {
      let score = 0;
      score += (enemy.maxHealth - enemy.health) * 3;
      score += enemy.handCount;
      const dist = this.getDistance(self.playerId, enemy.playerId);
      if (dist <= 2) score += 3;
      else if (dist <= 3) score += 1;

      if (score > bestScore) {
        bestScore = score;
        best = enemy;
      }
    }

    return best;
  }

  async decideAction(gameView: AIGameView): Promise<AIAction> {
    this.gameView = gameView;
    const self = this.getSelf();

    try {
      switch (gameView.currentPhase) {
        case "draw":
          return this.decideDraw();
        case "judge":
          return this.decideJudge();
        case "play":
          return this.decidePlay(self);
        case "discard":
          return this.decideDiscard(self);
        default:
          return { type: "pass" };
      }
    } catch (_e) {
      return pickRandom(FALLBACK_ACTIONS) ?? { type: "endTurn" };
    }
  }

  private decideDraw(): AIAction {
    return { type: "pass" };
  }

  private decideJudge(): AIAction {
    return { type: "pass" };
  }

  private decidePlay(self: AIPlayerInfo): AIAction {
    const attackRange = this.getAttackRange();
    const shaCards = this.findCardsByType("sha");
    const taoCards = this.findCardsByType("tao");
    const equipmentCards = this.handCards.filter((c) => c.type === "equipment");

    const enemiesInRange = this.getEnemiesInRange(attackRange);
    if (shaCards.length > 0 && enemiesInRange.length > 0) {
      const target = this.selectBestTarget(enemiesInRange);
      if (!target) return { type: "endTurn" };
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

    const allEnemies = this.getEnemies();
    const trickCards = this.handCards.filter((c) => c.type === "trick");
    if (trickCards.length > 0 && allEnemies.length > 0) {
      const target = this.selectBestTarget(allEnemies);
      if (!target) return { type: "endTurn" };
      return {
        type: "playCard",
        cardId: trickCards[0].instanceId,
        targets: [target.playerId],
      };
    }

    return { type: "endTurn" };
  }

  private decideDiscard(self: AIPlayerInfo): AIAction {
    const handLimit = self.health;
    const excess = this.handCards.length - handLimit;

    if (excess <= 0) {
      return { type: "endTurn" };
    }

    const discardOrder = ["jiu", "sha", "shan", "trick", "equipment", "tao"];
    const sorted = [...this.handCards].sort((a, b) => {
      const ai = discardOrder.indexOf(a.type);
      const bi = discardOrder.indexOf(b.type);
      return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
    });

    const toDiscard = sorted.slice(0, excess).map((c) => c.instanceId);

    return {
      type: "discard",
      cardId: toDiscard[0],
      data: { discardAll: toDiscard },
    };
  }

  async decideResponse(gameView: AIGameView, event: GameEvent): Promise<EventResponse | null> {
    this.gameView = gameView;
    const self = this.getSelf();

    try {
      const eventType = event.type as string;

      if (eventType === "card:played") {
        const cardType = event.data.cardType as string | undefined;

        if (cardType === "sha" && this.hasCardType("shan")) {
          if (self.health <= 1) {
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

        const harmfulTricks = ["dismantle", "steal", "duel", "nanman", "wanjian"];
        if (cardType && harmfulTricks.includes(cardType) && this.hasCardType("wuxie")) {
          const wuxieCards = this.findCardsByType("wuxie");
          return {
            playerId: self.playerId,
            action: "play",
            cardId: wuxieCards[0].instanceId,
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
    } catch (_e) {
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