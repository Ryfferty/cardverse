import { type GameEvent, type EventResponse, EventType } from "@cardverse/shared";

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * EventStack — LIFO stack for nested event resolution.
 * Inspired by MTG's stack mechanic.
 */
export class EventStack {
  private stack: GameEvent[] = [];

  push(event: Omit<GameEvent, "id" | "timestamp" | "stackDepth">): GameEvent {
    const fullEvent: GameEvent = {
      ...event,
      id: generateEventId(),
      timestamp: Date.now(),
      stackDepth: this.stack.length,
    };
    this.stack.push(fullEvent);
    return fullEvent;
  }

  pop(): GameEvent | undefined {
    return this.stack.pop();
  }

  peek(): GameEvent | undefined {
    return this.stack[this.stack.length - 1];
  }

  isEmpty(): boolean {
    return this.stack.length === 0;
  }

  size(): number {
    return this.stack.length;
  }

  clear(): void {
    this.stack = [];
  }

  toArray(): GameEvent[] {
    return [...this.stack];
  }
}

/**
 * EventBus — publish/subscribe for game events with response support.
 */
export type EventHandler = (event: GameEvent) => void | Promise<void>;
export type ResponseHandler = (event: GameEvent) => EventResponse | null;

export class EventBus {
  private handlers = new Map<string, Set<EventHandler>>();
  private responseHandlers = new Map<string, ResponseHandler>();

  on(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, new Set());
    }
    this.handlers.get(eventType)!.add(handler);
  }

  off(eventType: string, handler: EventHandler): void {
    this.handlers.get(eventType)?.delete(handler);
  }

  /** Register a handler that can respond to events */
  onResponse(eventType: string, handler: ResponseHandler): void {
    this.responseHandlers.set(eventType, handler);
  }

  removeResponseHandler(eventType: string): void {
    this.responseHandlers.delete(eventType);
  }

  async emit(event: GameEvent): Promise<void> {
    const errors: Error[] = [];
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      for (const handler of handlers) {
        try {
          await handler(event);
        } catch (e) {
          errors.push(e as Error);
        }
      }
    }
    const wildcardHandlers = this.handlers.get("*");
    if (wildcardHandlers) {
      for (const handler of wildcardHandlers) {
        try {
          await handler(event);
        } catch (e) {
          errors.push(e as Error);
        }
      }
    }
    if (errors.length > 0) {
      console.error(`EventBus: ${errors.length} handler(s) threw for event ${event.type}:`, errors);
    }
  }

  /**
   * Request a response from a player for a given event.
   * Returns the response or null if no handler registered or timeout reached.
   */
  async requestResponse(
    eventType: string,
    event: GameEvent,
    timeoutMs?: number
  ): Promise<EventResponse | null> {
    const handler = this.responseHandlers.get(eventType);
    if (!handler) return null;

    if (timeoutMs !== undefined) {
      const result = await Promise.race([
        Promise.resolve(handler(event)),
        new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
      ]);
      return result;
    }
    return handler(event);
  }

  clear(): void {
    this.handlers.clear();
    this.responseHandlers.clear();
  }
}
