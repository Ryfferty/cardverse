import { describe, it, expect } from "vitest";
import { RoleManager } from "./roles.js";

describe("RoleManager", () => {
  describe("assignRoles", () => {
    it("should assign 1 lord + 1 loyalist + 2 rebels for 4 players", () => {
      const rm = new RoleManager();
      const assignments = rm.assignRoles(["p1", "p2", "p3", "p4"]);

      expect(assignments.length).toBe(4);

      const roles = assignments.map((a) => a.role);
      expect(roles.filter((r) => r === "lord").length).toBe(1);
      expect(roles.filter((r) => r === "loyalist").length).toBe(1);
      expect(roles.filter((r) => r === "rebel").length).toBe(1);
      expect(roles.filter((r) => r === "spy").length).toBe(1);
    });

    it("should add spy for 5 players", () => {
      const rm = new RoleManager();
      const assignments = rm.assignRoles([
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
      ]);

      expect(assignments.length).toBe(5);

      const roles = assignments.map((a) => a.role);
      expect(roles.filter((r) => r === "spy").length).toBe(1);
    });

    it("should have exactly 1 lord with 2 loyalists and 1 spy for 8 players", () => {
      const rm = new RoleManager();
      const assignments = rm.assignRoles(
        Array.from({ length: 8 }, (_, i) => `p${i + 1}`)
      );

      expect(assignments.length).toBe(8);

      const roles = assignments.map((a) => a.role);
      expect(roles.filter((r) => r === "lord").length).toBe(1);
      expect(roles.filter((r) => r === "loyalist").length).toBe(2);
      expect(roles.filter((r) => r === "rebel").length).toBe(4);
      expect(roles.filter((r) => r === "spy").length).toBe(1);
    });

    it("should throw for less than 4 players", () => {
      const rm = new RoleManager();
      expect(() => rm.assignRoles(["p1", "p2"])).toThrow(
        "Need at least 4 players"
      );
    });

    it("should reveal lord role by default", () => {
      const rm = new RoleManager();
      const assignments = rm.assignRoles(["p1", "p2", "p3", "p4"]);

      const lord = assignments.find((a) => a.role === "lord");
      expect(lord).toBeDefined();
      expect(lord!.revealed).toBe(true);
    });

    it("should hide non-lord roles by default", () => {
      const rm = new RoleManager();
      const assignments = rm.assignRoles(["p1", "p2", "p3", "p4"]);

      const nonLords = assignments.filter((a) => a.role !== "lord");
      expect(nonLords.length).toBeGreaterThan(0);
      for (const a of nonLords) {
        expect(a.revealed).toBe(false);
      }
    });
  });

  describe("getRole", () => {
    it("should return assigned role", () => {
      const rm = new RoleManager();
      rm.assignRoles(["p1", "p2", "p3", "p4"]);

      const role = rm.getRole("p1");
      expect(["lord", "loyalist", "rebel", "spy"]).toContain(role);
    });

    it("should return undefined for unknown player", () => {
      const rm = new RoleManager();
      expect(rm.getRole("unknown")).toBeUndefined();
    });
  });

  describe("revealRole", () => {
    it("should reveal a hidden role", () => {
      const rm = new RoleManager();
      rm.assignRoles(["p1", "p2", "p3", "p4"]);

      const nonLord = rm
        .getAllAssignments()
        .find((a) => a.role !== "lord")!;
      expect(nonLord.revealed).toBe(false);

      rm.revealRole(nonLord.playerId);
      expect(nonLord.revealed).toBe(true);
    });
  });

  describe("getPlayerIdByRole", () => {
    it("should find lord player", () => {
      const rm = new RoleManager();
      rm.assignRoles(["p1", "p2", "p3", "p4"]);

      const lordId = rm.getPlayerIdByRole("lord");
      expect(lordId).toBeDefined();
      expect(rm.getRole(lordId!)).toBe("lord");
    });
  });

  describe("reset", () => {
    it("should clear all assignments", () => {
      const rm = new RoleManager();
      rm.assignRoles(["p1", "p2", "p3", "p4"]);
      expect(rm.getAllAssignments().length).toBe(4);

      rm.reset();
      expect(rm.getAllAssignments().length).toBe(0);
    });
  });
});