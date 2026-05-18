import type { ValidationResult, ValidationError, ValidationWarning } from "./types.js";

/**
 * DeckValidator — validates deck manifest and card definitions.
 */
export class DeckValidator {
  validate(json: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    // Validate manifest
    if (!json.manifest || typeof json.manifest !== "object") {
      errors.push({ code: "MISSING_MANIFEST", message: "Deck must have a manifest object" });
      return { valid: false, errors, warnings };
    }

    const manifest = json.manifest as Record<string, unknown>;
    if (!manifest.id) errors.push({ code: "MISSING_ID", message: "Manifest must have an id", path: "manifest.id" });
    if (!manifest.name) errors.push({ code: "MISSING_NAME", message: "Manifest must have a name", path: "manifest.name" });
    if (!manifest.version) errors.push({ code: "MISSING_VERSION", message: "Manifest must have a version", path: "manifest.version" });
    if (!manifest.author) warnings.push({ code: "MISSING_AUTHOR", message: "Manifest has no author", path: "manifest.author" });

    const minPlayers = manifest.minPlayers as number;
    const maxPlayers = manifest.maxPlayers as number;
    if (!minPlayers || minPlayers < 1) errors.push({ code: "INVALID_MIN_PLAYERS", message: "minPlayers must be >= 1", path: "manifest.minPlayers" });
    if (!maxPlayers || maxPlayers < (minPlayers ?? 1)) errors.push({ code: "INVALID_MAX_PLAYERS", message: "maxPlayers must be >= minPlayers", path: "manifest.maxPlayers" });

    // Validate rules
    if (!json.rules || typeof json.rules !== "object") {
      errors.push({ code: "MISSING_RULES", message: "Deck must have a rules object" });
    } else {
      const rules = json.rules as Record<string, unknown>;
      if (!rules.zones || !Array.isArray(rules.zones)) {
        errors.push({ code: "MISSING_ZONES", message: "Rules must define zones" });
      }
      if (!rules.phases || !Array.isArray(rules.phases)) {
        errors.push({ code: "MISSING_PHASES", message: "Rules must define phases" });
      }
    }

    // Validate cards
    if (json.cards && Array.isArray(json.cards)) {
      for (let i = 0; i < (json.cards as any[]).length; i++) {
        const card = (json.cards as any[])[i];
        if (!card.id) {
          warnings.push({ code: "CARD_MISSING_ID", message: `Card at index ${i} has no id, skipping` });
        }
        if (!card.name) {
          warnings.push({ code: "CARD_MISSING_NAME", message: `Card "${card.id ?? `at index ${i}`}" has no name` });
        }
        if (!card.category) warnings.push({ code: "CARD_MISSING_CATEGORY", message: `Card "${card.id}" has no category` });
      }
    }

    return { valid: errors.length === 0, errors, warnings };
  }
}
