import type { CardEditorData, CharacterEditorData } from "./editor.js";
import { cardToJSON, characterToJSON, buildDeckExport, downloadJSON, validateCardId, validateCharId } from "./editor.js";
import type { EditorState } from "./state.js";
import {
  CATEGORIES,
  CATEGORY_LABELS,
  FACTIONS,
  FACTION_LABELS,
  EFFECT_TYPES,
  SKILL_TYPES,
  SKILL_TYPE_LABELS,
  addCard,
  addCharacter,
  deleteCard,
  deleteCharacter,
  getExistingCardIds,
  getExistingCharIds,
} from "./state.js";

function h(tag: string, attrs: Record<string, string> = {}, children: (Node | string)[] = []): HTMLElement {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  for (const child of children) {
    if (typeof child === "string") {
      el.appendChild(document.createTextNode(child));
    } else {
      el.appendChild(child);
    }
  }
  return el;
}

function buttonStyle(bg: string): string {
  return `background:${bg};color:#fff;border:none;border-radius:4px;padding:4px 10px;cursor:pointer;font-size:12px;`;
}

function formField(label: string, type: string, value: string, onChange: (v: string) => void): HTMLElement {
  const div = h("div", { style: "margin-bottom:8px;" });
  div.appendChild(h("label", { style: "display:block;font-size:12px;color:#8b949e;margin-bottom:3px;" }, [label]));
  const input = h("input", {
    type,
    value,
    style: "width:100%;padding:6px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:13px;",
  });
  input.addEventListener("input", () => onChange((input as HTMLInputElement).value));
  div.appendChild(input);
  return div;
}

function formFieldWithValidation(
  label: string,
  value: string,
  onChange: (v: string) => void,
  validate: (v: string) => string | null
): HTMLElement {
  const div = h("div", { style: "margin-bottom:8px;" });
  div.appendChild(h("label", { style: "display:block;font-size:12px;color:#8b949e;margin-bottom:3px;" }, [label]));
  const input = h("input", {
    type: "text",
    value,
    style: "width:100%;padding:6px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:13px;",
  });
  const errorEl = h("div", { style: "font-size:11px;color:#da3633;margin-top:2px;min-height:14px;" }, []);
  const updateValidation = () => {
    const err = validate((input as HTMLInputElement).value);
    if (err) {
      errorEl.textContent = err;
      input.style.borderColor = "#da3633";
    } else {
      errorEl.textContent = "";
      input.style.borderColor = "#30363d";
    }
  };
  input.addEventListener("input", () => {
    onChange((input as HTMLInputElement).value);
    updateValidation();
  });
  div.appendChild(input);
  div.appendChild(errorEl);
  setTimeout(updateValidation, 0);
  return div;
}

function formFieldSmall(label: string, type: string, value: string, onChange: (v: string) => void): HTMLElement {
  const div = h("div", { style: "margin-bottom:4px;" });
  div.appendChild(h("label", { style: "display:block;font-size:11px;color:#6e7681;margin-bottom:2px;" }, [label]));
  const input = h("input", {
    type,
    value,
    style: "width:100%;padding:4px 6px;background:#0d1117;border:1px solid #30363d;border-radius:3px;color:#c9d1d9;font-size:12px;",
  });
  input.addEventListener("input", () => onChange((input as HTMLInputElement).value));
  div.appendChild(input);
  return div;
}

function formSelect(label: string, options: string[], labels: Record<string, string>, value: string, onChange: (v: string) => void): HTMLElement {
  const div = h("div", { style: "margin-bottom:8px;" });
  div.appendChild(h("label", { style: "display:block;font-size:12px;color:#8b949e;margin-bottom:3px;" }, [label]));
  const sel = h("select", {
    style: "width:100%;padding:6px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:13px;",
  });
  for (const opt of options) {
    const o = h("option", { value: opt }, [labels[opt] ?? opt]);
    if (opt === value) o.selected = true;
    sel.appendChild(o);
  }
  sel.addEventListener("change", () => onChange(sel.value));
  div.appendChild(sel);
  return div;
}

