import type { EditorState } from "./state.js";
import type { CardEditorData, CharacterEditorData } from "./editor.js";

const STORAGE_KEY = "cardverse-editor-state";

interface PersistedState {
  deckId: string;
  deckName: string;
  cards: CardEditorData[];
  characters: CharacterEditorData[];
  savedAt: number;
}

export function saveEditorState(state: EditorState): void {
  try {
    const data: PersistedState = {
      deckId: state.deckId,
      deckName: state.deckName,
      cards: state.cards,
      characters: state.characters,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // localStorage may be full or unavailable
  }
}

export function loadEditorState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedState;
    if (!data || !Array.isArray(data.cards)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearEditorState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function getSavedTimestamp(): number | null {
  const data = loadEditorState();
  return data?.savedAt ?? null;
}