export interface DeckInfo {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
}

export class MainMenu {
  async show(): Promise<string | null> {
    const decks = await this.discoverDecks();

    if (decks.length === 0) {
      console.error("No decks found");
      return null;
    }

    return this.renderMenu(decks);
  }

  private async discoverDecks(): Promise<DeckInfo[]> {
    try {
      const indexResp = await fetch("/index.json");
      if (!indexResp.ok) {
        console.error("Failed to fetch deck index:", indexResp.status);
        return [];
      }
      const index = (await indexResp.json()) as { decks: string[] };
      const deckIds: string[] = index.decks ?? [];

      const deckInfos: DeckInfo[] = [];
      for (const id of deckIds) {
        try {
          const resp = await fetch(`/${id}/manifest.json`);
          if (!resp.ok) {
            console.warn(`Deck "${id}" manifest not found (${resp.status})`);
            continue;
          }
          const manifest = (await resp.json()) as Record<string, unknown>;
          const m = manifest.manifest as Record<string, unknown> | undefined;
          if (!m) {
            console.warn(`Deck "${id}" has no manifest section`);
            continue;
          }
          deckInfos.push({
            id: id,
            name: String(m.name ?? id),
            description: String(m.description ?? ""),
            minPlayers: Number(m.minPlayers ?? 2),
            maxPlayers: Number(m.maxPlayers ?? 8),
            tags: Array.isArray(m.tags) ? (m.tags as string[]) : [],
          });
        } catch (e) {
          console.warn(`Failed to load manifest for deck "${id}":`, e);
        }
      }
      return deckInfos;
    } catch (e) {
      console.error("Failed to discover decks:", e);
      return [];
    }
  }