function buildCardEditor(state: EditorState, rerender: () => void): HTMLElement {
  const editingCard = state.editingCard;
  if (!editingCard) {
    return h("div", { style: "padding:20px;color:#6e7681;" }, ["请选择或创建一张卡牌"]);
  }

  const div = h("div", { style: "padding:12px;overflow-y:auto;height:100%;" });

  div.appendChild(formFieldWithValidation("ID", editingCard.id, (v) => (editingCard.id = v), (v) => {
    const idx = state.cards.indexOf(editingCard);
    const existingIds = getExistingCardIds(state, idx >= 0 ? idx : undefined);
    return validateCardId(v, existingIds);
  }));
  div.appendChild(formField("名称", "text", editingCard.name, (v) => (editingCard.name = v)));
  div.appendChild(formSelect("类别", CATEGORIES, CATEGORY_LABELS, editingCard.category, (v) => (editingCard.category = v)));
  div.appendChild(formField("数量", "number", String(editingCard.count), (v) => {
    const n = parseInt(v) || 1;
    editingCard.count = Math.max(1, n);
  }));
  div.appendChild(formField("描述", "text", editingCard.description, (v) => (editingCard.description = v)));

  const effectsHeader = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin:12px 0 6px 0;" }, [
    h("span", { style: "font-weight:bold;font-size:14px;color:#c9d1d9;" }, ["效果列表"]),
    h("button", { style: buttonStyle("#1f6feb") }, ["+ 添加效果"]),
  ]);
  effectsHeader.querySelector("button")!.onclick = () => {
    editingCard.effects.push({ id: "", name: "", type: "damage", params: {}, script: "" });
    rerender();
  };
  div.appendChild(effectsHeader);

  for (let ei = 0; ei < editingCard.effects.length; ei++) {
    const eff = editingCard.effects[ei];
    const effDiv = h("div", { style: "background:#161b22;padding:8px;margin-bottom:6px;border-radius:6px;" });

    effDiv.appendChild(h("div", { style: "display:flex;justify-content:space-between;margin-bottom:4px;" }, [
      h("span", { style: "font-size:12px;color:#8b949e;" }, [`效果 ${ei + 1}`]),
      h("button", { style: buttonStyle("#da3633") + "font-size:11px;padding:2px 6px;" }, ["×"]),
    ]));
    effDiv.querySelectorAll("button")[0].onclick = () => {
      editingCard.effects.splice(ei, 1);
      rerender();
    };

    effDiv.appendChild(formFieldSmall("ID", "text", eff.id, (v) => (eff.id = v)));
    effDiv.appendChild(formFieldSmall("名称", "text", eff.name, (v) => (eff.name = v)));
    effDiv.appendChild(formSelect("类型", EFFECT_TYPES, EFFECT_TYPES.reduce((acc, t) => ({ ...acc, [t]: t }), {}), eff.type, (v) => (eff.type = v)));
    effDiv.appendChild(formFieldSmall("脚本路径", "text", eff.script, (v) => (eff.script = v)));

    div.appendChild(effDiv);
  }

  const deleteBtn = h("button", { style: buttonStyle("#da3633") + "margin-top:12px;" }, ["删除此卡牌"]);
  deleteBtn.onclick = () => {
    deleteCard(state, editingCard);
    rerender();
  };
  div.appendChild(deleteBtn);

  return div;
}

