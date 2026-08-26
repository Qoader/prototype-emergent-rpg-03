import { findPath, distance, tileAt } from './grid';
import { generateMap, heroSpawn } from './generate';
import type { Entity, GridPoint, SimulationState, WorldEvent } from './types';

const maxEvents = 8;

function event(state: SimulationState, text: string): void {
  const next: WorldEvent = { id: `${state.time}-${text}`, time: state.time, text };
  state.events = [next, ...state.events].slice(0, maxEvents);
}

function actor(state: SimulationState, id: string): Entity {
  return state.entities.find((entity) => entity.id === id)!;
}

export function createWorld(seed: string): SimulationState {
  const state: SimulationState = {
    seed,
    time: 0,
    map: generateMap(seed),
    entities: [
      { id: 'hero', kind: 'hero', name: 'The Wayfarer', position: heroSpawn, route: [] },
      {
        id: 'guard',
        kind: 'guard',
        name: 'Ashwood Guard',
        position: { x: 5, y: 11 },
        route: [],
        home: { x: 5, y: 11 },
      },
      {
        id: 'threat',
        kind: 'threat',
        name: 'Gloam Pack',
        position: { x: 23, y: 11 },
        route: [],
        home: { x: 25, y: 14 },
      },
    ],
    facts: { villageAlarm: false, threatRepelled: false, shrineBlessed: false },
    events: [],
    paused: false,
    ruleCooldowns: {},
  };
  event(state, 'You awaken on the old Ember Road.');
  reveal(state, heroSpawn);
  return state;
}

export function requestMove(state: SimulationState, destination: GridPoint): boolean {
  const hero = actor(state, 'hero');
  const route = findPath(state.map, hero.position, destination);
  if (!route.length) return false;
  hero.route = route;
  return true;
}

function reveal(state: SimulationState, point: GridPoint): void {
  for (const tile of state.map.tiles) {
    if (distance(tile, point) <= 3) tile.discovered = true;
  }
}

function moveOne(entity: Entity): void {
  const next = entity.route.shift();
  if (next) entity.position = next;
}

function runRules(state: SimulationState): void {
  const hero = actor(state, 'hero');
  const guard = actor(state, 'guard');
  const threat = actor(state, 'threat');
  const village = { x: 5, y: 11 };
  const shrine = { x: 16, y: 7 };

  if (
    !state.facts.villageAlarm &&
    !state.facts.threatRepelled &&
    distance(threat.position, village) <= 8
  ) {
    state.facts.villageAlarm = true;
    guard.route = findPath(state.map, guard.position, threat.position);
    event(state, 'Ashwood rings its bell: the Gloam Pack stalks the road.');
  }
  if (
    state.facts.villageAlarm &&
    !state.facts.threatRepelled &&
    distance(guard.position, threat.position) <= 1
  ) {
    state.facts.threatRepelled = true;
    state.facts.villageAlarm = false;
    threat.route = findPath(state.map, threat.position, threat.home!);
    event(state, 'The Ashwood Guard drives the Gloam Pack back toward the ruins.');
  }
  if (!state.facts.shrineBlessed && distance(hero.position, shrine) <= 1) {
    state.facts.shrineBlessed = true;
    event(state, 'The shrine-fire answers your presence; the wilds grow brighter.');
  }
  const tile = tileAt(state.map, hero.position);
  if (tile?.landmark && !state.ruleCooldowns[`visit:${tile.landmark}`]) {
    state.ruleCooldowns[`visit:${tile.landmark}`] = 1;
    event(
      state,
      `You discover ${tile.landmark === 'village' ? 'Ashwood' : `an ancient ${tile.landmark}`}.`,
    );
  }
}

export function tick(state: SimulationState): void {
  if (state.paused) return;
  state.time += 1;
  moveOne(actor(state, 'hero'));
  if (state.time % 2 === 0) moveOne(actor(state, 'guard'));
  if (state.time % 3 === 0 && !state.facts.threatRepelled) {
    const threat = actor(state, 'threat');
    threat.route = findPath(state.map, threat.position, { x: 5, y: 11 });
    moveOne(threat);
  }
  reveal(state, actor(state, 'hero').position);
  runRules(state);
}
