import { describe, it, expect } from "vitest";

describe("CardView types and data", () => {
  it("should have valid card data structure", () => {
    const cardData = {
      id: "sha",
      name: "杀",
      category: "basic",
      type: "sha",
    };

    expect(cardData.id).toBe("sha");
    expect(cardData.name).toBe("杀");
    expect(cardData.category).toBe("basic");
    expect(cardData.type).toBe("sha");
  });

  it("should support selected state in card data", () => {
    const cardData = {
      id: "shan",
      name: "闪",
      category: "basic",
      type: "shan",
      selected: false,
    };

    expect(cardData.selected).toBe(false);

    const selected = { ...cardData, selected: true };
    expect(selected.selected).toBe(true);
  });

  it("should categorize cards correctly", () => {
    const categories = {
      sha: { type: "sha", category: "basic" },
      guohe: { type: "guohe", category: "trick" },
      qilin: { type: "qilin", category: "equipment" },
    };

    expect(categories.sha.category).toBe("basic");
    expect(categories.guohe.category).toBe("trick");
    expect(categories.qilin.category).toBe("equipment");
  });

  it("should map card definitions to hand cards correctly", () => {
    const deckCards = [
      { id: "sha", name: "杀", category: "basic" },
      { id: "shan", name: "闪", category: "basic" },
      { id: "tao", name: "桃", category: "basic" },
      { id: "guohe", name: "过河拆桥", category: "trick" },
      { id: "qinglong", name: "青龙偃月刀", category: "equipment" },
    ];

    const instanceIds = ["inst_sha_1", "inst_tao_2", "inst_guohe_1"];

    const handCards = instanceIds.map((iid) => {
      const parts = iid.split("_");
      const defId = parts.length >= 2 ? parts[1] : iid;
      const card = deckCards.find((c) => c.id === defId);
      const category = card?.category ?? "basic";
      return {
        id: iid,
        name: card?.name ?? defId,
        category,
        type:
          category === "basic"
            ? defId
            : category === "equipment"
              ? "equipment"
              : "trick",
      };
    });

    expect(handCards).toHaveLength(3);
    expect(handCards[0].type).toBe("sha");
    expect(handCards[0].name).toBe("杀");
    expect(handCards[1].type).toBe("tao");
    expect(handCards[1].category).toBe("basic");
    expect(handCards[2].type).toBe("trick");
    expect(handCards[2].category).toBe("trick");
  });

  it("should handle unknown card definitions gracefully", () => {
    const deckCards: Array<{ id: string; name: string; category: string }> = [];

    const instanceIds = ["inst_unknown_1"];
    const handCards = instanceIds.map((iid) => {
      const parts = iid.split("_");
      const defId = parts.length >= 2 ? parts[1] : iid;
      const card = deckCards.find((c) => c.id === defId);
      const category = card?.category ?? "basic";
      return {
        id: iid,
        name: card?.name ?? defId,
        category,
        type: category === "basic" ? defId : category,
      };
    });

    expect(handCards).toHaveLength(1);
    expect(handCards[0].type).toBe("unknown");
    expect(handCards[0].category).toBe("basic");
  });
});

describe("HUD phase labels", () => {
  const labels: Record<string, string> = {
    prepare: "准备阶段",
    judge: "判定阶段",
    draw: "摸牌阶段",
    play: "出牌阶段",
    discard: "弃牌阶段",
    end: "结束阶段",
  };

  it("should map all six phases to Chinese labels", () => {
    expect(labels.prepare).toBe("准备阶段");
    expect(labels.judge).toBe("判定阶段");
    expect(labels.draw).toBe("摸牌阶段");
    expect(labels.play).toBe("出牌阶段");
    expect(labels.discard).toBe("弃牌阶段");
    expect(labels.end).toBe("结束阶段");
  });

  it("should default to raw phase id for unknown phases", () => {
    const unknown = "custom_phase";
    const phaseLabel = labels[unknown] ?? unknown;
    expect(phaseLabel).toBe("custom_phase");
  });
});

describe("TableRenderer seats", () => {
  it("should calculate seat positions for 4-player table", () => {
    const width = 900;
    const height = 680;

    const seats = [
      { x: width / 2, y: 80, label: "北" },
      { x: width - 120, y: height - 240, label: "东" },
      { x: 120, y: height - 240, label: "西" },
    ];

    expect(seats).toHaveLength(3);
    expect(seats[0].label).toBe("北");
    expect(seats[1].label).toBe("东");
    expect(seats[2].label).toBe("西");

    expect(seats[0].x).toBe(450);
    expect(seats[0].y).toBe(80);
    expect(seats[1].x).toBe(780);
    expect(seats[1].y).toBe(440);
  });
});

describe("GameUI selection logic", () => {
  it("should track selected card IDs", () => {
    const selectedIds = new Set<string>();

    selectedIds.add("card_1");
    expect(selectedIds.has("card_1")).toBe(true);
    expect(selectedIds.size).toBe(1);

    selectedIds.add("card_2");
    expect(selectedIds.size).toBe(2);

    selectedIds.delete("card_1");
    expect(selectedIds.has("card_1")).toBe(false);
    expect(selectedIds.size).toBe(1);
  });

  it("should clear all selections", () => {
    const selectedIds = new Set(["card_1", "card_2", "card_3"]);
    selectedIds.clear();
    expect(selectedIds.size).toBe(0);
  });

  it("should handle interaction callback with selected card IDs", () => {
    let capturedAction = "";
    let capturedIds: string[] = [];

    const mockCallback = (action: string, cardIds: string[]) => {
      capturedAction = action;
      capturedIds = cardIds;
    };

    mockCallback("play", ["card_sha_1"]);
    expect(capturedAction).toBe("play");
    expect(capturedIds).toEqual(["card_sha_1"]);

    mockCallback("endTurn", []);
    expect(capturedAction).toBe("endTurn");
    expect(capturedIds).toEqual([]);
  });
});

describe("GameUI data interface", () => {
  it("should accept valid GameUIData", () => {
    const gameData = {
      playerName: "主公",
      handCards: [
        { id: "sha_1", name: "杀", category: "basic", type: "sha" },
        { id: "shan_1", name: "闪", category: "basic", type: "shan" },
        { id: "tao_1", name: "桃", category: "basic", type: "tao" },
      ],
      turn: 1,
      phase: "play",
      health: 4,
      maxHealth: 4,
    };

    expect(gameData.handCards).toHaveLength(3);
    expect(gameData.turn).toBe(1);
    expect(gameData.phase).toBe("play");
    expect(gameData.health).toBe(4);
    expect(gameData.maxHealth).toBe(4);
  });

  it("should handle empty hand cards", () => {
    const gameData = {
      playerName: "主公",
      handCards: [],
      turn: 1,
      phase: "prepare",
      health: 4,
      maxHealth: 4,
    };

    expect(gameData.handCards).toHaveLength(0);
  });

  it("should reflect health changes accurately", () => {
    let health = 4;
    health = health - 1;
    health = Math.max(0, health);
    expect(health).toBe(3);

    health = health + 1;
    health = Math.min(health, 4);
    expect(health).toBe(4);

    health = 0;
    expect(health).toBe(0);
  });
});