function buildCharEditor(state: EditorState, rerender: () => void): HTMLElement {
  const editingChar = state.editingChar;
  if (!editingChar) {
    return h("div", { style: "padding:20px;color:#6e7681;" }, ["请选择或创建一个角色"]);
  }

  const div = h("div", { style: "padding:12px;overflow-y:auto;height:100%;" });

  div.appendChild(formFieldWithValidation("ID", editingChar.id, (v) => (editingChar.id = v), (v) => {
    const idx = state.characters.indexOf(editingChar);
    const existingIds = getExistingCharIds(state, idx >= 0 ? idx : undefined);
    return validateCharId(v, existingIds);
  }));
  div.appendChild(formField("名称", "text", editingChar.name, (v) => (editingChar.name = v)));
  div.appendChild(formSelect("势力", FACTIONS, FACTION_LABELS, editingChar.faction, (v) => (editingChar.faction = v)));
  div.appendChild(formField("体力上限", "number", String(editingChar.maxHp), (v) => {
    const n = parseInt(v) || 1;
    editingChar.maxHp = Math.max(1, n);
    editingChar.hp = editingChar.maxHp;
  }));

  const skillsHeader = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin:12px 0 6px 0;" }, [
    h("span", { style: "font-weight:bold;font-size:14px;color:#c9d1d9;" }, ["技能列表"]),
    h("button", { style: buttonStyle("#1f6feb") }, ["+ 添加技能"]),
  ]);
  skillsHeader.querySelector("button")!.onclick = () => {
    editingChar.skills.push({ id: "", name: "", effect: "", type: "active", description: "" });
    rerender();
  };
  div.appendChild(skillsHeader);

  for (let si = 0; si < editingChar.skills.length; si++) {
    const skill = editingChar.skills[si];
    const skillDiv = h("div", { style: "background:#161b22;padding:8px;margin-bottom:6px;border-radius:6px;" });

    skillDiv.appendChild(h("div", { style: "display:flex;justify-content:space-between;margin-bottom:4px;" }, [
      h("span", { style: "font-size:12px;color:#8b949e;" }, [`技能 ${si + 1}`]),
      h("button", { style: buttonStyle("#da3633") + "font-size:11px;padding:2px 6px;" }, ["×"]),
    ]));
    skillDiv.querySelectorAll("button")[0].onclick = () => {
      editingChar.skills.splice(si, 1);
      rerender();
    };

    skillDiv.appendChild(formFieldSmall("ID", "text", skill.id, (v) => (skill.id = v)));
    skillDiv.appendChild(formFieldSmall("名称", "text", skill.name, (v) => (skill.name = v)));
    skillDiv.appendChild(formFieldSmall("描述", "text", skill.description, (v) => (skill.description = v)));
    skillDiv.appendChild(formFieldSmall("效果引用", "text", skill.effect, (v) => (skill.effect = v)));
    skillDiv.appendChild(formSelect("类型", SKILL_TYPES, SKILL_TYPE_LABELS, skill.type, (v) => (skill.type = v)));

    div.appendChild(skillDiv);
  }

  const deleteBtn = h("button", { style: buttonStyle("#da3633") + "margin-top:12px;" }, ["删除此角色"]);
  deleteBtn.onclick = () => {
    deleteCharacter(state, editingChar);
    rerender();
  };
  div.appendChild(deleteBtn);

  return div;
}

