import { type PhaseDefinition, type TurnInfo, type PlayerId } from "@cardverse/shared";

const VALID_KEY = /^[A-Za-z_][A-Za-z0-9_.]*$/;

/**
 * Resolve a dotted property path (e.g., "state.hasExtraDraw") to a value.
 * This replaces `new Function()` for safe evaluation of phase conditions.
 */
function resolvePath(condition: string, state: Record<string, unknown>): unknown {
  const parts = condition.split(".");
  let current: unknown = state;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (typeof current !== "object") return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current;
}

export class PhaseManager {
  private phases: PhaseDefinition[] = [];
  private currentIndex = 0;
  private turnNumber = 0;
  private currentPlayerId: PlayerId = "";
  private lastTurnInfo: TurnInfo | undefined;

  setPhases(phases: PhaseDefinition[]): void {
    for (const phase of phases) {
      if (!phase.id || !phase.name) {
        console.warn("PhaseManager.setPhases: phase missing required id/name field", phase);
      }
    }
    this.phases = phases;
    this.currentIndex = 0;
  }

  getCurrentPhase(): PhaseDefinition | undefined {
    return this.phases[this.currentIndex];
  }

  getCurrentPhaseIndex(): number {
    return this.currentIndex;
  }

  /**
   * Get the current turn info.
   */
  getTurnInfo(): TurnInfo | undefined {
    if (this.turnNumber <= 0) return undefined;
    const phase = this.getCurrentPhase();
    if (!phase) {
      if (!this.lastTurnInfo) return undefined;
      return { ...this.lastTurnInfo };
    }
    return {
      playerId: this.currentPlayerId,
      phaseIndex: this.currentIndex,
      phaseId: phase.id,
      turnNumber: this.turnNumber,
    };
  }

  /**
   * Start a new turn for a player.
   */
  startTurn(playerId: PlayerId, turnNumber: number): void {
    this.currentPlayerId = playerId;
    this.turnNumber = turnNumber;
    this.currentIndex = 0;
    this.lastTurnInfo = {
      playerId,
      phaseIndex: 0,
      phaseId: this.phases[0]?.id ?? "",
      turnNumber,
    };
  }

  /**
   * Advance to the next phase.
   * Returns the next phase, or undefined if the turn is over.
   */
  nextPhase(
    gameState?: Record<string, unknown>
  ): PhaseDefinition | undefined {
    this.currentIndex++;
    while (this.currentIndex < this.phases.length) {
      const phase = this.phases[this.currentIndex];
      if (phase.condition && gameState) {
        if (!this.evaluateCondition(phase.condition, gameState)) {
          this.currentIndex++;
          continue;
        }
      }
      this.lastTurnInfo = {
        playerId: this.currentPlayerId,
        phaseIndex: this.currentIndex,
        phaseId: phase.id,
        turnNumber: this.turnNumber,
      };
      return phase;
    }
    // Turn over — store last info for endTurn()
    this.lastTurnInfo = {
      playerId: this.currentPlayerId,
      phaseIndex: this.phases.length,
      phaseId: "",
      turnNumber: this.turnNumber,
    };
    return undefined;
  }

  /**
   * Skip the current phase, advancing past it and any condition-blocked phases.
   */
  skipPhase(gameState?: Record<string, unknown>): boolean {
    if (this.currentIndex >= this.phases.length) {
      return false;
    }
    this.currentIndex++;
    while (this.currentIndex < this.phases.length) {
      const phase = this.phases[this.currentIndex];
      if (phase.condition && gameState) {
        if (!this.evaluateCondition(phase.condition, gameState)) {
          this.currentIndex++;
          continue;
        }
      }
      return true;
    }
    return true; // Turn over
  }

  /**
   * Is the turn finished?
   */
  isTurnComplete(): boolean {
    return this.currentIndex >= this.phases.length;
  }

  /**
   * Evaluate a dynamic phase condition.
   * Uses safe property path resolution instead of code execution.
   */
  private evaluateCondition(
    condition: string,
    gameState: Record<string, unknown>
  ): boolean {
    try {
      if (!VALID_KEY.test(condition)) {
        console.warn(`PhaseManager.evaluateCondition: invalid condition "${condition}"`);
        return false;
      }
      const result = resolvePath(condition, gameState);
      return !!result;
    } catch (e) {
      console.warn(`PhaseManager.evaluateCondition: error evaluating "${condition}"`, e);
      return false;
    }
  }

  getPhaseCount(): number {
    return this.phases.length;
  }

  getAllPhases(): PhaseDefinition[] {
    return [...this.phases];
  }

  /**
   * Reset the phase manager to initial state.
   */
  reset(): void {
    this.phases = [];
    this.currentIndex = 0;
    this.turnNumber = 0;
    this.currentPlayerId = "";
    this.lastTurnInfo = undefined;
  }

  /**
   * Jump to a specific phase index.
   * Returns the new current phase, or undefined if out of bounds.
   */
  goToPhase(index: number): PhaseDefinition | undefined {
    if (index < 0 || index >= this.phases.length) return undefined;
    this.currentIndex = index;
    return this.phases[this.currentIndex];
  }

  /**
   * Get all phases that haven't been executed yet in this turn.
   */
  getRemainingPhases(gameState?: Record<string, unknown>): PhaseDefinition[] {
    const remaining: PhaseDefinition[] = [];
    for (let i = this.currentIndex + 1; i < this.phases.length; i++) {
      const phase = this.phases[i];
      if (phase.condition && gameState) {
        if (!this.evaluateCondition(phase.condition, gameState)) continue;
      }
      remaining.push(phase);
    }
    return remaining;
  }

  /**
   * Check if a phase with the given ID exists.
   */
  hasPhase(id: string): boolean {
    return this.phases.some((p) => p.id === id);
  }

  /**
   * Find a phase by its ID.
   */
  getPhaseById(id: string): PhaseDefinition | undefined {
    return this.phases.find((p) => p.id === id);
  }

  /**
   * Check if any phase is currently active (not at or beyond end).
   */
  hasActivePhase(): boolean {
    return this.currentIndex >= 0 && this.currentIndex < this.phases.length;
  }
}
