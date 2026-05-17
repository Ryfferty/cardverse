import {
  type ResourceDefinition,
  type ResourceState,
  type ResourceId,
  type PlayerId,
  EventType,
} from "@cardverse/shared";
import { EventBus, type EventHandler } from "./events.js";

/**
 * ResourceManager — manages player resources (HP, mana, custom).
 * Resource changes emit events.
 */
export class ResourceManager {
  private resources = new Map<string, ResourceState>();
  private definitions = new Map<ResourceId, ResourceDefinition>();
  private eventBus: EventBus;

  constructor(eventBus: EventBus) {
    this.eventBus = eventBus;
  }

  /**
   * Register a resource definition.
   */
  registerDefinition(def: ResourceDefinition): void {
    this.definitions.set(def.id, def);
  }

  /**
   * Initialize a resource for a player.
   */
  initResource(playerId: PlayerId, resourceId: ResourceId): void {
    const def = this.definitions.get(resourceId);
    if (!def) return;
    const key = `${playerId}:${resourceId}`;
    this.resources.set(key, {
      definitionId: resourceId,
      current: def.defaultValue,
      min: def.min ?? 0,
      max: def.max ?? Infinity,
    });
  }

  /**
   * Get a player's resource value.
   */
  getValue(playerId: PlayerId, resourceId: ResourceId): number | undefined {
    return this.resources.get(`${playerId}:${resourceId}`)?.current;
  }

  /**
   * Get a player's full resource state.
   */
  getResource(playerId: PlayerId, resourceId: ResourceId): ResourceState | undefined {
    return this.resources.get(`${playerId}:${resourceId}`);
  }

  /**
   * Modify a resource value (emits RESOURCE_CHANGED event).
   */
  modify(
    playerId: PlayerId,
    resourceId: ResourceId,
    delta: number,
    source?: string
  ): number {
    const key = `${playerId}:${resourceId}`;
    const resource = this.resources.get(key);
    if (!resource) return 0;

    const oldValue = resource.current;
    resource.current = Math.max(resource.min, Math.min(resource.max, resource.current + delta));
    const newValue = resource.current;

    // Emit event
    this.eventBus.emit({
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

  /**
   * Set a resource to an absolute value.
   */
  set(
    playerId: PlayerId,
    resourceId: ResourceId,
    value: number,
    source?: string
  ): number {
    const current = this.getValue(playerId, resourceId) ?? 0;
    return this.modify(playerId, resourceId, value - current, source);
  }

  /**
   * Apply per-turn regeneration for all players.
   */
  applyRegen(playerIds: PlayerId[]): void {
    for (const playerId of playerIds) {
      for (const [resourceId, def] of this.definitions) {
        if (def.regenPerTurn && def.regenPerTurn !== 0) {
          this.modify(playerId, resourceId, def.regenPerTurn, "regen");
        }
      }
    }
  }

  /**
   * Get all resources for a player.
   */
  getPlayerResources(playerId: PlayerId): Map<ResourceId, ResourceState> {
    const result = new Map<ResourceId, ResourceState>();
    for (const [key, resource] of this.resources) {
      if (key.startsWith(`${playerId}:`)) {
        result.set(resource.definitionId, resource);
      }
    }
    return result;
  }

  clear(): void {
    this.resources.clear();
    this.definitions.clear();
  }
}
