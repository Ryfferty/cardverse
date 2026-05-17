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
}
