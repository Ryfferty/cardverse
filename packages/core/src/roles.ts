import type { PlayerId, PlayerRole, RoleAssignment } from "@cardverse/shared";

function fisherYatesShuffle<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export type VictoryResult = {
  winner: PlayerRole;
  condition: string;
} | null;

export class RoleManager {
  private assignments: Map<PlayerId, RoleAssignment> = new Map();

  assignRoles(playerIds: PlayerId[]): RoleAssignment[] {
    this.assignments.clear();
    const count = playerIds.length;

    if (count < 4) {
      throw new Error(`Need at least 4 players for role assignment (got ${count})`);
    }

    const shuffled = fisherYatesShuffle([...playerIds]);
    const roles = this.distributeRoles(count);
    const shuffledRoles = fisherYatesShuffle(roles);

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

  checkVictory(alivePlayerIds: PlayerId[]): VictoryResult {
    if (alivePlayerIds.length === 0) return null;

    const aliveRoles = alivePlayerIds
      .map((pid) => this.assignments.get(pid))
      .filter((a): a is RoleAssignment => a !== undefined);

    const lordAlive = aliveRoles.some((a) => a.role === "lord");
    const rebelAlive = aliveRoles.some((a) => a.role === "rebel");
    const spyAlive = aliveRoles.some((a) => a.role === "spy");
    const loyalistAlive = aliveRoles.some((a) => a.role === "loyalist");

    if (!lordAlive) {
      if (aliveRoles.length === 1 && spyAlive) {
        return { winner: "spy", condition: "spy_solo_victory" };
      }
      return { winner: "rebel", condition: "rebel_victory" };
    }

    if (!rebelAlive && !spyAlive) {
      return { winner: "lord", condition: "lord_victory" };
    }

    if (lordAlive && loyalistAlive && !rebelAlive && aliveRoles.length === 2) {
      return { winner: "lord", condition: "lord_victory" };
    }

    return null;
  }

  private distributeRoles(playerCount: number): PlayerRole[] {
    switch (playerCount) {
      case 4:
        return ["lord", "loyalist", "rebel", "spy"];
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