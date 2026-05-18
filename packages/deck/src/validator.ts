import type {
  ValidationResult,
  ValidationError,
  ValidationWarning,
} from "./types.js";

const VALID_TURN_ORDERS = ["clockwise", "counterclockwise", "custom"] as const;
const VALID_WIN_TYPES = ["last-standing", "reach-score", "complete-objective", "custom"] as const;
const VALID_DRAW_TYPES = ["all-dead", "timeout", "custom"] as const;
const VALID_SKILL_TYPES = ["active", "passive", "locked", "awakening", "lord"] as const;

export class DeckValidator {
  validate(json: Record<string, unknown>): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationWarning[] = [];

    this.validateManifest(json, errors, warnings);
    this.validateRules(json, errors, warnings);
    this.validateCards(json, errors, warnings);
    this.validateCharacters(json, errors, warnings);
    this.validateWinConditions(json, errors, warnings);
    this.validateDrawConditions(json, errors, warnings);

    return { valid: errors.length === 0, errors, warnings };
  }

  private validateManifest(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.manifest || typeof json.manifest !== "object") {
      errors.push({
        code: "MANIFEST_MISSING",
        message: "Deck must have a manifest object",
      });
      return;
    }

    const m = json.manifest as Record<string, unknown>;

    if (!m.id || typeof m.id !== "string" || !m.id.trim()) {
      errors.push({
        code: "MANIFEST_INVALID_ID",
        message: "Manifest must have a non-empty string id",
        path: "manifest.id",
      });
    }

    if (!m.name || typeof m.name !== "string" || !m.name.trim()) {
      errors.push({
        code: "MANIFEST_INVALID_NAME",
        message: "Manifest must have a non-empty string name",
        path: "manifest.name",
      });
    }

    if (!m.version || typeof m.version !== "string" || !m.version.trim()) {
      errors.push({
        code: "MANIFEST_INVALID_VERSION",
        message: "Manifest must have a non-empty string version",
        path: "manifest.version",
      });
    }

    if (!m.author || typeof m.author !== "string" || !m.author.trim()) {
      warnings.push({
        code: "MANIFEST_MISSING_AUTHOR",
        message: "Manifest has no author",
        path: "manifest.author",
      });
    }

    const minPlayers = Number(m.minPlayers);
    if (typeof m.minPlayers !== "number" || !Number.isFinite(minPlayers) || minPlayers < 1) {
      errors.push({
        code: "MANIFEST_INVALID_MIN_PLAYERS",
        message: "minPlayers must be a number >= 1",
        path: "manifest.minPlayers",
      });
    }

    const maxPlayers = Number(m.maxPlayers);
    if (typeof m.maxPlayers !== "number" || !Number.isFinite(maxPlayers) || maxPlayers < minPlayers) {
      errors.push({
        code: "MANIFEST_INVALID_MAX_PLAYERS",
        message: "maxPlayers must be a number >= minPlayers",
        path: "manifest.maxPlayers",
      });
    }

    if (m.tags !== undefined && !Array.isArray(m.tags)) {
      warnings.push({
        code: "MANIFEST_INVALID_TAGS",
        message: "tags must be an array of strings",
        path: "manifest.tags",
      });
    }
  }

  private validateRules(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.rules || typeof json.rules !== "object") {
      errors.push({
        code: "RULES_MISSING",
        message: "Deck must have a rules object",
      });
      return;
    }

    const r = json.rules as Record<string, unknown>;

    if (!r.zones || !Array.isArray(r.zones) || (r.zones as unknown[]).length === 0) {
      errors.push({
        code: "RULES_MISSING_ZONES",
        message: "Rules must define at least one zone",
        path: "rules.zones",
      });
    } else {
      this.validateZones(r.zones as Record<string, unknown>[], errors, warnings);
    }

    if (!r.phases || !Array.isArray(r.phases) || (r.phases as unknown[]).length === 0) {
      errors.push({
        code: "RULES_MISSING_PHASES",
        message: "Rules must define at least one phase",
        path: "rules.phases",
      });
    } else {
      this.validatePhases(r.phases as Record<string, unknown>[], errors, warnings);
    }

    if (r.resources !== undefined && !Array.isArray(r.resources)) {
      errors.push({
        code: "RULES_INVALID_RESOURCES",
        message: "resources must be an array",
        path: "rules.resources",
      });
    } else if (r.resources) {
      this.validateResources(r.resources as Record<string, unknown>[], errors, warnings);
    }

    if (r.turnOrder && typeof r.turnOrder === "string") {
      if (!VALID_TURN_ORDERS.includes(r.turnOrder as typeof VALID_TURN_ORDERS[number])) {
        warnings.push({
          code: "RULES_UNKNOWN_TURN_ORDER",
          message: `Unknown turn order "${r.turnOrder}", expected one of: ${VALID_TURN_ORDERS.join(", ")}`,
          path: "rules.turnOrder",
        });
      }
    }

    if (r.maxEffectSteps !== undefined && typeof r.maxEffectSteps !== "number") {
      warnings.push({
        code: "RULES_INVALID_MAX_EFFECT_STEPS",
        message: "maxEffectSteps must be a number",
        path: "rules.maxEffectSteps",
      });
    }

    if (r.responseTimeout !== undefined && typeof r.responseTimeout !== "number") {
      warnings.push({
        code: "RULES_INVALID_RESPONSE_TIMEOUT",
        message: "responseTimeout must be a number (milliseconds)",
        path: "rules.responseTimeout",
      });
    }
  }

  private validateZones(
    zones: Record<string, unknown>[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const zoneIds = new Set<string>();
    for (let i = 0; i < zones.length; i++) {
      const z = zones[i];
      if (!z.id || typeof z.id !== "string") {
        errors.push({
          code: "ZONE_MISSING_ID",
          message: `Zone at index ${i} has no id`,
          path: `rules.zones[${i}].id`,
        });
        continue;
      }
      if (zoneIds.has(z.id)) {
        errors.push({
          code: "ZONE_DUPLICATE_ID",
          message: `Duplicate zone id "${z.id}"`,
          path: `rules.zones[${i}].id`,
        });
      }
      zoneIds.add(z.id);

      if (z.visibility && !["all", "owner", "none"].includes(z.visibility as string)) {
        warnings.push({
          code: "ZONE_UNKNOWN_VISIBILITY",
          message: `Zone "${z.id}" has unknown visibility "${z.visibility}"`,
          path: `rules.zones[${i}].visibility`,
        });
      }
    }
  }

  private validatePhases(
    phases: Record<string, unknown>[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const phaseIds = new Set<string>();
    for (let i = 0; i < phases.length; i++) {
      const p = phases[i];
      if (!p.id || typeof p.id !== "string") {
        errors.push({
          code: "PHASE_MISSING_ID",
          message: `Phase at index ${i} has no id`,
          path: `rules.phases[${i}].id`,
        });
        continue;
      }
      if (phaseIds.has(p.id)) {
        errors.push({
          code: "PHASE_DUPLICATE_ID",
          message: `Duplicate phase id "${p.id}"`,
          path: `rules.phases[${i}].id`,
        });
      }
      phaseIds.add(p.id);

      if (!p.name) {
        warnings.push({
          code: "PHASE_MISSING_NAME",
          message: `Phase "${p.id}" has no name`,
          path: `rules.phases[${i}].name`,
        });
      }
    }
  }

  private validateResources(
    resources: Record<string, unknown>[],
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    const resourceIds = new Set<string>();
    for (let i = 0; i < resources.length; i++) {
      const r = resources[i];
      if (!r.id || typeof r.id !== "string") {
        errors.push({
          code: "RESOURCE_MISSING_ID",
          message: `Resource at index ${i} has no id`,
          path: `rules.resources[${i}].id`,
        });
        continue;
      }
      if (resourceIds.has(r.id)) {
        errors.push({
          code: "RESOURCE_DUPLICATE_ID",
          message: `Duplicate resource id "${r.id}"`,
          path: `rules.resources[${i}].id`,
        });
      }
      resourceIds.add(r.id);

      if (r.defaultValue !== undefined && typeof r.defaultValue !== "number") {
        errors.push({
          code: "RESOURCE_INVALID_DEFAULT",
          message: `Resource "${r.id}" defaultValue must be a number`,
          path: `rules.resources[${i}].defaultValue`,
        });
      }

      if (r.min !== undefined && r.max !== undefined && (r.min as number) > (r.max as number)) {
        warnings.push({
          code: "RESOURCE_MIN_GT_MAX",
          message: `Resource "${r.id}" min > max`,
          path: `rules.resources[${i}]`,
        });
      }
    }
  }

  private validateCards(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.cards) return;
    if (!Array.isArray(json.cards)) {
      errors.push({
        code: "CARDS_NOT_ARRAY",
        message: "cards must be an array",
        path: "cards",
      });
      return;
    }

    const cardsArr = json.cards as Record<string, unknown>[];
    const cardIds = new Set<string>();

    for (let i = 0; i < cardsArr.length; i++) {
      const card = cardsArr[i];
      const path = `cards[${i}]`;

      if (!card.id || typeof card.id !== "string" || !card.id.trim()) {
        warnings.push({
          code: "CARD_MISSING_ID",
          message: `Card at index ${i} has no id, skipping`,
          path: `${path}.id`,
        });
        continue;
      }

      const id = card.id as string;
      if (cardIds.has(id)) {
        errors.push({
          code: "CARD_DUPLICATE_ID",
          message: `Duplicate card id "${id}"`,
          path: `${path}.id`,
        });
      }
      cardIds.add(id);

      if (!card.name || typeof card.name !== "string" || !card.name.trim()) {
        warnings.push({
          code: "CARD_MISSING_NAME",
          message: `Card "${id}" has no name`,
          path: `${path}.name`,
        });
      }

      if (!card.category || typeof card.category !== "string") {
        warnings.push({
          code: "CARD_MISSING_CATEGORY",
          message: `Card "${id}" has no category`,
          path: `${path}.category`,
        });
      }

      if (card.cost !== undefined && (typeof card.cost !== "number" || !Number.isFinite(card.cost as number) || (card.cost as number) < 0)) {
        warnings.push({
          code: "CARD_INVALID_COST",
          message: `Card "${id}" cost must be a non-negative number`,
          path: `${path}.cost`,
        });
      }

      if (card.count !== undefined && (typeof card.count !== "number" || !Number.isFinite(card.count as number) || (card.count as number) <= 0)) {
        warnings.push({
          code: "CARD_INVALID_COUNT",
          message: `Card "${id}" count must be a positive number`,
          path: `${path}.count`,
        });
      }

      if (card.tags !== undefined && !Array.isArray(card.tags)) {
        warnings.push({
          code: "CARD_INVALID_TAGS",
          message: `Card "${id}" tags must be an array`,
          path: `${path}.tags`,
        });
      }
    }
  }

  private validateCharacters(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.characters) return;
    if (!Array.isArray(json.characters)) {
      errors.push({
        code: "CHARACTERS_NOT_ARRAY",
        message: "characters must be an array",
        path: "characters",
      });
      return;
    }

    const charsArr = json.characters as Record<string, unknown>[];
    const charIds = new Set<string>();

    for (let i = 0; i < charsArr.length; i++) {
      const c = charsArr[i];
      const path = `characters[${i}]`;

      if (!c.id || typeof c.id !== "string" || !c.id.trim()) {
        errors.push({
          code: "CHARACTER_MISSING_ID",
          message: `Character at index ${i} has no id`,
          path: `${path}.id`,
        });
        continue;
      }

      const id = c.id as string;
      if (charIds.has(id)) {
        errors.push({
          code: "CHARACTER_DUPLICATE_ID",
          message: `Duplicate character id "${id}"`,
          path: `${path}.id`,
        });
      }
      charIds.add(id);

      if (!c.name || typeof c.name !== "string") {
        warnings.push({
          code: "CHARACTER_MISSING_NAME",
          message: `Character "${id}" has no name`,
          path: `${path}.name`,
        });
      }

      if (c.hp !== undefined && (typeof c.hp !== "number" || (c.hp as number) <= 0)) {
        errors.push({
          code: "CHARACTER_INVALID_HP",
          message: `Character "${id}" hp must be a positive number`,
          path: `${path}.hp`,
        });
      }

      if (c.maxHp !== undefined && (typeof c.maxHp !== "number" || (c.maxHp as number) <= 0)) {
        errors.push({
          code: "CHARACTER_INVALID_MAX_HP",
          message: `Character "${id}" maxHp must be a positive number`,
          path: `${path}.maxHp`,
        });
      }

      if (
        c.hp !== undefined &&
        c.maxHp !== undefined &&
        (c.hp as number) > (c.maxHp as number)
      ) {
        errors.push({
          code: "CHARACTER_HP_GT_MAX",
          message: `Character "${id}" hp (${c.hp}) exceeds maxHp (${c.maxHp})`,
          path: `${path}`,
        });
      }

      if (c.skills) {
        if (!Array.isArray(c.skills)) {
          errors.push({
            code: "CHARACTER_INVALID_SKILLS",
            message: `Character "${id}" skills must be an array`,
            path: `${path}.skills`,
          });
        } else {
          this.validateSkills(id, c.skills as Record<string, unknown>[], errors, warnings, path);
        }
      }
    }
  }

  private validateSkills(
    charId: string,
    skills: Record<string, unknown>[],
    errors: ValidationError[],
    warnings: ValidationWarning[],
    parentPath: string
  ): void {
    const skillIds = new Set<string>();
    for (let i = 0; i < skills.length; i++) {
      const s = skills[i];
      const path = `${parentPath}.skills[${i}]`;

      if (!s.id || typeof s.id !== "string" || !s.id.trim()) {
        errors.push({
          code: "SKILL_MISSING_ID",
          message: `Character "${charId}" skill at index ${i} has no id`,
          path: `${path}.id`,
        });
        continue;
      }

      const id = s.id as string;
      if (skillIds.has(id)) {
        warnings.push({
          code: "SKILL_DUPLICATE_ID",
          message: `Character "${charId}" has duplicate skill id "${id}"`,
          path: `${path}.id`,
        });
      }
      skillIds.add(id);

      if (!s.name) {
        warnings.push({
          code: "SKILL_MISSING_NAME",
          message: `Character "${charId}" skill "${id}" has no name`,
          path: `${path}.name`,
        });
      }

      if (s.type && typeof s.type === "string") {
        if (!VALID_SKILL_TYPES.includes(s.type as typeof VALID_SKILL_TYPES[number])) {
          warnings.push({
            code: "SKILL_UNKNOWN_TYPE",
            message: `Skill "${id}" has unknown type "${s.type}", expected: ${VALID_SKILL_TYPES.join(", ")}`,
            path: `${path}.type`,
          });
        }
      }

      if (!s.description) {
        warnings.push({
          code: "SKILL_MISSING_DESC",
          message: `Character "${charId}" skill "${id}" has no description`,
          path: `${path}.description`,
        });
      }
    }
  }

  private validateWinConditions(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.winConditions) return;
    if (!Array.isArray(json.winConditions)) {
      warnings.push({
        code: "WIN_NOT_ARRAY",
        message: "winConditions must be an array",
        path: "winConditions",
      });
      return;
    }

    const arr = json.winConditions as Record<string, unknown>[];
    for (let i = 0; i < arr.length; i++) {
      const wc = arr[i];
      const type = wc.type as string | undefined;
      if (!type || !VALID_WIN_TYPES.includes(type as typeof VALID_WIN_TYPES[number])) {
        warnings.push({
          code: "WIN_UNKNOWN_TYPE",
          message: `winCondition[${i}] has unknown type "${type ?? "undefined"}", expected: ${VALID_WIN_TYPES.join(", ")}`,
          path: `winConditions[${i}].type`,
        });
      }
    }
  }

  private validateDrawConditions(
    json: Record<string, unknown>,
    errors: ValidationError[],
    warnings: ValidationWarning[]
  ): void {
    if (!json.drawConditions) return;
    if (!Array.isArray(json.drawConditions)) {
      warnings.push({
        code: "DRAW_NOT_ARRAY",
        message: "drawConditions must be an array",
        path: "drawConditions",
      });
      return;
    }

    const arr = json.drawConditions as Record<string, unknown>[];
    for (let i = 0; i < arr.length; i++) {
      const dc = arr[i];
      const type = dc.type as string | undefined;
      if (!type || !VALID_DRAW_TYPES.includes(type as typeof VALID_DRAW_TYPES[number])) {
        warnings.push({
          code: "DRAW_UNKNOWN_TYPE",
          message: `drawCondition[${i}] has unknown type "${type ?? "undefined"}", expected: ${VALID_DRAW_TYPES.join(", ")}`,
          path: `drawConditions[${i}].type`,
        });
      }
    }
  }
}