import {
  type CardDefinition,
  type CardInstance,
  type ZoneDefinition,
  type PhaseDefinition,
  type ResourceDefinition,
} from "@cardverse/shared";

/** Signature info for a signed deck */
export interface SignatureInfo {
  algorithm: string;
  publicKey: string;
  signature: string;
  signedAt: string;
  signedBy: string;
}

/** Capability declaration for sandboxed execution */
export interface CapabilityDeclaration {
  filesystem: boolean;
  network: boolean;
  eval: boolean;
}

/** Deck manifest — the root configuration of a deck */
export interface DeckManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  frameworkVersion: string;
  tags: string[];
  signature?: SignatureInfo;
  capabilities?: CapabilityDeclaration;
}

/** Win condition definition */
export interface WinCondition {
  type: "last-standing" | "reach-score" | "complete-objective" | "custom";
  config?: Record<string, unknown>;
  /** For "custom" type: JS expression or script path */
  customCheck?: string;
}

/** Draw condition definition */
export interface DrawCondition {
  type: "all-dead" | "timeout" | "custom";
  config?: Record<string, unknown>;
}

/** Effect definition — hybrid (declarative + script) */
export interface EffectDefinition {
  id: string;
  name: string;
  /** Declarative part: predefined effect types */
  type?: string;
  params?: Record<string, unknown>;
  /** Script part: custom logic */
  script?: string;
  /** Can this card be played? */
  canPlay?: string; // JS expression
  /** Targets this card can affect */
  validTargets?: string; // JS expression or target type
}

/** Card group for organizing cards in the deck */
export interface CardGroup {
  id: string;
  name: string;
  cards: CardDefinition[];
}

/** UI template definition */
export interface UITemplate {
  board: BoardTemplate;
  cardTemplate: CardTemplate;
  handTemplate?: HandTemplate;
}

export interface BoardTemplate {
  type: "circular" | "grid" | "free";
  playerAreas: PlayerAreaTemplate;
  sharedArea: SharedAreaTemplate;
}

export interface PlayerAreaTemplate {
  position: string;
  zones: ZoneLayout[];
}

export interface SharedAreaTemplate {
  zones: ZoneLayout[];
}

export interface ZoneLayout {
  id: string;
  position: string;
  style: string;
}

export interface CardTemplate {
  front: CardFaceTemplate;
  back: { image?: string; color?: string };
}

export interface CardFaceTemplate {
  layout: string;
  fields: CardField[];
}

export interface CardField {
  id: string;
  position: string;
}

export interface HandTemplate {
  style: "fan" | "row" | "stack";
  maxVisible?: number;
}

/** Complete deck — loaded and ready to use */
export interface Deck {
  manifest: DeckManifest;
  rules: DeckRules;
  cards: Map<string, CardDefinition>;
  effects: Map<string, EffectDefinition>;
  phases: PhaseDefinition[];
  winConditions: WinCondition[];
  drawConditions: DrawCondition[];
  ui: UITemplate;
  characters?: CharacterDefinition[];
  instances?: CardInstance[];
}

/** Rules configuration for a deck */
export interface DeckRules {
  zones: ZoneDefinition[];
  phases: PhaseDefinition[];
  resources: ResourceDefinition[];
  maxEffectSteps?: number;
  responseTimeout?: number;
  turnOrder: "clockwise" | "counterclockwise" | "custom";
}

/** Character definition (for games with characters, like SanGuoSha) */
export interface CharacterDefinition {
  id: string;
  name: string;
  faction?: string;
  hp: number;
  maxHp: number;
  skills: SkillDefinition[];
  gender?: string;
  nation?: string;
}

/** Skill definition for a character */
export interface SkillDefinition {
  id: string;
  name: string;
  type: "active" | "passive" | "locked" | "awakening" | "lord";
  description: string;
  /** Script for skill logic */
  script?: string;
  /** Timing hook: when does this skill trigger? */
  trigger?: string;
}

/** Validation result */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  code: string;
  message: string;
  path?: string;
}

export interface ValidationWarning {
  code: string;
  message: string;
  path?: string;
}
