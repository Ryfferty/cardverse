import { Container, Text, TextStyle } from "pixi.js";

export class HUD {
  readonly container: Container;
  private healthText: Text;
  private phaseText: Text;
  private turnText: Text;
  private infoPanel: Container;

  constructor() {
    this.container = new Container();

    const style = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 14,
      fill: 0xcccccc,
    });
    const smallStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 12,
      fill: 0x888888,
    });

    this.infoPanel = new Container();
    this.infoPanel.x = 20;
    this.infoPanel.y = 20;
    this.container.addChild(this.infoPanel);

    this.turnText = new Text({ text: "回合: 1", style });
    this.turnText.x = 0;
    this.turnText.y = 0;
    this.infoPanel.addChild(this.turnText);

    this.phaseText = new Text({ text: "阶段: 未开始", style });
    this.phaseText.x = 0;
    this.phaseText.y = 22;
    this.infoPanel.addChild(this.phaseText);

    this.healthText = new Text({ text: "体力: 4 / 4", style: smallStyle });
    this.healthText.x = 0;
    this.healthText.y = 44;
    this.infoPanel.addChild(this.healthText);
  }

  updateTurn(turn: number): void {
    this.turnText.text = `回合: ${turn}`;
  }

  updatePhase(phase: string): void {
    const labels: Record<string, string> = {
      prepare: "准备阶段",
      judge: "判定阶段",
      draw: "摸牌阶段",
      play: "出牌阶段",
      discard: "弃牌阶段",
      end: "结束阶段",
    };
    this.phaseText.text = `阶段: ${labels[phase] ?? phase}`;
  }

  updateHealth(current: number, max: number): void {
    this.healthText.text = `体力: ${current} / ${max}`;

    if (current <= 1) {
      this.healthText.style.fill = 0xff4444;
    } else if (current <= 2) {
      this.healthText.style.fill = 0xffaa44;
    } else {
      this.healthText.style.fill = 0x44cc44;
    }
  }
}