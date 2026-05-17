import {
  type ZoneDefinition,
  type ZoneState,
  type ZoneId,
  type CardInstance,
  type CardInstanceId,
  type PlayerId,
  type ZoneVisibility,
} from "@cardverse/shared";

/**
 * ZoneManager — manages all card zones in the game.
 */
export class ZoneManager {
  private zones = new Map<string, ZoneState>();

  /**
   * Add a global zone (shared among all players, e.g., deck, discard pile).
   */
  addGlobalZone(definition: ZoneDefinition): void {
    this.zones.set(`global:${definition.id}`, {
      definition,
      cards: [],
    });
  }

  /**
   * Add a player zone (e.g., hand, equipment, field).
   */
  addPlayerZone(playerId: PlayerId, definition: ZoneDefinition): void {
    this.zones.set(`player:${playerId}:${definition.id}`, {
      definition,
      cards: [],
      playerId,
    });
  }

  getZone(key: string): ZoneState | undefined {
    return this.zones.get(key);
  }

  getGlobalZone(zoneId: ZoneId): ZoneState | undefined {
    return this.zones.get(`global:${zoneId}`);
  }

  getPlayerZone(playerId: PlayerId, zoneId: ZoneId): ZoneState | undefined {
    return this.zones.get(`player:${playerId}:${zoneId}`);
  }

  /**
   * Get all cards in a zone.
   */
  getCards(key: string): CardInstanceId[] {
    return this.zones.get(key)?.cards ?? [];
  }

  /**
   * Add a card to a zone.
   */
  addCard(key: string, cardId: CardInstanceId, position?: number): boolean {
    const zone = this.zones.get(key);
    if (!zone) return false;
    if (zone.definition.maxSize && zone.cards.length >= zone.definition.maxSize) {
      return false;
    }
    if (position !== undefined) {
      zone.cards.splice(position, 0, cardId);
    } else {
      zone.cards.push(cardId);
    }
    return true;
  }

  /**
   * Remove a card from a zone.
   */
  removeCard(key: string, cardId: CardInstanceId): boolean {
    const zone = this.zones.get(key);
    if (!zone) return false;
    const index = zone.cards.indexOf(cardId);
    if (index === -1) return false;
    zone.cards.splice(index, 1);
    return true;
  }

  /**
   * Move a card between zones.
   */
  moveCard(
    fromKey: string,
    toKey: string,
    cardId: CardInstanceId,
    position?: number
  ): boolean {
    if (!this.removeCard(fromKey, cardId)) return false;
    return this.addCard(toKey, cardId, position);
  }

  /**
   * Shuffle a zone (randomize card order).
   */
  shuffle(key: string): void {
    const zone = this.zones.get(key);
    if (!zone) return;
    for (let i = zone.cards.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [zone.cards[i], zone.cards[j]] = [zone.cards[j], zone.cards[i]];
    }
  }

  /**
   * Get zone keys visible to a player based on visibility rules.
   */
  getVisibleZones(playerId: PlayerId): string[] {
    const visible: string[] = [];
    for (const [key, zone] of this.zones) {
      if (zone.definition.visibility === "all") {
        visible.push(key);
      } else if (zone.definition.visibility === "owner" && zone.playerId === playerId) {
        visible.push(key);
      }
      // "none" zones are never visible
    }
    return visible;
  }

  clear(): void {
    this.zones.clear();
  }

  /**
   * Get the number of cards in a zone.
   */
  getZoneSize(key: string): number {
    return this.zones.get(key)?.cards.length ?? 0;
  }

  /**
   * Check if a zone has any cards.
   */
  isEmpty(key: string): boolean {
    return (this.zones.get(key)?.cards.length ?? 0) === 0;
  }

  /**
   * Check if a zone exists.
   */
  hasZone(key: string): boolean {
    return this.zones.has(key);
  }

  /**
   * Get cards visible to a player, respecting zone visibility rules.
   */
  getVisibleCards(zoneKey: string, playerId: PlayerId): CardInstanceId[] {
    const zone = this.zones.get(zoneKey);
    if (!zone) return [];
    const vis = zone.definition.visibility;
    if (vis === "all") return zone.cards;
    if (vis === "owner" && zone.playerId === playerId) return zone.cards;
    return [];
  }

  /**
   * Get all zone keys.
   */
  getAllZoneKeys(): string[] {
    return Array.from(this.zones.keys());
  }

  /**
   * List all global zones.
   */
  listGlobalZones(): ZoneState[] {
    const result: ZoneState[] = [];
    for (const [key, zone] of this.zones) {
      if (key.startsWith("global:")) {
        result.push(zone);
      }
    }
    return result;
  }

  /**
   * List all zones owned by a specific player.
   */
  listPlayerZones(playerId: PlayerId): ZoneState[] {
    const result: ZoneState[] = [];
    for (const [key, zone] of this.zones) {
      if (zone.playerId === playerId) {
        result.push(zone);
      }
    }
    return result;
  }

  /**
   * Replace all cards in a zone (e.g., for initial deck setup).
   */
  setCards(key: string, cardIds: CardInstanceId[]): boolean {
    const zone = this.zones.get(key);
    if (!zone) return false;
    if (zone.definition.maxSize && cardIds.length > zone.definition.maxSize) {
      return false;
    }
    zone.cards = [...cardIds];
    return true;
  }
}
