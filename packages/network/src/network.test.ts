import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { HostServer } from "./host.js";
import { ClientConnection } from "./client.js";
import { RoomManager } from "./room.js";
import { MessageCodec } from "./codec.js";
import type { NetworkMessage } from "./types.js";

const TEST_PORT = 19500;

function getPort(): number {
  return TEST_PORT + Math.floor(Math.random() * 1000);
}

beforeEach(() => {
  RoomManager.reset();
});

describe("MessageCodec", () => {
  it("should encode and decode a single message", () => {
    const msg: NetworkMessage = {
      type: "test",
      payload: { hello: "world" },
      timestamp: 1000,
    };

    const encoded = MessageCodec.encode(msg);
    const codec = new MessageCodec();
    const decoded = codec.feed(encoded);

    expect(decoded).toHaveLength(1);
    expect(decoded[0].type).toBe("test");
    expect(decoded[0].payload.hello).toBe("world");
    expect(decoded[0].timestamp).toBe(1000);
  });

  it("should decode multiple messages from a single feed", () => {
    const codec = new MessageCodec();
    const msg1 = MessageCodec.encode({
      type: "msg1",
      payload: {},
      timestamp: 1,
    });
    const msg2 = MessageCodec.encode({
      type: "msg2",
      payload: {},
      timestamp: 2,
    });

    const decoded = codec.feed(msg1 + msg2);
    expect(decoded).toHaveLength(2);
    expect(decoded[0].type).toBe("msg1");
    expect(decoded[1].type).toBe("msg2");
  });

  it("should handle partial data with buffer", () => {
    const codec = new MessageCodec();
    const msg = MessageCodec.encode({
      type: "test",
      payload: { x: 1 },
      timestamp: 100,
    });

    const half = Math.floor(msg.length / 2);
    const first = codec.feed(msg.slice(0, half));
    expect(first).toHaveLength(0);

    const second = codec.feed(msg.slice(half));
    expect(second).toHaveLength(1);
    expect(second[0].type).toBe("test");
  });

  it("should skip invalid JSON", () => {
    const codec = new MessageCodec();
    const decoded = codec.feed("not json\n");
    expect(decoded).toHaveLength(0);
  });

  it("should skip empty lines", () => {
    const codec = new MessageCodec();
    const decoded = codec.feed("\n\n\n");
    expect(decoded).toHaveLength(0);
  });

  it("should reset buffer", () => {
    const codec = new MessageCodec();
    codec.feed('{"incomplete');
    codec.reset();
    const decoded = codec.feed('{"type":"test","payload":{"x":1},"timestamp":100}\n');
    expect(decoded).toHaveLength(1);
    expect(decoded[0].type).toBe("test");
  });
});

describe("RoomManager", () => {
  it("should create a room with generated code", () => {
    const room = RoomManager.createRoom("player_1", 4);
    expect(room.roomCode).toMatch(/^[A-Z2-9]{4}$/);
    expect(room.hostId).toBe("player_1");
    expect(room.maxPlayers).toBe(4);
    expect(room.playerCount).toBe(1);
    expect(room.gameStarted).toBe(false);
  });

  it("should create a room with specified code", () => {
    const room = RoomManager.createRoom("player_1", 4, "ABCD");
    expect(room.roomCode).toBe("ABCD");
  });

  it("should reject duplicate room codes", () => {
    RoomManager.createRoom("player_1", 4, "DUP1");
    expect(() => RoomManager.createRoom("player_2", 4, "DUP1")).toThrow();
  });

  it("should add and remove players", () => {
    RoomManager.createRoom("host", 4, "TEST");
    const player = RoomManager.addPlayer("TEST", "player_2", "Alice");
    expect(player.playerId).toBe("player_2");
    expect(player.name).toBe("Alice");

    const room = RoomManager.getRoom("TEST");
    expect(room?.playerCount).toBe(2);

    RoomManager.removePlayer("TEST", "player_2");
    expect(RoomManager.getRoom("TEST")?.playerCount).toBe(1);
  });

  it("should reject joining a full room", () => {
    RoomManager.createRoom("host", 2, "FULL");
    RoomManager.addPlayer("FULL", "player_2", "Bob");
    expect(() => RoomManager.addPlayer("FULL", "player_3", "Charlie")).toThrow("已满");
  });

  it("should reject joining a started game", () => {
    RoomManager.createRoom("host", 4, "GAME");
    RoomManager.setGameStarted("GAME", true);
    expect(() => RoomManager.addPlayer("GAME", "player_2", "Bob")).toThrow("已开始");
  });

  it("should reject duplicate players", () => {
    RoomManager.createRoom("host", 4, "DUPE");
    RoomManager.addPlayer("DUPE", "player_2", "Bob");
    expect(() => RoomManager.addPlayer("DUPE", "player_2", "Bob")).toThrow("已在房间中");
  });

  it("should close room when all players leave", () => {
    RoomManager.createRoom("host", 4, "GONE");
    RoomManager.removePlayer("GONE", "host");
    expect(RoomManager.getRoom("GONE")).toBeUndefined();
  });

  it("should list all rooms", () => {
    RoomManager.createRoom("h1", 4, "R1");
    RoomManager.createRoom("h2", 4, "R2");
    expect(RoomManager.listRooms()).toHaveLength(2);
  });

  it("should set player connected status", () => {
    RoomManager.createRoom("host", 4, "STAT");
    RoomManager.setPlayerConnected("STAT", "host", false);
    const room = RoomManager.getRoom("STAT");
    expect(room?.players[0].connected).toBe(false);
  });
});

