import { Container, Graphics, Text, TextStyle } from "pixi.js";

export interface CardData {
  id: string;
  name: string;
  category: string;
  type?: string;
  suit?: string;
  number?: string;
  selected?: boolean;
  compact?: boolean;
}

const CATEGORY_COLORS: Record<string, number> = {
  basic: 0xcc4444,
  trick: 0x4488cc,
  equipment: 0x44aa44,
};

const CATEGORY_BG: Record<string, number> = {
  basic: 0x441111,
  trick: 0x112244,
  equipment: 0x114411,
};

const CATEGORY_LABELS: Record<string, string> = {
  basic: "基本",
  trick: "锦囊",
  equipment: "装备",
};

const SUIT_SYMBOLS: Record<string, string> = {
  spade: "♠",
  heart: "♥",
  club: "♣",
  diamond: "♦",
};

const SUIT_COLORS: Record<string, number> = {
  spade: 0x222222,
  heart: 0xcc2222,
  club: 0x222222,
  diamond: 0xcc2222,
};

export class CardView {
  readonly container: Container;
  readonly cardData: CardData;
  private bg: Graphics;
  private selected: boolean = false;
  private hovered: boolean = false;
  private compact: boolean;
  onClick: ((card: CardData) => void) | null = null;

  constructor(data: CardData) {
    this.cardData = data;
    this.compact = data.compact ?? false;
    this.container = new Container();

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    const color = CATEGORY_COLORS[data.category] ?? 0x999999;
    const bgColor = CATEGORY_BG[data.category] ?? 0x222222;

    if (this.compact) {
      this.drawCompactCard(color, bgColor);
    } else {
      this.drawFullCard(color, bgColor);
    }

    this.drawCard();

    this.container.eventMode = "static";
    this.container.cursor = "pointer";

    this.container.on("pointerover", () => {
      this.hovered = true;
      this.drawCard();
    });
    this.container.on("pointerout", () => {
      this.hovered = false;
      this.drawCard();
    });
    this.container.on("pointerdown", () => {
      this.selected = !this.selected;
      this.drawCard();
      if (this.onClick) {
        this.onClick({ ...this.cardData, selected: this.selected });
      }
    });
  }

  setSelected(sel: boolean): void {
    this.selected = sel;
    this.drawCard();
  }

  private drawFullCard(color: number, _bgColor: number): void {
    const labelStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 9,
      fill: color,
      fontStyle: "italic",
    });
    const label = new Text({
      text: CATEGORY_LABELS[this.cardData.category] ?? this.cardData.category,
      style: labelStyle,
    });
    label.x = 6;
    label.y = 4;
    this.container.addChild(label);

    if (this.cardData.suit) {
      const suitSymbol = SUIT_SYMBOLS[this.cardData.suit] ?? "";
      const suitColor = SUIT_COLORS[this.cardData.suit] ?? 0x222222;

      const suitStyle = new TextStyle({
        fontFamily: "Arial, sans-serif",
        fontSize: 12,
        fill: suitColor,
        fontWeight: "bold",
      });
      const suitText = new Text({
        text: suitSymbol,
        style: suitStyle,
      });
      suitText.x = 6;
      suitText.y = 18;
      this.container.addChild(suitText);

      if (this.cardData.number) {
        const numStyle = new TextStyle({
          fontFamily: "Arial, sans-serif",
          fontSize: 10,
          fill: suitColor,
        });
        const numText = new Text({
          text: this.cardData.number,
          style: numStyle,
        });
        numText.x = 20;
        numText.y = 19;
        this.container.addChild(numText);
      }
    }

    const nameStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 13,
      fill: 0xeeeeee,
      fontWeight: "bold",
      wordWrap: true,
      wordWrapWidth: 66,
      align: "center",
    });
    const nameText = new Text({
      text: this.cardData.name,
      style: nameStyle,
    });
    nameText.anchor = { x: 0.5, y: 0.5 };
    nameText.x = 40;
    nameText.y = 55;
    this.container.addChild(nameText);
  }

  private drawCompactCard(color: number, _bgColor: number): void {
    const nameStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 10,
      fill: 0xdddddd,
      fontWeight: "bold",
    });
    const nameText = new Text({
      text: this.cardData.name,
      style: nameStyle,
    });
    nameText.anchor = { x: 0.5, y: 0.5 };
    nameText.x = 30;
    nameText.y = 16;
    this.container.addChild(nameText);

    const catStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 8,
      fill: color,
    });
    const catText = new Text({
      text: CATEGORY_LABELS[this.cardData.category] ?? "",
      style: catStyle,
    });
    catText.anchor = { x: 0.5, y: 0.5 };
    catText.x = 30;
    catText.y = 30;
    this.container.addChild(catText);
  }

  private drawCard(): void {
    const color = CATEGORY_COLORS[this.cardData.category] ?? 0x999999;
    const bgColor = CATEGORY_BG[this.cardData.category] ?? 0x222222;

    this.bg.clear();

    if (this.compact) {
      this.drawCompactBg(color, bgColor);
    } else {
      this.drawFullBg(color, bgColor);
    }
  }

  private drawFullBg(color: number, bgColor: number): void {
    const bgAlpha = this.selected ? 0.9 : this.hovered ? 0.6 : 0.3;
    const borderColor = this.selected ? 0xffff00 : this.hovered ? 0xffcc44 : color;
    const borderWidth = this.selected ? 3 : 2;

    this.bg.roundRect(0, 0, 80, 100, 6)
      .fill({ color: bgColor, alpha: bgAlpha })
      .stroke({ width: borderWidth, color: borderColor });

    if (this.selected) {
      this.bg.roundRect(2, 2, 76, 96, 4)
        .fill({ color: color, alpha: 0.15 });
    }

    this.container.y = this.selected ? -16 : this.hovered ? -6 : 0;
    this.container.zIndex = this.selected ? 10 : 0;
  }

  private drawCompactBg(color: number, bgColor: number): void {
    const bgAlpha = this.hovered ? 0.6 : 0.3;

    this.bg.roundRect(0, 0, 60, 38, 4)
      .fill({ color: bgColor, alpha: bgAlpha })
      .stroke({ width: 1, color });

    this.container.y = 0;
    this.container.zIndex = 0;
  }
}

export function layoutHandCards(cards: CardView[], startX: number, y: number, maxWidth: number): void {
  if (cards.length === 0) return;

  const cardWidth = 80;
  const cardSpacing = Math.min(cardWidth + 4, maxWidth / cards.length);
  const totalWidth = cardSpacing * (cards.length - 1) + cardWidth;
  const offsetX = totalWidth > maxWidth ? startX : startX + (maxWidth - totalWidth) / 2;

  for (let i = 0; i < cards.length; i++) {
    cards[i].container.x = offsetX + i * cardSpacing;
    cards[i].container.y = y;
  }
}

export function layoutEquipmentCards(cards: CardView[], startX: number, y: number): void {
  const cardSpacing = 64;
  for (let i = 0; i < cards.length; i++) {
    cards[i].container.x = startX + i * cardSpacing;
    cards[i].container.y = y;
  }
}
