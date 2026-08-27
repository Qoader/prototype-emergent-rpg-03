import { createWorld } from './simulation';
import { center } from './simulation';
import type { Entity, SimulationState, WorldSnapshotV2, WorldSnapshotV3 } from './types';

const key = 'emberwild-world-v2';
const legacyKey = 'emberwild-world-v1';

export function loadWorld(): SimulationState | undefined {
  try {
    localStorage.removeItem(legacyKey);
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as WorldSnapshotV2 | WorldSnapshotV3;
    if (snapshot.version === 2) {
      const state = createWorld(snapshot.seed);
      state.simulationTimeMs = snapshot.time * 250;
      state.entities = snapshot.entities.map((entity) => ({
        ...entity,
        position: center(entity.position),
        navigation: { waypoints: entity.route, moving: entity.route.length > 0 },
        speed: entity.kind === 'hero' ? 4 : 0.8,
        wander:
          entity.kind === 'resident' ? { idleRemainingMs: 1000, decisionCount: 0 } : undefined,
      })) as Entity[];
      state.paused = snapshot.paused;
      return state;
    }
    if (snapshot.version !== 3) return undefined;
    const state = createWorld(snapshot.seed);
    state.simulationTimeMs = snapshot.simulationTimeMs;
    state.entities = snapshot.entities;
    state.paused = snapshot.paused;
    return state;
  } catch {
    localStorage.removeItem(key);
    return undefined;
  }
}

export function saveWorld(state: SimulationState): void {
  const settlementCounts = { capital: 0, city: 0, village: 0 };
  for (const settlement of state.map.settlements) settlementCounts[settlement.kind] += 1;
  const snapshot: WorldSnapshotV3 = {
    version: 3,
    seed: state.seed,
    simulationTimeMs: state.simulationTimeMs,
    entities: state.entities,
    paused: state.paused,
    countryCount: state.map.countries.length,
    settlementCounts,
  };
  localStorage.setItem(key, JSON.stringify(snapshot));
}

export function clearWorld(): void {
  localStorage.removeItem(key);
  localStorage.removeItem(legacyKey);
}
