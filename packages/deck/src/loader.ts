import {
  type CardInstance,
  type CardDefinition,
  type PlayerId,
  type ZoneId,
  type CardInstanceId,
} from "@cardverse/shared";
import {
  type Deck,
  type DeckManifest,
  type CharacterDefinition,
} from "./types.js";
import { DeckValidator } from "./validator.js";

export class DeckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeckError";
  }
}

export class DeckLoader {
  private validator = new DeckValidator();
  private instanceCounter = 0;

  loadFromJson(json: Record<string, unknown>): Deck {
    const validation = this.validator.validate(json);
    const errors = validation.errors;
    const _warnings = validation.warnings;

    if (!validation.valid) {
      const errorMessages = errors.map((e) => e.message).join("; ");
      throw new DeckError(`Deck validation failed: ${errorMessages}`);
    }

    return this.parseDeck(json);
  }

  async loadFromPath(path: string): Promise<Deck> {
    let content: string;
    try {
      const fs = await import("node:fs/promises");
      content = await fs.readFile(path, "utf-8");
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DeckError(`Failed to read deck file "${path}": ${msg}`);
    }

    let json: unknown;
    try {
      json = JSON.parse(content);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      throw new DeckError(`Invalid JSON in deck file "${path}": ${msg}`);
    }

    if (typeof json !== "object" || json === null || Array.isArray(json)) {
      throw new DeckError(`Deck file "${path}" must contain a JSON object`);
    }

    return this.loadFromJson(json as Record<string, unknown>);
  }

  validate(json: Record<string, unknown>): ReturnType<DeckValidator["validate"]> {
    return this.validator.validate(json);
  }

  private safeInt(value: number): number {
    return Number.isNaN(value) ? 0 : value;
  }

  private parseDeck(json: Record<string, unknown>): Deck {
    const manifest = this.parseManifest(json);
    const rules = this.parseRules(json);
    const cards = this.parseCards(json);
    const effects = this.parseEffects(json);
    const phases = rules.phases;
    const winConditions = this.parseWinConditions(json);
    const drawConditions = this.parseDrawConditions(json);
    const ui = this.parseUI(json);
    const characters = this.parseCharacters(json);
    const instances = this.instantiateCards(json);

    return {
      manifest,
      rules,
      cards,
      effects,
      phases,
      winConditions,
      drawConditions,
      ui,
      characters,
      instances,
    };
  }

  private parseManifest(json: Record<string, unknown>): DeckManifest {
    const m = json.manifest as Record<string, unknown>;
    if (!m) throw new DeckError("Missing manifest");

    return {
      id: String(m.id ?? ""),
      name: String(m.name ?? ""),
      version: String(m.version ?? ""),
      author: String(m.author ?? ""),
      description: String(m.description ?? ""),
      minPlayers: this.safeInt(Number(m.minPlayers ?? 0)),
      maxPlayers: this.safeInt(Number(m.maxPlayers ?? 0)),
      frameworkVersion: String(m.frameworkVersion ?? "1.0.0"),
      tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
      signature: m.signature as DeckManifest["signature"],
      capabilities: m.capabilities as DeckManifest["capabilities"],
    };
  }

  private parseRules(json: Record<string, unknown>): Deck["rules"] {
    const r = json.rules as Record<string, unknown> | undefined;
    if (!r) throw new DeckError("Missing rules");

    return {
      zones: Array.isArray(r.zones) ? (r.zones as Deck["rules"]["zones"]) : [],
      phases: Array.isArray(r.phases) ? (r.phases as Deck["rules"]["phases"]) : [],
      resources: Array.isArray(r.resources) ? (r.resources as Deck["rules"]["resources"]) : [],
      maxEffectSteps: r.maxEffectSteps as number | undefined,
      responseTimeout: r.responseTimeout as number | undefined,
      turnOrder: (r.turnOrder as Deck["rules"]["turnOrder"]) ?? "clockwise",
    };
  }