  private renderMenu(decks: DeckInfo[]): Promise<string | null> {
    return new Promise((resolve) => {
      const overlay = document.createElement("div");
      overlay.id = "main-menu";
      overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #0a0a1a 0%, #1a1a2e 50%, #0a0a1a 100%);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 3000;
        font-family: Arial, sans-serif;
        overflow-y: auto;
      `;

      const title = document.createElement("h1");
      title.textContent = "CardVerse";
      title.style.cssText = `
        color: #ffcc44;
        font-size: 48px;
        margin: 0 0 8px;
        text-shadow: 0 0 20px rgba(255, 204, 68, 0.3);
      `;
      overlay.appendChild(title);

      const subtitle = document.createElement("p");
      subtitle.textContent = "\u901A\u7528\u5361\u724C\u6E38\u620F\u5F15\u64CE";
      subtitle.style.cssText = `
        color: #888;
        font-size: 16px;
        margin: 0 0 40px;
      `;
      overlay.appendChild(subtitle);

      const sectionLabel = document.createElement("p");
      sectionLabel.textContent = "\u9009\u62E9\u5361\u5305\u5F00\u59CB\u6E38\u620F";
      sectionLabel.style.cssText = `
        color: #aaa;
        font-size: 14px;
        margin: 0 0 20px;
      `;
      overlay.appendChild(sectionLabel);

      const deckList = document.createElement("div");
      deckList.style.cssText = `
        display: flex;
        gap: 20px;
        flex-wrap: wrap;
        justify-content: center;
        max-width: 800px;
        padding: 0 20px;
      `;

      decks.forEach((deck, idx) => {
        const card = document.createElement("div");
        card.setAttribute("role", "button");
        card.setAttribute("tabindex", "0");
        card.setAttribute("aria-label", deck.name);
        card.style.cssText = `
          background: rgba(255, 255, 255, 0.05);
          border: 2px solid rgba(255, 204, 68, 0.3);
          border-radius: 12px;
          padding: 24px;
          width: 280px;
          cursor: pointer;
          transition: all 0.2s;
          outline: none;
        `;

        const hoverIn = () => {
          card.style.borderColor = "#ffcc44";
          card.style.background = "rgba(255, 204, 68, 0.1)";
          card.style.transform = "translateY(-4px)";
        };
        const hoverOut = () => {
          card.style.borderColor = "rgba(255, 204, 68, 0.3)";
          card.style.background = "rgba(255, 255, 255, 0.05)";
          card.style.transform = "translateY(0)";
        };
        card.onmouseenter = hoverIn;
        card.onmouseleave = hoverOut;
        card.onfocus = hoverIn;
        card.onblur = hoverOut;

        const select = () => {
          cleanup();
          overlay.remove();
          resolve(deck.id);
        };
        card.onclick = select;

        const deckName = document.createElement("h3");
        deckName.textContent = deck.name;
        deckName.style.cssText = `
          color: #ffcc44;
          margin: 0 0 8px;
          font-size: 20px;
        `;
        card.appendChild(deckName);

        const deckDesc = document.createElement("p");
        deckDesc.textContent = deck.description;
        deckDesc.style.cssText = `
          color: #aaa;
          margin: 0 0 12px;
          font-size: 14px;
          line-height: 1.4;
        `;
        card.appendChild(deckDesc);

        const metaRow = document.createElement("div");
        metaRow.style.cssText = `
          display: flex;
          gap: 8px;
          align-items: center;
          flex-wrap: wrap;
        `;

        const playerRange = document.createElement("span");
        playerRange.textContent = `${deck.minPlayers}-${deck.maxPlayers} \u4EBA`;
        playerRange.style.cssText = `
          color: #888;
          font-size: 12px;
          background: rgba(255, 255, 255, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
        `;
        metaRow.appendChild(playerRange);

        for (const tag of deck.tags.slice(0, 3)) {
          const tagSpan = document.createElement("span");
          tagSpan.textContent = tag;
          tagSpan.style.cssText = `
            color: #666;
            font-size: 11px;
            background: rgba(255, 255, 255, 0.05);
            padding: 2px 6px;
            border-radius: 3px;
          `;
          metaRow.appendChild(tagSpan);
        }

        card.appendChild(metaRow);

        const shortcut = document.createElement("div");
        shortcut.textContent = `\u6309 ${idx + 1} \u9009\u62E9`;
        shortcut.style.cssText = `
          color: #555;
          font-size: 11px;
          margin-top: 10px;
        `;
        card.appendChild(shortcut);

        deckList.appendChild(card);
      });

      overlay.appendChild(deckList);

      const cancelBtn = document.createElement("button");
      cancelBtn.textContent = "\u9000\u51FA";
      cancelBtn.style.cssText = `
        margin-top: 40px;
        padding: 10px 24px;
        background: transparent;
        color: #666;
        border: 1px solid #444;
        border-radius: 8px;
        cursor: pointer;
        font-size: 14px;
        transition: all 0.2s;
      `;
      cancelBtn.onmouseenter = () => {
        cancelBtn.style.color = "#aaa";
        cancelBtn.style.borderColor = "#888";
      };
      cancelBtn.onmouseleave = () => {
        cancelBtn.style.color = "#666";
        cancelBtn.style.borderColor = "#444";
      };
      overlay.appendChild(cancelBtn);

      const cleanup = () => {
        document.removeEventListener("keydown", handleKeydown);
      };

      const handleKeydown = (e: KeyboardEvent) => {
        if (e.key === "Escape") {
          cleanup();
          overlay.remove();
          resolve(null);
          return;
        }
        const num = parseInt(e.key);
        if (num >= 1 && num <= decks.length) {
          cleanup();
          overlay.remove();
          resolve(decks[num - 1].id);
        }
      };
      document.addEventListener("keydown", handleKeydown);

      cancelBtn.onclick = () => {
        cleanup();
        overlay.remove();
        resolve(null);
      };

      document.body.appendChild(overlay);

      if (deckList.firstChild) {
        (deckList.firstChild as HTMLElement).focus();
      }
    });
  }
}
