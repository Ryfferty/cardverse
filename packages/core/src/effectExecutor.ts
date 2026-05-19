import type {
  EffectContext,
  GameEvent,
  GameState,
  ModifierTarget,
  PlayerId,
  CardInstanceId,
  EventTypeValue,
} from "@cardverse/shared";
import { EventType } from "@cardverse/shared";
import type { EffectDefinition } from "@cardverse/deck";

export interface EffectExecutionResult {
  success: boolean;
  error?: string;
  data?: Record<string, unknown>;
  lifecycle: LifecycleStage;
}

export type LifecycleStage = "onPlay" | "onTarget" | "onResolve" | "onDiscard";

export interface ExecutorDependencies {
  eventBus: {
    emit(event: GameEvent): Promise<void>;
    requestResponse(eventType: string, event: GameEvent, timeoutMs?: number): Promise<unknown>;
  };
  state: {
    getCurrentState(): GameState;
    applyEvent(event: GameEvent): void;
  };
  resources: {
    getValue(playerId: PlayerId, resourceId: string): number | undefined;
    setValue(playerId: PlayerId, resourceId: string, value: number): Promise<void>;
  };
  zones: {
    getCards(zoneId: string): CardInstanceId[];
  };
  emitAndApply(eventData: Omit<GameEvent, "id" | "timestamp" | "stackDepth"> & { type: string }): Promise<void>;
  getState(): GameState;
}

export class EffectExecutor {
  private deps: ExecutorDependencies;
  private executionCount = 0;
  private maxSteps: number;
  private logs: string[] = [];

  constructor(deps: ExecutorDependencies, maxSteps: number = 1000) {
    this.deps = deps;
    this.maxSteps = maxSteps;
  }

  getLogs(): string[] {
    return [...this.logs];
  }

  clearLogs(): void {
    this.logs = [];
  }

  async execute(
    effect: EffectDefinition,
    options: {
      playerId: PlayerId;
      playerName: string;
      target?: PlayerId;
      targets?: PlayerId[];
      cardId?: CardInstanceId;
      event?: GameEvent;
      params?: Record<string, unknown>;
      lifecycle?: LifecycleStage;
    }
  ): Promise<EffectExecutionResult> {
    const {
      playerId,
      playerName,
      target,
      targets,
      cardId,
      event,
      params = {},
      lifecycle = "onPlay",
    } = options;

    if (!effect.script) {
      return { success: true, lifecycle, data: {} };
    }

    const primaryTarget = target ?? targets?.[0] ?? playerId;

    const context = this.createContext({
      playerId,
      playerName,
      target: primaryTarget,
      cardId,
      event,
      params: { ...effect.params, ...params },
    });

    try {
      this.executionCount++;

      if (this.executionCount > this.maxSteps) {
        return { success: false, error: `Effect execution exceeded max steps (${this.maxSteps})`, lifecycle };
      }

      const sandboxedScript = `
        const globalThis = undefined;
        const global = undefined;
        const process = undefined;
        const require = undefined;
        const fetch = undefined;
        const XMLHttpRequest = undefined;
        const importScripts = undefined;
        const WebSocket = undefined;
        const document = undefined;
        const window = undefined;
        const self = undefined;
        return (async () => { ${effect.script} })();
      `;
      const asyncFn = new Function("context", sandboxedScript);
      const result = await asyncFn(context);

      this.deps.emitAndApply({
        type: EventType.CARD_PLAYED,
        source: playerId,
        data: {
          effectId: effect.id,
          lifecycle,
          result: result ?? {},
        },
      });

      return {
        success: result?.success !== false,
        data: result as Record<string, unknown> | undefined,
        lifecycle,
      };
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.error(
        `EffectExecutor: effect "${effect.id}" failed at "${lifecycle}": ${errorMessage}`
      );
      return { success: false, error: errorMessage, lifecycle };
    }
  }

  async executeCard(
    effects: EffectDefinition[],
    options: {
      playerId: PlayerId;
      playerName: string;
      targets?: PlayerId[];
      cardId?: CardInstanceId;
      event?: GameEvent;
    }
  ): Promise<EffectExecutionResult[]> {
    const results: EffectExecutionResult[] = [];

    for (const effect of effects) {
      const result = await this.execute(effect, {
        ...options,
        lifecycle: "onPlay",
      });
      results.push(result);

      if (!result.success) break;

      if (options.targets && options.targets.length > 0) {
        for (const t of options.targets) {
          const targetResult = await this.execute(effect, {
            ...options,
            target: t,
            lifecycle: "onTarget",
          });
          results.push(targetResult);
          if (!targetResult.success) break;
        }
      }

      const resolveResult = await this.execute(effect, {
        ...options,
        lifecycle: "onResolve",
      });
      results.push(resolveResult);
    }

    return results;
  }

  private createContext(params: {
    playerId: PlayerId;
    playerName: string;
    target: PlayerId;
    cardId?: CardInstanceId;
    event?: GameEvent;
    params: Record<string, unknown>;
  }): EffectContext {
    const _state = this.deps.getState();
    const currentEvent: GameEvent = params.event ?? {
      id: `effect_ctx_${Date.now()}`,
      type: "card:played" as EventTypeValue,
      source: params.playerId,
      data: {},
      timestamp: Date.now(),
      stackDepth: 0,
    };

    const ctx: EffectContext = {
      target: params.target,
      params: params.params,

      player: {
        id: params.playerId,
        name: params.playerName,
      },

      event: currentEvent,

      requestResponse: async (
        target: PlayerId | string,
        data: Record<string, unknown>
      ): Promise<boolean | null> => {
        const respEvent: GameEvent = {
          id: `resp_req_${Date.now()}_${Math.random().toString(36).slice(2)}`,
          type: EventType.RESPONSE_REQUESTED,
          source: params.playerId,
          target: target as PlayerId,
          data,
          timestamp: Date.now(),
          parentEventId: currentEvent.id,
          stackDepth: (currentEvent.stackDepth ?? 0) + 1,
        };
        const response = (await this.deps.eventBus.requestResponse(
          EventType.RESPONSE_REQUESTED,
          respEvent,
          30000
        )) as { playerId: PlayerId; action: string; cardId?: string } | null;
        return response !== null && response.action !== "pass";
      },

      damage: async (target: PlayerId | string, amount: number): Promise<void> => {
        await this.deps.emitAndApply({
          type: EventType.DAMAGE_DEALT,
          source: params.playerId,
          target: target as PlayerId,
          data: { amount, cardId: params.cardId },
        });
      },

      getResource: async (
        playerId: PlayerId | string,
        resourceId: string
      ): Promise<number> => {
        return this.deps.resources.getValue(playerId as PlayerId, resourceId) ?? 0;
      },

      setResource: async (
        playerId: PlayerId | string,
        resourceId: string,
        value: number
      ): Promise<void> => {
        await this.deps.resources.setValue(playerId as PlayerId, resourceId, value);
      },

      addModifier: async (
        playerId: PlayerId | string,
        modifier: ModifierTarget
      ): Promise<void> => {
        await this.deps.emitAndApply({
          type: EventType.CARD_MOVED,
          source: params.playerId,
          target: playerId as PlayerId,
          data: { modifier, cardId: params.cardId },
        });
      },

      log: (message: string): void => {
        this.logs.push(`[${new Date().toISOString()}] ${message}`);
      },
    };

    return ctx;
  }
}

export function createEffectExecutor(deps: ExecutorDependencies): EffectExecutor {
  return new EffectExecutor(deps);
}