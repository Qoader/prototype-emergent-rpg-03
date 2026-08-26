import type { SimulationState, WorldSnapshotV1 } from './types';

const key = 'emberwild-world-v1';

export function loadWorld(): SimulationState | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const snapshot = JSON.parse(raw) as WorldSnapshotV1;
    return snapshot.version === 1 ? snapshot.state : undefined;
  } catch {
    localStorage.removeItem(key);
    return undefined;
  }
}

export function saveWorld(state: SimulationState): void {
  localStorage.setItem(key, JSON.stringify({ version: 1, state } satisfies WorldSnapshotV1));
}

export function clearWorld(): void {
  localStorage.removeItem(key);
}
