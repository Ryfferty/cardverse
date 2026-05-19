import type { CardDefinition, EffectContext } from "@cardverse/shared";

export interface CardEffectEditor {
  id: string;
  name: string;
  type: string;
  params: Record<string, unknown>;
  script: string;
}

export interface CardEditorData {
  id: string;
  name: string;
  category: string;
  count: number;
  description: string;
  effects: CardEffectEditor[];
}

export interface CharacterSkillEditor {
  id: string;
  name: string;
  effect: string;
  type: string;
  description: string;
}

export interface CharacterEditorData {
  id: string;
  name: string;
  faction: string;
  hp: number;
  maxHp: number;
  skills: CharacterSkillEditor[];
}

export function createEmptyCard(): CardEditorData {
  return {
    id: "",
    name: "",
    category: "basic",
    count: 1,
    description: "",
    effects: [],
  };
}

export function createEmptyCharacter(): CharacterEditorData {
  return {
    id: "",
    name: "",
    faction: "shu",
    hp: 4,
    maxHp: 4,
    skills: [],
  };
}

export function validateCardId(id: string, existingIds: Set<string>): string | null {
  if (!id.trim()) return "ID 不能为空";
  if (!/^[a-z][a-z0-9_]*$/.test(id)) return "ID 必须以小写字母开头，只能包含小写字母、数字和下划线";
  if (existingIds.has(id)) return `ID "${id}" 已存在`;
  return null;
}

export function validateCharId(id: string, existingIds: Set<string>): string | null {
  if (!id.trim()) return "ID 不能为空";
  if (!/^[a-z][a-z0-9_]*$/.test(id)) return "ID 必须以小写字母开头，只能包含小写字母、数字和下划线";
  if (existingIds.has(id)) return `ID "${id}" 已存在`;
  return null;
}

export function cardToJSON(card: CardEditorData): string {
  const effects = card.effects.map((e) => ({
    id: e.id,
    name: e.name,
    type: e.type,
    params: e.params,
    script: e.script,
  }));

  const obj: Record<string, unknown> = {
    id: card.id,
    name: card.name,
    category: card.category,
    count: card.count,
    effects,
    ...(card.description ? { description: card.description } : {}),
  };

  return JSON.stringify(obj, null, 2);
}

export function characterToJSON(char: CharacterEditorData): string {
  const obj: Record<string, unknown> = {
    id: char.id,
    name: char.name,
    faction: char.faction,
    hp: char.hp,
    maxHp: char.maxHp,
    skills: char.skills.map((s) => ({
      id: s.id,
      name: s.name,
      effect: s.effect,
      type: s.type,
      description: s.description,
    })),
  };

  return JSON.stringify(obj, null, 2);
}

export function buildDeckExport(
  cards: CardEditorData[],
  characters: CharacterEditorData[],
  deckId?: string,
  deckName?: string
): string {
  const result: Record<string, unknown> = {
    cards,
    characters,
    manifest: {
      id: deckId || "custom-deck",
      name: deckName || "自定义卡组",
      version: "1.0.0",
      created: new Date().toISOString(),
    },
  };

  return JSON.stringify(result, null, 2);
}

export function downloadJSON(data: string, filename: string): void {
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}