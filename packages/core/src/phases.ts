import { type PhaseDefinition, type TurnInfo, type PlayerId } from "@cardverse/shared";

/**
 * PhaseManager — manages turn phases (configurable + dynamic sub-phases).
 */
export class PhaseManager {
  private phases: PhaseDefinition[] = [];
  private currentIndex = 0;
  private turnNumber = 0;
  private currentPlayerId: PlayerId = "";

  setPhases(phases: PhaseDefinition[]): void {
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
    const phase = this.getCurrentPhase();
    if (!phase) return undefined;
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
  }

  /**
   * Advance to the next phase.
   * Returns the next phase, or undefined if the turn is over.
   */
  nextPhase(
    gameState?: Record<string, unknown>
  ): PhaseDefinition | undefined {
    this.currentIndex++;
    // Check dynamic phases
    while (this.currentIndex < this.phases.length) {
      const phase = this.phases[this.currentIndex];
      if (phase.condition && gameState) {
        if (!this.evaluateCondition(phase.condition, gameState)) {
          this.currentIndex++;
          continue;
        }
      }
      return phase;
    }
    return undefined; // Turn over
  }

  /**
   * Skip the current phase.
   */
  skipPhase(): boolean {
    if (this.currentIndex < this.phases.length) {
      this.currentIndex++;
      return true;
    }
    return false;
  }

  /**
   * Is the turn finished?
   */
  isTurnComplete(): boolean {
    return this.currentIndex >= this.phases.length;
  }

  /**
   * Evaluate a dynamic phase condition.
   * This is a simplified evaluator — can be extended with proper expression parsing.
   */
  private evaluateCondition(
    condition: string,
    gameState: Record<string, unknown>
  ): boolean {
    try {
      // Simple evaluation: check if condition expression is truthy
      // In production, use a sandboxed evaluator
      const fn = new Function("state", `return ${condition}`);
      return !!fn(gameState);
    } catch {
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
