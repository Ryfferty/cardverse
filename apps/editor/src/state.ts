import type { CardEditorData, CharacterEditorData } from "./editor.js";
import { createEmptyCard, createEmptyCharacter, validateCardId, validateCharId } from "./editor.js";

export const CATEGORIES = ["basic", "trick", "equipment"];
export const CATEGORY_LABELS: Record<string, string> = {
  basic: "基本牌",
  trick: "锦囊牌",
  equipment: "装备牌",
};
export const FACTIONS = ["shu", "wei", "wu", "qun"];
export const FACTION_LABELS: Record<string, string> = {
  shu: "蜀",
  wei: "魏",
  wu: "吴",
  qun: "群",
};
export const EFFECT_TYPES = ["damage", "heal", "draw", "discard", "modifier", "counter", "chain", "judge", "convert", "equip"];
export const SKILL_TYPES = ["active", "passive", "trigger", "limited"];
export const SKILL_TYPE_LABELS: Record<string, string> = {
  active: "主动",
  passive: "被动",
  trigger: "触发",
  limited: "限定",
};

export interface EditorState {
  activeTab: "cards" | "characters";
  cards: CardEditorData[];
  characters: CharacterEditorData[];
  editingCard: CardEditorData | null;
  editingChar: CharacterEditorData | null;
  deckId: string;
  deckName: string;
}

export function createInitialState(): EditorState {
  return {
    activeTab: "cards",
    cards: [],
    characters: [],
    editingCard: null,
    editingChar: null,
    deckId: "",
    deckName: "",
  };
}

export function getExistingCardIds(state: EditorState, excludeIndex?: number): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < state.cards.length; i++) {
    if (i !== excludeIndex && state.cards[i].id.trim()) {
      ids.add(state.cards[i].id.trim());
    }
  }
  return ids;
}

export function getExistingCharIds(state: EditorState, excludeIndex?: number): Set<string> {
  const ids = new Set<string>();
  for (let i = 0; i < state.characters.length; i++) {
    if (i !== excludeIndex && state.characters[i].id.trim()) {
      ids.add(state.characters[i].id.trim());
    }
  }
  return ids;
}

export function validateEditingCard(state: EditorState): string | null {
  if (!state.editingCard) return null;
  const idx = state.cards.indexOf(state.editingCard);
  const existingIds = getExistingCardIds(state, idx);
  return validateCardId(state.editingCard.id, existingIds);
}

export function validateEditingChar(state: EditorState): string | null {
  if (!state.editingChar) return null;
  const idx = state.characters.indexOf(state.editingChar);
  const existingIds = getExistingCharIds(state, idx);
  return validateCharId(state.editingChar.id, existingIds);
}

export function addCard(state: EditorState): CardEditorData {
  const card = createEmptyCard();
  state.cards.push(card);
  state.editingCard = card;
  return card;
}

export function addCharacter(state: EditorState): CharacterEditorData {
  const char = createEmptyCharacter();
  state.characters.push(char);
  state.editingChar = char;
  return char;
}

export function deleteCard(state: EditorState, card: CardEditorData): void {
  const idx = state.cards.indexOf(card);
  if (idx >= 0) state.cards.splice(idx, 1);
  if (state.editingCard === card) state.editingCard = null;
}

export function deleteCharacter(state: EditorState, char: CharacterEditorData): void {
  const idx = state.characters.indexOf(char);
  if (idx >= 0) state.characters.splice(idx, 1);
  if (state.editingChar === char) state.editingChar = null;
}