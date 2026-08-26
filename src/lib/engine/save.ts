import { createWorld } from './simulation';
import type { SimulationState, WorldSnapshotV2 } from './types';

const key = 'emberwild-world-v2';
const legacyKey = 'emberwild-world-v1';

export function loadWorld(): SimulationState | undefined {
  try {
    localStorage.removeItem(legacyKey);
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as WorldSnapshotV2;
    if (snapshot.version !== 2) return undefined;
    const state = createWorld(snapshot.seed);
    state.time = snapshot.time;
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
  const snapshot: WorldSnapshotV2 = {
    version: 2,
    seed: state.seed,
    time: state.time,
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