describe("HostServer and ClientConnection", () => {
  const CASES = [
    { playerCount: 2, description: "2 人游戏" },
    { playerCount: 4, description: "4 人游戏" },
  ];

  for (const { playerCount, description } of CASES) {
    it(`should allow ${playerCount} players to join and sync events in ${description}`, async () => {
      const port = getPort();
      const host = new HostServer("host_1", { port, maxPlayers: playerCount, roomCode: "SYNC" });

      const hostMessages: NetworkMessage[] = [];
      host.onConnection((msg, clientId) => {
        hostMessages.push(msg);
      });

      await host.start();
      expect(host.getStatus()).toBe("connected");

      const clients: ClientConnection[] = [];
      const clientMessages: NetworkMessage[][] = [];

      for (let i = 0; i < playerCount - 1; i++) {
        const client = new ClientConnection(`player_${i + 2}`, {
          host: "127.0.0.1",
          port,
          playerName: `Player ${i + 2}`,
        });

        const msgs: NetworkMessage[] = [];
        clientMessages.push(msgs);
        client.onConnection((msg) => {
          msgs.push(msg);
        });

        clients.push(client);
      }

      for (const client of clients) {
        await client.connect("SYNC");
        expect(client.getStatus()).toBe("connected");
      }

      expect(host.getPlayerCount()).toBe(playerCount - 1);

      const syncMsg: NetworkMessage = {
        type: "game_event",
        payload: { event: "test_event", data: { key: "value" } },
        timestamp: Date.now(),
      };

      host.broadcast(syncMsg);

      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const msgs of clientMessages) {
        const eventMsgs = msgs.filter((m) => m.type === "game_event");
        expect(eventMsgs.length).toBeGreaterThanOrEqual(1);
        const found = eventMsgs.find((m) => m.payload.data && (m.payload.data as Record<string, unknown>).key === "value");
        expect(found).toBeDefined();
      }

      const events = hostMessages.filter((m) => m.type === "player_joined");
      expect(events).toHaveLength(playerCount - 1);

      const targetPlayer = `player_${playerCount}`;
      const directMsg: NetworkMessage = {
        type: "direct_message",
        payload: { target: targetPlayer, text: "hello" },
        timestamp: Date.now(),
      };
      host.sendTo(targetPlayer, directMsg);

      await new Promise((resolve) => setTimeout(resolve, 100));

      for (const client of clients) {
        client.disconnect();
      }

      await host.stop();
      expect(host.getStatus()).toBe("disconnected");
    }, 15000);
  }

  it("should reject client with wrong room code", async () => {
    const port = getPort();
    const host = new HostServer("host_1", { port, maxPlayers: 4, roomCode: "WRONG" });
    await host.start();

    const client = new ClientConnection("player_2", {
      host: "127.0.0.1",
      port,
      playerName: "Player 2",
    });

    await expect(client.connect("OTHER")).rejects.toThrow();

    client.disconnect();
    await host.stop();
  }, 10000);

  it("should handle client disconnect and reconnect", async () => {
    const port = getPort();
    const host = new HostServer("host_1", { port, maxPlayers: 4, roomCode: "REC1" });
    await host.start();

    const client = new ClientConnection("player_2", {
      host: "127.0.0.1",
      port,
      playerName: "Player 2",
    });

    await client.connect("REC1");
    expect(client.getStatus()).toBe("connected");

    client.disconnect();
    expect(client.getStatus()).toBe("disconnected");

    await host.stop();
  }, 10000);
});

describe("HostServer.broadcast ordering", () => {
  it("should deliver broadcast messages to all connected clients", async () => {
    const port = getPort();
    const host = new HostServer("host_ord", { port, maxPlayers: 3, roomCode: "ORD" });
    await host.start();

    const clientMsgs: NetworkMessage[] = [];
    const client = new ClientConnection("player_ord", {
      host: "127.0.0.1",
      port,
      playerName: "OrderClient",
    });
    client.onConnection((msg) => {
      clientMsgs.push(msg);
    });
    await client.connect("ORD");

    const msg1: NetworkMessage = { type: "event_a", payload: { seq: 1 }, timestamp: 1 };
    const msg2: NetworkMessage = { type: "event_b", payload: { seq: 2 }, timestamp: 2 };
    const msg3: NetworkMessage = { type: "event_c", payload: { seq: 3 }, timestamp: 3 };

    host.broadcast(msg1);
    host.broadcast(msg2);
    host.broadcast(msg3);

    await new Promise((resolve) => setTimeout(resolve, 150));

    const events = clientMsgs.filter((m) => m.type.startsWith("event_"));
    expect(events.length).toBeGreaterThanOrEqual(3);

    const seqs = events.map((e) => e.payload.seq as number);
    expect(seqs[0]).toBeLessThanOrEqual(seqs[seqs.length - 1]);

    client.disconnect();
    await host.stop();
  }, 10000);
});