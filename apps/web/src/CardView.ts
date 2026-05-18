import { Container, Graphics, Text, TextStyle } from "pixi.js";

export interface CardData {
  id: string;
  name: string;
  category: string;
  type?: string;
  selected?: boolean;
}

const CATEGORY_COLORS: Record<string, number> = {
  basic: 0xcc4444,
  trick: 0x4488cc,
  equipment: 0x44aa44,
};

const CATEGORY_LABELS: Record<string, string> = {
  basic: "基本",
  trick: "锦囊",
  equipment: "装备",
};

export class CardView {
  readonly container: Container;
  readonly cardData: CardData;
  private bg: Graphics;
  private selected: boolean = false;
  private hovered: boolean = false;
  onClick: ((card: CardData) => void) | null = null;

  constructor(data: CardData) {
    this.cardData = data;
    this.container = new Container();

    this.bg = new Graphics();
    this.container.addChild(this.bg);

    const color = CATEGORY_COLORS[data.category] ?? 0x999999;

    const labelStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 10,
      fill: color,
      fontStyle: "italic",
    });
    const label = new Text({
      text: CATEGORY_LABELS[data.category] ?? data.category,
      style: labelStyle,
    });
    label.anchor = { x: 0, y: 0 };
    label.x = 6;
    label.y = 6;
    this.container.addChild(label);

    const nameStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 13,
      fill: 0xdddddd,
      fontWeight: "bold",
      wordWrap: true,
      wordWrapWidth: 66,
    });
    const nameText = new Text({
      text: data.name,
      style: nameStyle,
    });
    nameText.anchor = { x: 0.5, y: 0.5 };
    nameText.x = 40;
    nameText.y = 47;
    this.container.addChild(nameText);

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

  private drawCard(): void {
    const color = CATEGORY_COLORS[this.cardData.category] ?? 0x999999;
    const bgAlpha = this.selected ? 1 : this.hovered ? 0.5 : 0.2;

    this.bg.clear();
    this.bg.roundRect(0, 0, 80, 100, 6)
      .fill({ color: 0x222244, alpha: bgAlpha })
      .stroke({ width: 2, color: this.selected ? 0xffff00 : color });

    this.container.y = this.selected ? -12 : 0;
  }
}