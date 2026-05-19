import type { CardDefinition } from "@cardverse/shared";

export function extractDefinitionId(cardInstanceId: string): string {
  const parts = cardInstanceId.split("_");
  return parts.length >= 2 ? parts[1] : cardInstanceId;
}

export interface RangeModifiers {
  weaponRange: number;
  mountOffense: number;
  mountDefense: number;
}

export class RangeManager {
  static calculateDistance(fromSeat: number, toSeat: number, totalPlayers: number): number {
    if (totalPlayers <= 2) return 1;
    const clockwise = (toSeat - fromSeat + totalPlayers) % totalPlayers;
    const counterclockwise = (fromSeat - toSeat + totalPlayers) % totalPlayers;
    const dist = Math.min(clockwise, counterclockwise);
    return dist === 0 ? 1 : dist;
  }

  static isInRange(
    baseDistance: number,
    weaponRange: number,
    mountOffense: number,
    mountDefense: number
  ): boolean {
    const effectiveDistance = Math.max(0, baseDistance + mountDefense - mountOffense);
    return effectiveDistance <= weaponRange;
  }

  static getEquipmentModifiers(equipmentCards: CardDefinition[]): RangeModifiers {
    const result: RangeModifiers = {
      weaponRange: 1,
      mountOffense: 0,
      mountDefense: 0,
    };

    for (const card of equipmentCards) {
      const tags = card.tags ?? [];

      if (tags.includes("weapon")) {
        for (const tag of tags) {
          const match = tag.match(/^range-(\d+)$/);
          if (match) {
            result.weaponRange = Math.max(result.weaponRange, parseInt(match[1], 10));
          }
        }
      }

      if (tags.includes("mount")) {
        if (tags.includes("defense")) result.mountDefense += 1;
        if (tags.includes("offense")) result.mountOffense += 1;
      }
    }

    return result;
  }

  static resolveEquipmentCards(
    equipmentCardIds: string[],
    cardDefinitions: Map<string, CardDefinition>
  ): CardDefinition[] {
    const result: CardDefinition[] = [];
    for (const cardId of equipmentCardIds) {
      const defId = extractDefinitionId(cardId);
      const def = cardDefinitions.get(defId);
      if (def && def.category === "equipment") {
        result.push(def);
      }
    }
    return result;
  }
}