function buildPreview(state: EditorState): HTMLElement {
  let text = "";
  if (state.activeTab === "cards" && state.editingCard) {
    text = cardToJSON(state.editingCard);
  } else if (state.activeTab === "characters" && state.editingChar) {
    text = characterToJSON(state.editingChar);
  }

  const div = h("div", {
    style: "height:100%;display:flex;flex-direction:column;",
  });

  const header = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;" }, [
    h("span", { style: "font-weight:bold;font-size:13px;color:#58a6ff;" }, ["JSON 预览"]),
    h("button", { style: buttonStyle("#1f6feb") }, ["导出卡组"]),
  ]);
  header.querySelector("button")!.onclick = () => {
    const json = buildDeckExport(state.cards, state.characters, state.deckId || undefined, state.deckName || undefined);
    downloadJSON(json, `${state.deckId || "cardverse-deck"}.json`);
  };
  div.appendChild(header);

  const deckIdInput = h("div", { style: "margin-bottom:8px;" });
  deckIdInput.appendChild(h("label", { style: "display:block;font-size:12px;color:#8b949e;margin-bottom:3px;" }, ["卡组 ID"]));
  const idField = h("input", {
    type: "text",
    value: state.deckId,
    placeholder: "custom-deck",
    style: "width:100%;padding:6px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:13px;",
  });
  idField.addEventListener("input", () => (state.deckId = (idField as HTMLInputElement).value));
  deckIdInput.appendChild(idField);
  div.appendChild(deckIdInput);

  const deckNameInput = h("div", { style: "margin-bottom:8px;" });
  deckNameInput.appendChild(h("label", { style: "display:block;font-size:12px;color:#8b949e;margin-bottom:3px;" }, ["卡组名称"]));
  const nameField = h("input", {
    type: "text",
    value: state.deckName,
    placeholder: "自定义卡组",
    style: "width:100%;padding:6px 8px;background:#0d1117;border:1px solid #30363d;border-radius:4px;color:#c9d1d9;font-size:13px;",
  });
  nameField.addEventListener("input", () => (state.deckName = (nameField as HTMLInputElement).value));
  deckNameInput.appendChild(nameField);
  div.appendChild(deckNameInput);

  const pre = h("pre", {
    style: "flex:1;background:#161b22;padding:12px;border-radius:6px;overflow:auto;font-size:12px;line-height:1.5;color:#7ee787;white-space:pre-wrap;word-break:break-all;",
  });
  pre.textContent = text || "{}";
  div.appendChild(pre);

  return div;
}

function buildCardList(state: EditorState, rerender: () => void): HTMLElement {
  const div = h("div", {
    style: "flex:1;overflow-y:auto;border-right:1px solid #21262d;padding:8px;min-width:200px;",
  });

  const header = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;" }, [
    h("span", { style: "font-weight:bold;color:#58a6ff;" }, ["卡牌列表"]),
    h("button", { style: buttonStyle("#238636") }, ["+ 新卡牌"]),
  ]);
  header.querySelector("button")!.onclick = () => {
    addCard(state);
    rerender();
  };
  div.appendChild(header);

  const list = h("div", {});
  list.id = "card-list-inner";
  div.appendChild(list);

  return div;
}

function buildCharList(state: EditorState, rerender: () => void): HTMLElement {
  const div = h("div", {
    style: "flex:1;overflow-y:auto;border-right:1px solid #21262d;padding:8px;min-width:200px;",
  });

  const header = h("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;" }, [
    h("span", { style: "font-weight:bold;color:#58a6ff;" }, ["角色列表"]),
    h("button", { style: buttonStyle("#7c3aed") }, ["+ 新角色"]),
  ]);
  header.querySelector("button")!.onclick = () => {
    addCharacter(state);
    rerender();
  };
  div.appendChild(header);

  const list = h("div", {});
  list.id = "char-list-inner";
  div.appendChild(list);

  return div;
}

function renderCardList(state: EditorState, cardListEl: HTMLElement, rerender: () => void): void {
  const list = cardListEl.querySelector("#card-list-inner")!;
  list.innerHTML = "";

  for (const card of state.cards) {
    const item = h("div", {
      style: `padding:6px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;font-size:13px;${state.editingCard === card ? "background:#1f6feb;color:#fff;" : "background:#161b22;color:#c9d1d9;"}`,
    });
    item.textContent = card.name || card.id || "(未命名)";
    item.onclick = () => {
      state.editingCard = card;
      state.editingChar = null;
      rerender();
    };
    list.appendChild(item);
  }
}

