import { type Deck, type DeckManifest, type ValidationResult } from "./types.js";
import { DeckValidator } from "./validator.js";

/**
 * DeckLoader — loads deck definitions from various sources.
 */
export class DeckLoader {
  private validator = new DeckValidator();

  /**
   * Load a deck from a JSON object (already parsed).
   */
  loadFromJson(json: Record<string, unknown>): Deck {
    const manifest = json.manifest as DeckManifest;
    const validation = this.validator.validate(json);
    if (!validation.valid) {
      throw new Error(
        `Deck validation failed: ${validation.errors.map((e) => e.message).join(", ")}`
      );
    }
    return this.parseDeck(json);
  }

  /**
   * Load a deck from a local path (Node.js only).
   */
  async loadFromPath(path: string): Promise<Deck> {
    const fs = await import("node:fs/promises");
    const content = await fs.readFile(path, "utf-8");
    const json = JSON.parse(content);
    return this.loadFromJson(json);
  }

  /**
   * Validate a deck JSON without loading it.
   */
  validate(json: Record<string, unknown>): ValidationResult {
    return this.validator.validate(json);
  }

  private parseDeck(json: Record<string, unknown>): Deck {
    const manifest = json.manifest as DeckManifest;
    const rules = json.rules as any;
    const cardsJson = json.cards as any[] ?? [];
    const charactersJson = json.characters as any[] ?? [];

    const cards = new Map<string, any>();
    for (const card of cardsJson) {
      cards.set(card.id, card);
    }

    const effects = new Map<string, any>();
    for (const card of cardsJson) {
      if (card.effects) {
        for (const effect of card.effects) {
          effects.set(effect.id, effect);
        }
      }
    }

    const characters = charactersJson.map((c: any) => ({
      ...c,
      skills: c.skills ?? [],
    }));

    return {
      manifest,
      rules: {
        zones: rules?.zones ?? [],
        phases: rules?.phases ?? [],
        resources: rules?.resources ?? [],
        maxEffectSteps: rules?.maxEffectSteps,
        responseTimeout: rules?.responseTimeout,
        turnOrder: rules?.turnOrder ?? "clockwise",
      },
      cards,
      effects,
      phases: rules?.phases ?? [],
      winConditions: json.winConditions as any[] ?? [],
      drawConditions: json.drawConditions as any[] ?? [],
      ui: json.ui as any ?? { board: { type: "circular", playerAreas: { position: "auto", zones: [] }, sharedArea: { zones: [] } }, cardTemplate: { front: { layout: "classic", fields: [] }, back: {} } },
      characters,
    };
  }
}
