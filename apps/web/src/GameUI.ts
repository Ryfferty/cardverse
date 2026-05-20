import { Application, Container, Graphics, Text, TextStyle } from "pixi.js";
import { TableRenderer } from "./TableRenderer.js";
import { CardView } from "./CardView.js";
import type { CardData } from "./CardView.js";
import { HUD } from "./HUD.js";

export interface GameUIData {
  playerName: string;
  handCards: CardData[];
  turn: number;
  phase: string;
  health: number;
  maxHealth: number;
}

export class GameUI {
  readonly app: Application;
  readonly table: TableRenderer;
  readonly hud: HUD;
  private handContainer: Container;
  private cardViews: CardView[] = [];
  private actionPanel: Container;
  private actionLabel: Text;
  private selectedIds: Set<string> = new Set();
  private onActionCallback: ((action: string, cardIds: string[]) => void) | null = null;

  constructor() {
    this.app = new Application();
  }

  async init(parent: HTMLElement, data: GameUIData): Promise<void> {
    await this.app.init({
      width: 900,
      height: 680,
      backgroundColor: 0x0a0a1a,
      antialias: true,
      resolution: window.devicePixelRatio || 1,
      autoDensity: true,
      preference: "webgpu",
    }).catch(() =>
      this.app.init({
        width: 900,
        height: 680,
        backgroundColor: 0x0a0a1a,
        antialias: true,
        preference: "webgl",
      }),
    );
    parent.appendChild(this.app.canvas);

    this.table = new TableRenderer(900, 680);
    this.app.stage.addChild(this.table.container);

    this.hud = new HUD();
    this.app.stage.addChild(this.hud.container);

    this.handContainer = new Container();
    this.handContainer.y = 540;
    this.handContainer.x = 0;
    this.app.stage.addChild(this.handContainer);

    const divider = new Graphics();
    divider.moveTo(20, 520).lineTo(880, 520)
      .stroke({ width: 1, color: 0x334455, alpha: 0.4 });
    this.app.stage.addChild(divider);

    this.actionPanel = new Container();
    this.actionPanel.y = 520;
    this.actionPanel.x = 0;
    this.app.stage.addChild(this.actionPanel);

    this.actionLabel = new Text({
      text: "",
      style: new TextStyle({
        fontFamily: "Arial, sans-serif",
        fontSize: 12,
        fill: 0xaaaaaa,
      }),
    });
    this.actionLabel.anchor = { x: 0.5, y: 0 };
    this.actionLabel.x = 450;
    this.actionLabel.y = 14;
    this.app.stage.addChild(this.actionLabel);

    this.update(data);

    this.app.ticker.add(() => {});
  }

  update(data: GameUIData): void {
    this.hud.updateTurn(data.turn);
    this.hud.updatePhase(data.phase);
    this.hud.updateHealth(data.health, data.maxHealth);

    this.handContainer.removeChildren();
    this.cardViews = [];

    const totalCards = data.handCards.length;
    const cardWidth = 80;
    const gap = 4;
    const totalWidth = totalCards * cardWidth + (totalCards - 1) * gap;
    const startX = Math.max(0, (900 - totalWidth) / 2);

    for (let i = 0; i < totalCards; i++) {
      const cardData = data.handCards[i];
      const cv = new CardView(cardData);

      if (this.selectedIds.has(cardData.id)) {
        cv.setSelected(true);
      }

      cv.container.x = startX + i * (cardWidth + gap);
      cv.container.y = 0;

      cv.onClick = (card: CardData) => {
        if (card.selected) {
          this.selectedIds.add(card.id);
        } else {
          this.selectedIds.delete(card.id);
        }
        this.updateActionLabel();
      };

      this.handContainer.addChild(cv.container);
      this.cardViews.push(cv);
    }

    this.updateActionLabel();
  }

  setInteractionCallback(cb: (action: string, cardIds: string[]) => void): void {
    this.onActionCallback = cb;
  }

  private updateActionLabel(): void {
    const count = this.selectedIds.size;
    if (count === 0) {
      this.actionLabel.text = "点击卡牌选中，然后点击下方按钮出牌";
    } else {
      this.actionLabel.text = `已选中 ${count} 张卡牌`;
    }
  }

  getSelectedCardIds(): string[] {
    return Array.from(this.selectedIds);
  }

  clearSelection(): void {
    this.selectedIds.clear();
    for (const cv of this.cardViews) {
      cv.setSelected(false);
    }
    this.updateActionLabel();
  }

  notifyAction(action: string, cardIds: string[]): void {
    if (this.onActionCallback) {
      this.onActionCallback(action, cardIds);
    }
    this.clearSelection();
  }
}