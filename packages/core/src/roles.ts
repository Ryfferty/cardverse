import type { PlayerId, PlayerRole, RoleAssignment } from "@cardverse/shared";

export class RoleManager {
  private assignments: Map<PlayerId, RoleAssignment> = new Map();

  assignRoles(playerIds: PlayerId[]): RoleAssignment[] {
    this.assignments.clear();
    const count = playerIds.length;

    if (count < 4) {
      throw new Error(`Need at least 4 players for role assignment (got ${count})`);
    }

    const shuffled = [...playerIds].sort(() => Math.random() - 0.5);
    const roles = this.distributeRoles(count);
    const shuffledRoles = roles.sort(() => Math.random() - 0.5);

    const lordIdx = shuffledRoles.indexOf("lord");
    if (lordIdx >= 0) {
      shuffledRoles.splice(lordIdx, 1);
    }

    const assignments: RoleAssignment[] = [];

    assignments.push({
      playerId: shuffled[0],
      role: "lord",
      revealed: true,
    });

    for (let i = 1; i < shuffled.length; i++) {
      assignments.push({
        playerId: shuffled[i],
        role: shuffledRoles[i - 1],
        revealed: false,
      });
    }

    for (const a of assignments) {
      this.assignments.set(a.playerId, a);
    }

    return assignments;
  }

  getRole(playerId: PlayerId): PlayerRole | undefined {
    return this.assignments.get(playerId)?.role;
  }

  getAssignment(playerId: PlayerId): RoleAssignment | undefined {
    return this.assignments.get(playerId);
  }

  getPlayerIdByRole(role: PlayerRole): PlayerId | undefined {
    for (const [, a] of this.assignments) {
      if (a.role === role) return a.playerId;
    }
    return undefined;
  }

  revealRole(playerId: PlayerId): void {
    const a = this.assignments.get(playerId);
    if (a) {
      a.revealed = true;
    }
  }

  getAllAssignments(): RoleAssignment[] {
    return [...this.assignments.values()];
  }

  reset(): void {
    this.assignments.clear();
  }

  private distributeRoles(playerCount: number): PlayerRole[] {
    switch (playerCount) {
      case 4:
        return ["lord", "loyalist", "rebel", "rebel"];
      case 5:
        return ["lord", "loyalist", "rebel", "rebel", "spy"];
      case 6:
        return ["lord", "loyalist", "rebel", "rebel", "rebel", "spy"];
      case 7:
        return ["lord", "loyalist", "loyalist", "rebel", "rebel", "rebel", "spy"];
      case 8:
        return [
          "lord",
          "loyalist",
          "loyalist",
          "rebel",
          "rebel",
          "rebel",
          "rebel",
          "spy",
        ];
      default:
        throw new Error(`Unsupported player count: ${playerCount}`);
    }
  }
}