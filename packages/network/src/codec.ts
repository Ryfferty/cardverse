import type { NetworkMessage } from "./types.js";

const DELIMITER = "\n";

export class MessageCodec {
  private buffer: string = "";

  static encode(message: NetworkMessage): string {
    return JSON.stringify(message) + DELIMITER;
  }

  feed(data: string): NetworkMessage[] {
    this.buffer += data;
    const messages: NetworkMessage[] = [];

    while (true) {
      const idx = this.buffer.indexOf(DELIMITER);
      if (idx === -1) break;

      const raw = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + 1);

      if (raw.length === 0) continue;

      try {
        const parsed = JSON.parse(raw) as NetworkMessage;
        if (parsed.type && parsed.payload && typeof parsed.timestamp === "number") {
          messages.push(parsed);
        }
      } catch {
        continue;
      }
    }

    return messages;
  }

  reset(): void {
    this.buffer = "";
  }
}