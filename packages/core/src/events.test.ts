import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { EventStack, EventBus, type EventHandler, type ResponseHandler } from "./events.js";
import { EventType } from "@cardverse/shared";

type MockEventOverrides = {
  type?: string;
  source?: string;
  target?: string;
  parentEventId?: string;
  data?: Record<string, unknown>;
};

function createMockEvent(overrides: MockEventOverrides = {}): Omit<import("@cardverse/shared").GameEvent, "id" | "timestamp" | "stackDepth"> {
  return {
    type: EventType.GAME_START,
    source: "player1",
    target: "player2",
    data: {},
    ...overrides,
  };
}

describe("EventStack", () => {
  let stack: EventStack;

  beforeEach(() => {
    stack = new EventStack();
  });

  describe("push", () => {
    it("should push an event and return a full GameEvent", () => {
      const partialEvent = createMockEvent({ type: EventType.GAME_START });
      const result = stack.push(partialEvent);

      expect(result).toMatchObject({
        type: EventType.GAME_START,
        source: "player1",
        target: "player2",
      });
      expect(result.id).toBeDefined();
      expect(result.timestamp).toBeGreaterThan(0);
      expect(result.stackDepth).toBe(0);
    });

    it("should assign sequential stackDepth", () => {
      stack.push(createMockEvent({ type: "event:1" }));
      const second = stack.push(createMockEvent({ type: "event:2" }));
      const third = stack.push(createMockEvent({ type: "event:3" }));

      expect(second.stackDepth).toBe(1);
      expect(third.stackDepth).toBe(2);
    });

    it("should preserve event data", () => {
      const partialEvent = createMockEvent({
        type: EventType.CARD_PLAYED,
        data: { cardId: "card_123", target: "player2" },
      });
      const result = stack.push(partialEvent);

      expect(result.data).toEqual({ cardId: "card_123", target: "player2" });
    });

    it("should support parentEventId", () => {
      const parentEvent = stack.push(createMockEvent({ type: "parent" }));
      const childEvent = stack.push(createMockEvent({
        type: "child",
        parentEventId: parentEvent.id,
      }));

      expect(childEvent.parentEventId).toBe(parentEvent.id);
    });
  });

  describe("pop", () => {
    it("should return and remove the last event", () => {
      stack.push(createMockEvent({ type: "event:1" }));
      const event2 = stack.push(createMockEvent({ type: "event:2" }));
      const event3 = stack.push(createMockEvent({ type: "event:3" }));

      const result = stack.pop();
      expect(result?.id).toBe(event3.id);
      expect(stack.size()).toBe(2);
    });

    it("should return undefined for empty stack", () => {
      const result = stack.pop();
      expect(result).toBeUndefined();
    });
  });

  describe("peek", () => {
    it("should return the last event without removing it", () => {
      stack.push(createMockEvent({ type: "event:1" }));
      stack.push(createMockEvent({ type: "event:2" }));
      const event3 = stack.push(createMockEvent({ type: "event:3" }));

      const result = stack.peek();
      expect(result?.id).toBe(event3.id);
      expect(stack.size()).toBe(3);
    });

    it("should return undefined for empty stack", () => {
      const result = stack.peek();
      expect(result).toBeUndefined();
    });
  });

  describe("isEmpty", () => {
    it("should return true for empty stack", () => {
      expect(stack.isEmpty()).toBe(true);
    });

    it("should return false after push", () => {
      stack.push(createMockEvent());
      expect(stack.isEmpty()).toBe(false);
    });

    it("should return true after pop all events", () => {
      stack.push(createMockEvent());
      stack.push(createMockEvent());
      stack.pop();
      stack.pop();
      expect(stack.isEmpty()).toBe(true);
    });
  });

  describe("size", () => {
    it("should return 0 for empty stack", () => {
      expect(stack.size()).toBe(0);
    });

    it("should return correct size after pushes", () => {
      stack.push(createMockEvent());
      stack.push(createMockEvent());
      stack.push(createMockEvent());
      expect(stack.size()).toBe(3);
    });

    it("should decrease after pops", () => {
      stack.push(createMockEvent());
      stack.push(createMockEvent());
      stack.pop();
      expect(stack.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all events", () => {
      stack.push(createMockEvent());
      stack.push(createMockEvent());
      stack.push(createMockEvent());

      stack.clear();

      expect(stack.size()).toBe(0);
      expect(stack.isEmpty()).toBe(true);
    });

    it("should work on empty stack", () => {
      stack.clear();
      expect(stack.size()).toBe(0);
    });
  });

  describe("toArray", () => {
    it("should return all events in order", () => {
      const event1 = stack.push(createMockEvent({ type: "first" }));
      const event2 = stack.push(createMockEvent({ type: "second" }));
      const event3 = stack.push(createMockEvent({ type: "third" }));

      const result = stack.toArray();

      expect(result).toHaveLength(3);
      expect(result[0].id).toBe(event1.id);
      expect(result[1].id).toBe(event2.id);
      expect(result[2].id).toBe(event3.id);
    });

    it("should return empty array for empty stack", () => {
      expect(stack.toArray()).toEqual([]);
    });

    it("should return a copy, not the original", () => {
      stack.push(createMockEvent());
      const array = stack.toArray();

      array.push({
        type: EventType.GAME_START,
        source: "player1",
        data: {},
        id: "fake_id",
        timestamp: 0,
        stackDepth: 99,
      });

      expect(stack.size()).toBe(1);
    });
  });

  describe("LIFO behavior", () => {
    it("should follow LIFO order for push/pop", () => {
      const e1 = stack.push(createMockEvent({ type: "1" }));
      const e2 = stack.push(createMockEvent({ type: "2" }));
      const e3 = stack.push(createMockEvent({ type: "3" }));

      expect(stack.pop()?.id).toBe(e3.id);
      expect(stack.pop()?.id).toBe(e2.id);
      expect(stack.pop()?.id).toBe(e1.id);
    });

    it("should support nested event simulation", () => {
      const parentEvent = stack.push(createMockEvent({
        type: EventType.CARD_PLAYED,
        data: { cardId: "sha" },
      }));

      const response = stack.push(createMockEvent({
        type: EventType.RESPONSE_REQUESTED,
        parentEventId: parentEvent.id,
        data: { prompt: "Respond with Shan?" },
      }));

      expect(stack.peek()?.id).toBe(response.id);
      expect(stack.peek()?.parentEventId).toBe(parentEvent.id);

      stack.pop();
      expect(stack.peek()?.id).toBe(parentEvent.id);
    });
  });
});

describe("EventBus", () => {
  let eventBus: EventBus;

  beforeEach(() => {
    eventBus = new EventBus();
  });

  afterEach(() => {
    eventBus.clear();
  });

  describe("on/off", () => {
    it("should register and call handler on emit", async () => {
      const handler = vi.fn();
      eventBus.on(EventType.GAME_START, handler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handler).toHaveBeenCalledTimes(1);
      expect(handler).toHaveBeenCalledWith(event);
    });

    it("should call handler with multiple registered events", async () => {
      const handler = vi.fn();
      eventBus.on(EventType.GAME_START, handler);

      const event1: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const event2: import("@cardverse/shared").GameEvent = {
        id: "evt_2",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      await eventBus.emit(event1);
      await eventBus.emit(event2);

      expect(handler).toHaveBeenCalledTimes(2);
    });

    it("should remove handler with off", async () => {
      const handler = vi.fn();
      eventBus.on(EventType.GAME_START, handler);
      eventBus.off(EventType.GAME_START, handler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });

    it("should support multiple handlers for same event", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on(EventType.GAME_START, handler1);
      eventBus.on(EventType.GAME_START, handler2);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handler1).toHaveBeenCalledTimes(1);
      expect(handler2).toHaveBeenCalledTimes(1);
    });

    it("should support different event types", async () => {
      const startHandler = vi.fn();
      const endHandler = vi.fn();
      eventBus.on(EventType.GAME_START, startHandler);
      eventBus.on(EventType.GAME_END, endHandler);

      const startEvent: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const endEvent: import("@cardverse/shared").GameEvent = {
        id: "evt_2",
        type: EventType.GAME_END,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      await eventBus.emit(startEvent);
      await eventBus.emit(endEvent);

      expect(startHandler).toHaveBeenCalledTimes(1);
      expect(endHandler).toHaveBeenCalledTimes(1);
    });

    it("should not call handler for different event types", async () => {
      const handler = vi.fn();
      eventBus.on(EventType.GAME_START, handler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_END,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handler).not.toHaveBeenCalled();
    });
  });

  describe("wildcard '*' listener", () => {
    it("should receive all events", async () => {
      const wildcardHandler = vi.fn();
      eventBus.on("*", wildcardHandler);

      const event1: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const event2: import("@cardverse/shared").GameEvent = {
        id: "evt_2",
        type: EventType.CARD_PLAYED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const event3: import("@cardverse/shared").GameEvent = {
        id: "evt_3",
        type: EventType.GAME_END,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      await eventBus.emit(event1);
      await eventBus.emit(event2);
      await eventBus.emit(event3);

      expect(wildcardHandler).toHaveBeenCalledTimes(3);
    });

    it("should work alongside specific handlers", async () => {
      const specificHandler = vi.fn();
      const wildcardHandler = vi.fn();
      eventBus.on(EventType.GAME_START, specificHandler);
      eventBus.on("*", wildcardHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(specificHandler).toHaveBeenCalledTimes(1);
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
    });

    it("should receive wildcard events after specific removed", async () => {
      const specificHandler = vi.fn();
      const wildcardHandler = vi.fn();
      eventBus.on(EventType.GAME_START, specificHandler);
      eventBus.on("*", wildcardHandler);
      eventBus.off(EventType.GAME_START, specificHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(specificHandler).not.toHaveBeenCalled();
      expect(wildcardHandler).toHaveBeenCalledTimes(1);
    });
  });

  describe("onResponse/removeResponseHandler", () => {
    it("should register and call response handler", async () => {
      const responseHandler: ResponseHandler = (event) => ({
        playerId: "player1",
        action: "respond",
        data: { response: "accepted" },
      });
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, responseHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result).toEqual({
        playerId: "player1",
        action: "respond",
        data: { response: "accepted" },
      });
    });

    it("should return null when no handler registered", async () => {
      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result).toBeNull();
    });

    it("should remove response handler", async () => {
      const responseHandler: ResponseHandler = () => ({
        playerId: "player1",
        action: "respond",
      });
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, responseHandler);
      eventBus.removeResponseHandler(EventType.RESPONSE_REQUESTED);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result).toBeNull();
    });

    it("should allow response handler to return null (timeout simulation)", async () => {
      const responseHandler: ResponseHandler = () => null;
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, responseHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result).toBeNull();
    });
  });

  describe("requestResponse", () => {
    it("should pass event data to response handler", async () => {
      let receivedEvent: import("@cardverse/shared").GameEvent | null = null;
      const responseHandler: ResponseHandler = (event) => {
        receivedEvent = event;
        return { playerId: "player1", action: "ack" };
      };
      eventBus.onResponse(EventType.DAMAGE_DEALT, responseHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.DAMAGE_DEALT,
        source: "player2",
        target: "player1",
        data: { damage: 3 },
        timestamp: Date.now(),
        stackDepth: 1,
      };
      await eventBus.requestResponse(EventType.DAMAGE_DEALT, event);

      expect(receivedEvent).not.toBeNull();
      expect(receivedEvent!.data).toEqual({ damage: 3 });
      expect(receivedEvent!.source).toBe("player2");
    });

    it("should support different event types for responses", async () => {
      const shaHandler: ResponseHandler = () => ({
        playerId: "player1",
        cardId: "shan_1",
        action: "play",
      });
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, shaHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: { prompt: "Respond to Attack?" },
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result?.cardId).toBe("shan_1");
      expect(result?.action).toBe("play");
    });
  });

  describe("emit", () => {
    it("should emit event to all registered handlers asynchronously", async () => {
      const results: string[] = [];
      eventBus.on(EventType.GAME_START, async () => {
        results.push("handler1");
      });
      eventBus.on(EventType.GAME_START, async () => {
        results.push("handler2");
      });

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(results).toContain("handler1");
      expect(results).toContain("handler2");
    });

    it("should emit to wildcard listeners in addition to specific", async () => {
      let specificCalled = false;
      let wildcardCalled = false;

      eventBus.on(EventType.GAME_START, async () => {
        specificCalled = true;
      });
      eventBus.on("*", async () => {
        wildcardCalled = true;
      });

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(specificCalled).toBe(true);
      expect(wildcardCalled).toBe(true);
    });

    it("should handle async handlers without blocking", async () => {
      const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      let asyncDone = false;

      eventBus.on(EventType.GAME_START, async () => {
        await delay(10);
        asyncDone = true;
      });

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const emitPromise = eventBus.emit(event);

      expect(asyncDone).toBe(false);
      await emitPromise;
      expect(asyncDone).toBe(true);
    });
  });

  describe("clear", () => {
    it("should remove all event handlers", async () => {
      const handler1 = vi.fn();
      const handler2 = vi.fn();
      eventBus.on(EventType.GAME_START, handler1);
      eventBus.on(EventType.GAME_END, handler2);

      eventBus.clear();

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handler1).not.toHaveBeenCalled();
      expect(handler2).not.toHaveBeenCalled();
    });

    it("should remove all response handlers", async () => {
      const responseHandler: ResponseHandler = () => ({
        playerId: "player1",
        action: "respond",
      });
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, responseHandler);

      eventBus.clear();

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

      expect(result).toBeNull();
    });
  });

  describe("error handling", () => {
    it("should continue execution when a handler throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const handlerGood = vi.fn();
      const handlerBad = vi.fn(() => {
        throw new Error("Handler error");
      });

      eventBus.on(EventType.GAME_START, handlerBad);
      eventBus.on(EventType.GAME_START, handlerGood);
      eventBus.on("*", handlerGood);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_err",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(handlerBad).toHaveBeenCalled();
      expect(handlerGood).toHaveBeenCalledTimes(2); // specific + wildcard
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });

    it("should not crash when wildcard handler throws", async () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const specificHandler = vi.fn();
      const wildcardBad = vi.fn(() => {
        throw new Error("Wildcard error");
      });

      eventBus.on(EventType.GAME_START, specificHandler);
      eventBus.on("*", wildcardBad);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_err",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await eventBus.emit(event);

      expect(specificHandler).toHaveBeenCalled();
      expect(wildcardBad).toHaveBeenCalled();
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });

  describe("edge cases", () => {
    it("should not crash when emit has no handlers", async () => {
      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      await expect(eventBus.emit(event)).resolves.toBeUndefined();
    });

    it("should not crash when off is called with unregistered handler", () => {
      const handler = vi.fn();
      expect(() => eventBus.off(EventType.GAME_START, handler)).not.toThrow();
    });

    it("should overwrite response handler when onResponse called again", async () => {
      const handler1: ResponseHandler = () => ({ playerId: "p1", action: "first" });
      const handler2: ResponseHandler = () => ({ playerId: "p1", action: "second" });

      eventBus.onResponse(EventType.RESPONSE_REQUESTED, handler1);
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, handler2);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);
      expect(result?.action).toBe("second");
    });

    it("should handle requestResponse timeout with valid handler", async () => {
      const fastHandler: ResponseHandler = () => ({ playerId: "p1", action: "fast" });
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, fastHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };
      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event, 5000);
      expect(result?.action).toBe("fast");
    });
  });

  describe("parentEventId support", () => {
    it("should preserve parentEventId through event emission", async () => {
      type GameEvent = import("@cardverse/shared").GameEvent;
      let receivedEvent: GameEvent | undefined;
      eventBus.on(EventType.RESPONSE_REQUESTED, (event) => {
        receivedEvent = event as GameEvent;
      });

      const parentEvent: GameEvent = {
        id: "parent_1",
        type: EventType.CARD_PLAYED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      const childEvent: GameEvent = {
        id: "child_1",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 1,
        parentEventId: parentEvent.id,
      };

      await eventBus.emit(childEvent);

      expect(receivedEvent).toBeDefined();
      expect(receivedEvent!.parentEventId).toBe(parentEvent.id);
    });

    it("should support deeply nested event relationships", async () => {
      const events: import("@cardverse/shared").GameEvent[] = [];
      eventBus.on("*", (event) => {
        events.push(event);
      });

      const event1: import("@cardverse/shared").GameEvent = {
        id: "evt_1",
        type: EventType.GAME_START,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      const event2: import("@cardverse/shared").GameEvent = {
        id: "evt_2",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 1,
        parentEventId: event1.id,
      };

      const event3: import("@cardverse/shared").GameEvent = {
        id: "evt_3",
        type: EventType.RESPONSE_GIVEN,
        data: {},
        timestamp: Date.now(),
        stackDepth: 2,
        parentEventId: event2.id,
      };

      await eventBus.emit(event1);
      await eventBus.emit(event2);
      await eventBus.emit(event3);

      expect(events[0].parentEventId).toBeUndefined();
      expect(events[1].parentEventId).toBe(event1.id);
      expect(events[2].parentEventId).toBe(event2.id);
    });
  });
});

