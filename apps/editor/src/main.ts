import { createInitialState } from "./state.js";
import { buildLayout, render } from "./renderer.js";
import { saveEditorState, loadEditorState, clearEditorState } from "./persistence.js";

function main(): void {
  const state = createInitialState();

  const saved = loadEditorState();
  if (saved) {
    state.deckId = saved.deckId ?? "";
    state.deckName = saved.deckName ?? "";
    state.cards = saved.cards ?? [];
    state.characters = saved.characters ?? [];
  }

  let saveTimer: ReturnType<typeof setTimeout> | null = null;

  function autoSave(): void {
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      saveEditorState(state, () => {
        const indicator = elements.statusBar.querySelector("#save-indicator") as HTMLElement | null;
        if (indicator) {
          indicator.textContent = `已保存 ${new Date().toLocaleTimeString()}`;
          indicator.style.color = "#3fb950";
        }
      });
    }, 1000);
  }

  const elements = buildLayout(state, () => {
    render(state, elements);
    autoSave();
  });

  render(state, elements);

  const clearBtn = elements.statusBar.querySelector("#clear-btn") as HTMLButtonElement | null;
  if (clearBtn) {
    clearBtn.onclick = () => {
      if (confirm("确定要清空所有编辑数据吗？此操作不可撤销。")) {
        clearEditorState();
        state.cards.length = 0;
        state.characters.length = 0;
        state.editingCard = null;
        state.editingChar = null;
        state.deckId = "";
        state.deckName = "";
        render(state, elements);
      }
    };
  }

  const importInput = elements.statusBar.querySelector("#import-file-input") as HTMLInputElement | null;
  if (importInput) {
    importInput.addEventListener("change", () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        try {
          const json = JSON.parse(reader.result as string) as Record<string, unknown>;
          if (json.cards && Array.isArray(json.cards)) {
            state.cards = [...state.cards, ...json.cards as typeof state.cards];
          }
          if (json.characters && Array.isArray(json.characters)) {
            state.characters = [...state.characters, ...json.characters as typeof state.characters];
          }
          if (json.manifest && typeof json.manifest === "object") {
            const manifest = json.manifest as Record<string, unknown>;
            if (typeof manifest.id === "string" && !state.deckId) state.deckId = manifest.id;
            if (typeof manifest.name === "string" && !state.deckName) state.deckName = manifest.name;
          }
          render(state, elements);
        } catch {
          alert("JSON 文件格式无效，请检查文件内容。");
        }
      };
      reader.readAsText(file);
      importInput.value = "";
    });
  }
}

main();