  private parseCards(json: Record<string, unknown>): Map<string, CardDefinition> {
    const cards = new Map<string, CardDefinition>();
    const cardsJson = json.cards;
    if (!Array.isArray(cardsJson)) return cards;

    for (let i = 0; i < cardsJson.length; i++) {
      const card = cardsJson[i] as Record<string, unknown>;
      const id = String(card.id ?? "").trim();
      if (!id) {
        console.warn(`DeckLoader: card at index ${i} has no valid id, skipping`);
        continue;
      }
      cards.set(id, {
        id,
        name: String(card.name ?? id),
        category: (card.category as CardDefinition["category"]) ?? "basic",
        description: card.description as string | undefined,
        cost: card.cost as number | undefined,
        tags: Array.isArray(card.tags) ? (card.tags as string[]) : undefined,
        effects: Array.isArray(card.effects)
          ? (card.effects as CardDefinition["effects"])
          : undefined,
      });
    }
    return cards;
  }

  private parseEffects(json: Record<string, unknown>): Deck["effects"] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const effects = new Map<string, Deck["effects"] extends Map<any, infer V> ? V : never>();
    const cardsJson = json.cards;
    if (!Array.isArray(cardsJson)) return effects as Deck["effects"];

    for (const card of cardsJson as Record<string, unknown>[]) {
      const cardEffects = card.effects;
      if (!Array.isArray(cardEffects)) continue;
      for (const effect of cardEffects) {
        const e = effect as Record<string, unknown>;
        const id = String(e.id ?? "").trim();
        if (!id) continue;
        if (effects.has(id)) {
          console.warn(`DeckLoader: duplicate effect id "${id}", overwriting`);
        }
        effects.set(id, {
          id,
          name: String(e.name ?? id),
          type: e.type as string | undefined,
          params: e.params as Record<string, unknown> | undefined,
          script: e.script as string | undefined,
          canPlay: e.canPlay as string | undefined,
          validTargets: e.validTargets as string | undefined,
        });
      }
    }
    return effects as Deck["effects"];
  }

  private parseWinConditions(json: Record<string, unknown>): Deck["winConditions"] {
    if (Array.isArray(json.winConditions)) return json.winConditions as Deck["winConditions"];
    return [];
  }

  private parseDrawConditions(json: Record<string, unknown>): Deck["drawConditions"] {
    if (Array.isArray(json.drawConditions)) return json.drawConditions as Deck["drawConditions"];
    return [];
  }

  private parseUI(json: Record<string, unknown>): Deck["ui"] {
    return (json.ui as Deck["ui"]) ?? {
      board: {
        type: "circular",
        playerAreas: { position: "auto", zones: [] },
        sharedArea: { zones: [] },
      },
      cardTemplate: {
        front: { layout: "classic", fields: [] },
        back: {},
      },
    };
  }

  private parseCharacters(json: Record<string, unknown>): CharacterDefinition[] | undefined {
    if (!Array.isArray(json.characters)) return undefined;
    const chars: CharacterDefinition[] = [];
    for (const c of json.characters as Record<string, unknown>[]) {
      chars.push({
        id: String(c.id ?? ""),
        name: String(c.name ?? ""),
        faction: c.faction as string | undefined,
        hp: Number(c.hp ?? 0),
        maxHp: Number(c.maxHp ?? 0),
        skills: Array.isArray(c.skills) ? (c.skills as CharacterDefinition["skills"]) : [],
        gender: c.gender as string | undefined,
        nation: c.nation as string | undefined,
      });
    }
    return chars.length > 0 ? chars : undefined;
  }

  instantiateCards(json: Record<string, unknown>): CardInstance[] {
    const cardsJson = json.cards;
    if (!Array.isArray(cardsJson)) return [];

    const instances: CardInstance[] = [];
    for (const card of cardsJson as Record<string, unknown>[]) {
      const id = String(card.id ?? "").trim();
      if (!id) continue;

      const count = Number(card.count ?? 1);
      const safeCount = Math.max(0, Math.min(count, 999));
      if (safeCount <= 0) continue;

      for (let i = 0; i < safeCount; i++) {
        const instanceId: CardInstanceId = `inst_${id}_${++this.instanceCounter}`;
        instances.push({
          instanceId,
          definitionId: id,
          owner: "" as PlayerId,
          zone: "deck" as ZoneId,
          faceUp: false,
          modifiers: [],
        });
      }
    }
    return instances;
  }
}