describe("EventStack + EventBus Integration", () => {
  let eventStack: EventStack;
  let eventBus: EventBus;

  beforeEach(() => {
    eventStack = new EventStack();
    eventBus = new EventBus();
  });

  it("should handle response flow with stack", async () => {
    const responses: string[] = [];

    eventBus.on(EventType.RESPONSE_REQUESTED, async (event) => {
      responses.push(`Requested: ${event.id}`);
    });

    eventBus.on(EventType.RESPONSE_GIVEN, async (event) => {
      responses.push(`Given: ${event.id}`);
    });

    const attackEvent = eventStack.push({
      type: EventType.CARD_PLAYED,
      source: "player1",
      target: "player2",
      data: { cardId: "sha" },
    });

    const responseRequest = eventStack.push({
      type: EventType.RESPONSE_REQUESTED,
      parentEventId: attackEvent.id,
      data: { prompt: "Use Dodge?" },
    });

    const response = eventStack.push({
      type: EventType.RESPONSE_GIVEN,
      parentEventId: responseRequest.id,
      data: { cardId: "shan", action: "play" },
    });

    await eventBus.emit(response);

    expect(responses).toContain(`Given: ${response.id}`);
  });

  it("should support response timeout simulation", async () => {
    const responseHandler: ResponseHandler = () => null;
    eventBus.onResponse(EventType.RESPONSE_REQUESTED, responseHandler);

    const event: import("@cardverse/shared").GameEvent = {
      id: "evt_timeout",
      type: EventType.RESPONSE_REQUESTED,
      data: {},
      timestamp: Date.now(),
      stackDepth: 0,
    };

    const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);

    expect(result).toBeNull();
  });

  it("should timeout requestResponse with setTimeout", async () => {
      const slowHandler: ResponseHandler = () => {
        return new Promise((resolve) => {
          setTimeout(() => resolve({ playerId: "player1", action: "slow" }), 200);
        });
      };
      eventBus.onResponse(EventType.RESPONSE_REQUESTED, slowHandler);

      const event: import("@cardverse/shared").GameEvent = {
        id: "evt_timeout",
        type: EventType.RESPONSE_REQUESTED,
        data: {},
        timestamp: Date.now(),
        stackDepth: 0,
      };

      const result = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event, 10);
      // The handler resolves after 200ms, timeout is 10ms, so should return null
      expect(result).toBeNull();
    });

  it("should simulate complete card play flow", async () => {
    const eventLog: import("@cardverse/shared").GameEvent[] = [];

    eventBus.on("*", async (event) => {
      eventLog.push(event);
    });

    const cardPlayed = eventStack.push({
      type: EventType.CARD_PLAYED,
      source: "attacker",
      target: "defender",
      data: { cardId: "sha" },
    });

    const damageDealt = eventStack.push({
      type: EventType.DAMAGE_DEALT,
      parentEventId: cardPlayed.id,
      data: { damage: 1 },
    });

    const damageTaken = eventStack.push({
      type: EventType.DAMAGE_TAKEN,
      parentEventId: damageDealt.id,
      data: { damage: 1, target: "defender" },
    });

    await eventBus.emit(cardPlayed);
    await eventBus.emit(damageDealt);
    await eventBus.emit(damageTaken);

    expect(eventLog).toHaveLength(3);
    expect(eventLog[0].type).toBe(EventType.CARD_PLAYED);
    expect(eventLog[1].type).toBe(EventType.DAMAGE_DEALT);
    expect(eventLog[2].type).toBe(EventType.DAMAGE_TAKEN);
    expect(eventLog[1].parentEventId).toBe(cardPlayed.id);
    expect(eventLog[2].parentEventId).toBe(damageDealt.id);
  });

  it("should support simultaneous responses on stack", async () => {
    const responseLog: string[] = [];

    eventBus.on(EventType.RESPONSE_REQUESTED, async (event) => {
      responseLog.push(`Request: ${event.data["prompt"]}`);
    });

    eventBus.on(EventType.RESPONSE_GIVEN, async (event) => {
      responseLog.push(`Response: ${event.data["card"]}`);
    });

    const attack = eventStack.push({
      type: EventType.CARD_PLAYED,
      source: "player1",
      target: "player2",
      data: { cardId: "sha" },
    });

    const response1 = eventStack.push({
      type: EventType.RESPONSE_REQUESTED,
      parentEventId: attack.id,
      data: { prompt: "Use Shan?" },
    });

    const response2 = eventStack.push({
      type: EventType.RESPONSE_GIVEN,
      parentEventId: response1.id,
      data: { card: "shan", action: "play" },
    });

    await eventBus.emit(response1);
    await eventBus.emit(response2);

    expect(responseLog).toContain("Request: Use Shan?");
    expect(responseLog).toContain("Response: shan");
  });

  it("should clear stack and bus for new game", async () => {
    eventStack.push(createMockEvent());
    eventStack.push(createMockEvent());
    eventBus.on(EventType.GAME_START, vi.fn());
    eventBus.onResponse(EventType.RESPONSE_REQUESTED, () => null);

    eventStack.clear();
    eventBus.clear();

    expect(eventStack.size()).toBe(0);
    expect(eventStack.isEmpty()).toBe(true);

    const event: import("@cardverse/shared").GameEvent = {
      id: "evt_1",
      type: EventType.GAME_START,
      data: {},
      timestamp: Date.now(),
      stackDepth: 0,
    };
    await eventBus.emit(event);

    const response = await eventBus.requestResponse(EventType.RESPONSE_REQUESTED, event);
    expect(response).toBeNull();
  });
});