function renderCharList(state: EditorState, charListEl: HTMLElement, rerender: () => void): void {
  const list = charListEl.querySelector("#char-list-inner")!;
  list.innerHTML = "";

  for (const char of state.characters) {
    const item = h("div", {
      style: `padding:6px 8px;margin-bottom:3px;border-radius:4px;cursor:pointer;font-size:13px;${state.editingChar === char ? "background:#7c3aed;color:#fff;" : "background:#161b22;color:#c9d1d9;"}`,
    });
    item.textContent = char.name || char.id || "(未命名)";
    item.onclick = () => {
      state.editingChar = char;
      state.editingCard = null;
      rerender();
    };
    list.appendChild(item);
  }
}

function buildTabs(state: EditorState, rerender: () => void): HTMLElement {
  const div = h("div", {
    style: "display:flex;border-bottom:1px solid #21262d;",
  });

  const cardTab = h("div", {
    "data-tab": "cards",
    style: "flex:1;padding:8px 16px;text-align:center;cursor:pointer;font-size:14px;background:#1f6feb;color:#fff;border-radius:0;",
  }, ["卡牌编辑器"]);
  cardTab.onclick = () => {
    state.activeTab = "cards";
    rerender();
  };

  const charTab = h("div", {
    "data-tab": "characters",
    style: "flex:1;padding:8px 16px;text-align:center;cursor:pointer;font-size:14px;background:#21262d;color:#c9d1d9;border-radius:0;",
  }, ["角色编辑器"]);
  charTab.onclick = () => {
    state.activeTab = "characters";
    rerender();
  };

  div.appendChild(cardTab);
  div.appendChild(charTab);
  return div;
}

export interface EditorElements {
  tabs: HTMLElement;
  cardListEl: HTMLElement;
  charListEl: HTMLElement;
  editorPanel: HTMLElement;
  previewEl: HTMLElement;
}

export function buildLayout(state: EditorState, rerender: () => void): EditorElements {
  const app = document.getElementById("app")!;
  app.innerHTML = "";

  const container = h("div", {
    style: "display:flex;flex-direction:column;height:100vh;",
  });

  const tabsEl = buildTabs(state, rerender);
  container.appendChild(tabsEl);

  const body = h("div", {
    style: "display:flex;flex:1;overflow:hidden;",
  });

  const cardListEl = buildCardList(state, rerender);
  const charListEl = buildCharList(state, rerender);

  body.appendChild(cardListEl);
  body.appendChild(charListEl);

  const editorPanel = h("div", {
    style: "flex:2;overflow-y:auto;",
  });
  body.appendChild(editorPanel);

  const previewEl = h("div", {
    style: "flex:2;border-left:1px solid #21262d;padding:12px;overflow-y:auto;",
  });
  body.appendChild(previewEl);

  container.appendChild(body);
  app.appendChild(container);

  return { tabs: tabsEl, cardListEl, charListEl, editorPanel, previewEl };
}

export function render(state: EditorState, elements: EditorElements): void {
  const { tabs, cardListEl, charListEl, editorPanel, previewEl } = elements;

  const listPanel = state.activeTab === "cards" ? cardListEl : charListEl;
  const otherPanel = state.activeTab === "cards" ? charListEl : cardListEl;
  listPanel.style.display = "";
  otherPanel.style.display = "none";

  if (state.activeTab === "cards") {
    (tabs.querySelector('[data-tab="cards"]') as HTMLElement).style.background = "#1f6feb";
    (tabs.querySelector('[data-tab="characters"]') as HTMLElement).style.background = "#21262d";
    renderCardList(state, cardListEl, () => render(state, elements));
  } else {
    (tabs.querySelector('[data-tab="cards"]') as HTMLElement).style.background = "#21262d";
    (tabs.querySelector('[data-tab="characters"]') as HTMLElement).style.background = "#7c3aed";
    renderCharList(state, charListEl, () => render(state, elements));
  }

  editorPanel.innerHTML = "";
  editorPanel.appendChild(
    state.activeTab === "cards"
      ? buildCardEditor(state, () => render(state, elements))
      : buildCharEditor(state, () => render(state, elements))
  );

  previewEl.innerHTML = "";
  previewEl.appendChild(buildPreview(state));
}