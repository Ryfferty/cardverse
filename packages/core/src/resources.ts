import {
  type ResourceDefinition,
  type ResourceState,
  type ResourceId,
  type PlayerId,
  EventType,
} from "@cardverse/shared";
import type { EventBus } from "./events.js";

/**
 * ResourceManager — manages player resources (HP, mana, custom).
 * Resource changes emit events.
 */
export class ResourceManager {
  private resources = new Map<PlayerId, Map<ResourceId, ResourceState>>();
  private definitions = new Map<ResourceId, ResourceDefinition>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  registerDefinition(def: ResourceDefinition): void {
    this.definitions.set(def.id, def);
  }

  initResource(playerId: PlayerId, resourceId: ResourceId): void {
    const def = this.definitions.get(resourceId);
    if (!def) {
      console.warn(`ResourceManager.initResource: definition "${resourceId}" not registered`);
      return;
    }
    let playerResources = this.resources.get(playerId);
    if (!playerResources) {
      playerResources = new Map();
      this.resources.set(playerId, playerResources);
    }
    playerResources.set(resourceId, {
      definitionId: resourceId,
      current: def.defaultValue,
      min: def.min ?? 0,
      max: def.max ?? Infinity,
    });
  }

  getValue(playerId: PlayerId, resourceId: ResourceId): number | undefined {
    return this.resources.get(playerId)?.get(resourceId)?.current;
  }

  getResource(playerId: PlayerId, resourceId: ResourceId): ResourceState | undefined {
    return this.resources.get(playerId)?.get(resourceId);
  }

  async modify(
    playerId: PlayerId,
    resourceId: ResourceId,
    delta: number,
    source?: string
  ): Promise<number> {
    const resource = this.resources.get(playerId)?.get(resourceId);
    if (!resource) {
      throw new Error(`ResourceManager.modify: resource "${resourceId}" not initialized for player "${playerId}"`);
    }

    const oldValue = resource.current;
    resource.current = Math.max(resource.min, Math.min(resource.max, resource.current + delta));
    const newValue = resource.current;

    await this.eventBus.emit({
      id: `res_${Date.now()}`,
      type: EventType.RESOURCE_CHANGED,
      source: source ?? "system",
      target: playerId,
      data: {
        playerId,
        resourceId,
        oldValue,
        newValue,
        delta,
      },
      timestamp: Date.now(),
      stackDepth: 0,
    });

    return newValue;
  }

  async set(
    playerId: PlayerId,
    resourceId: ResourceId,
    value: number,
    source?: string
  ): Promise<number> {
    const current = this.getValue(playerId, resourceId) ?? 0;
    return this.modify(playerId, resourceId, value - current, source);
  }

  async applyRegen(playerIds: PlayerId[]): Promise<void> {
    for (const playerId of playerIds) {
      for (const [resourceId, def] of this.definitions) {
        if (def.regenPerTurn && def.regenPerTurn !== 0) {
          const resource = this.resources.get(playerId)?.get(resourceId);
          if (!resource) continue;
          await this.modify(playerId, resourceId, def.regenPerTurn, "regen");
        }
      }
    }
  }

  getDefinitions(): Map<ResourceId, ResourceDefinition> {
    return new Map(this.definitions);
  }

  getDefinition(resourceId: ResourceId): ResourceDefinition | undefined {
    return this.definitions.get(resourceId);
  }

  isInitialized(playerId: PlayerId, resourceId: ResourceId): boolean {
    return this.resources.get(playerId)?.has(resourceId) ?? false;
  }

  async resetToDefault(playerId: PlayerId, resourceId: ResourceId): Promise<number | undefined> {
    const def = this.definitions.get(resourceId);
    const resource = this.resources.get(playerId)?.get(resourceId);
    if (!def || !resource) return undefined;
    return await this.set(playerId, resourceId, def.defaultValue, "reset");
  }

  getPlayerResourceCount(playerId: PlayerId): number {
    return this.resources.get(playerId)?.size ?? 0;
  }

  getPlayerResources(playerId: PlayerId): Map<ResourceId, ResourceState> {
    const playerResources = this.resources.get(playerId);
    if (!playerResources) return new Map();
    return new Map(playerResources);
  }

  clear(): void {
    this.resources.clear();
    this.definitions.clear();
  }
}