import { Container, Graphics, Text, TextStyle } from "pixi.js";

export interface SeatPosition {
  x: number;
  y: number;
  label: string;
}

export class TableRenderer {
  readonly container: Container;
  private seats: SeatPosition[] = [];

  constructor(width: number, height: number) {
    this.container = new Container();

    const bg = new Graphics();
    bg.roundRect(20, 20, width - 40, height - 40, 16)
      .fill({ color: 0x1a472a })
      .stroke({ width: 4, color: 0x3a7a4a });
    bg.roundRect(32, 32, width - 64, height - 64, 12)
      .fill({ color: 0x1e5430 });
    this.container.addChild(bg);

    this.seats = [
      { x: width / 2, y: 80, label: "北" },
      { x: width - 120, y: height - 240, label: "东" },
      { x: 120, y: height - 240, label: "西" },
    ];

    const seatStyle = new TextStyle({
      fontFamily: "Arial, sans-serif",
      fontSize: 14,
      fill: 0x88aa88,
    });

    for (const seat of this.seats) {
      const seatGfx = new Graphics();
      seatGfx.roundRect(seat.x - 55, seat.y - 25, 110, 50, 8)
        .fill({ color: 0x0d3317, alpha: 0.5 })
        .stroke({ width: 1, color: 0x2a5a3a, alpha: 0.6 });
      this.container.addChild(seatGfx);

      const seatText = new Text({
        text: seat.label,
        style: seatStyle,
      });
      seatText.anchor = { x: 0.5, y: 0.5 };
      seatText.x = seat.x;
      seatText.y = seat.y;
      this.container.addChild(seatText);
    }
  }

  getSeats(): readonly SeatPosition[] {
    return this.seats;
  }
}