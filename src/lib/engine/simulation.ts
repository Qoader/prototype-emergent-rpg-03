import { findPath, tileAt } from './grid';
import { generateMap } from './generate';
import { createRandom } from './random';
import type { Entity, GridPoint, SimulationState } from './types';

function actor(state: SimulationState, id: string): Entity {
  return state.entities.find((entity) => entity.id === id)!;
}

export function createWorld(seed: string): SimulationState {
  const map = generateMap(seed);
  const random = createRandom(`${seed}:residents`);
  const capital = map.settlements.find((settlement) => settlement.kind === 'capital')!;
  const entities: Entity[] = [
    {
      id: 'hero',
      kind: 'hero',
      name: 'The Wayfarer',
      position: { ...capital.position },
      route: [],
      home: { ...capital.position },
      color: 0xf6ce72,
    },
  ];
  for (const settlement of map.settlements) {
    const count = settlement.kind === 'capital' ? 3 : settlement.kind === 'city' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const position = {
        x: settlement.position.x + (index % 2),
        y: settlement.position.y + (index === 2 ? 1 : 0),
      };
      entities.push({
        id: `resident-${settlement.id}-${index}`,
        kind: 'resident',
        name: `${settlement.name} Resident`,
        position,
        home: { ...settlement.position },
        route: [],
        color: [0xd79772, 0x8dbad3, 0xb69ad6, 0x9fc27e][Math.floor(random() * 4)],
      });
    }
  }
  return { seed, time: 0, map, entities, paused: false };
}

export function requestMove(state: SimulationState, destination: GridPoint): boolean {
  const hero = actor(state, 'hero');
  const route = findPath(state.map, hero.position, destination);
  if (!route.length) return false;
  hero.route = route;
  return true;
}

function moveOne(entity: Entity): void {
  const next = entity.route.shift();
  if (next) entity.position = next;
}

function residentDestination(state: SimulationState, resident: Entity): GridPoint | undefined {
  const tile = tileAt(state.map, resident.home!);
  const settlement = state.map.settlements.find(
    (candidate) =>
      candidate.id === tile?.settlementId ||
      (candidate.position.x === resident.home!.x && candidate.position.y === resident.home!.y),
  );
  if (!settlement) return undefined;
  const phase = (state.time + resident.id.length * 17) % 4;
  return {
    x: settlement.position.x + (phase === 0 ? 1 : phase === 1 ? -1 : 0),
    y: settlement.position.y + (phase === 2 ? 1 : phase === 3 ? -1 : 0),
  };
}

export function tick(state: SimulationState): void {
  if (state.paused) return;
  state.time += 1;
  moveOne(actor(state, 'hero'));
  if (state.time % 5 !== 0) return;
  for (const resident of state.entities.filter((entity) => entity.kind === 'resident')) {
    if (resident.route.length) {
      moveOne(resident);
      continue;
    }
    const destination = residentDestination(state, resident);
    if (destination)
      resident.route = findPath(state.map, resident.position, destination).slice(0, 4);
  }
}
