import { distance, findPath, neighbors, tileAt } from './grid';
import { generateMap } from './generate';
import { createRandom } from './random';
import type { Entity, GridPoint, NavigationState, SimulationState, WorldPoint } from './types';

const HERO_SPEED = 4;
const RESIDENT_SPEED = 0.8;
const EPSILON = 1e-6;
const footprintCache = new WeakMap<SimulationState['map'], Map<string, GridPoint[]>>();
const center = (point: GridPoint): WorldPoint => ({ x: point.x + 0.5, y: point.y + 0.5 });
const gridOf = (point: WorldPoint): GridPoint => ({ x: Math.floor(point.x), y: Math.floor(point.y) });
const same = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;
const edgeDistance = (position: WorldPoint, target: GridPoint): number => {
  const goal = center(target);
  return Math.abs(goal.x - position.x) + Math.abs(goal.y - position.y);
};

function actor(state: SimulationState, id: string): Entity { return state.entities.find((entity) => entity.id === id)!; }
function emptyNavigation(): NavigationState { return { waypoints: [], moving: false }; }

export function createWorld(seed: string): SimulationState {
  const map = generateMap(seed);
  const random = createRandom(`${seed}:residents`);
  const capital = map.settlements.find((settlement) => settlement.kind === 'capital')!;
  const entities: Entity[] = [{ id: 'hero', kind: 'hero', name: 'The Wayfarer', position: center(capital.position), navigation: emptyNavigation(), home: { ...capital.position }, color: 0xf6ce72, speed: HERO_SPEED }];
  for (const settlement of map.settlements) {
    const count = settlement.kind === 'capital' ? 3 : settlement.kind === 'city' ? 2 : 1;
    for (let index = 0; index < count; index += 1) {
      const position = { x: settlement.position.x + (index % 2), y: settlement.position.y + (index === 2 ? 1 : 0) };
      const spawn = tileAt(map, position)?.walkable ? position : settlement.position;
      entities.push({ id: `resident-${settlement.id}-${index}`, kind: 'resident', name: `${settlement.name} Resident`, position: center(spawn), home: { ...settlement.position }, navigation: emptyNavigation(), color: [0xd79772, 0x8dbad3, 0xb69ad6, 0x9fc27e][Math.floor(random() * 4)], speed: RESIDENT_SPEED, wander: { idleRemainingMs: 500 + random() * 1500, decisionCount: 0 } });
    }
  }
  return { seed, simulationTimeMs: 0, map, entities, paused: false };
}

function anchorsFor(entity: Entity): GridPoint[] {
  const edge = entity.navigation.edge;
  if (!edge) return [gridOf(entity.position)];
  return [edge.target, same(edge.target, edge.a) ? edge.b : edge.a];
}

function routeScore(entity: Entity, anchor: GridPoint, route: GridPoint[]): number {
  return edgeDistance(entity.position, anchor) + route.reduce((score, point, index) => {
    const previous = index ? route[index - 1] : anchor;
    return score + distance(previous, point);
  }, 0);
}

function chooseRoute(state: SimulationState, entity: Entity, destination: GridPoint): { anchor: GridPoint; route: GridPoint[] } | undefined {
  return anchorsFor(entity).map((anchor, index) => ({ anchor, index, route: findPath(state.map, anchor, destination) }))
    .filter(({ anchor, route }) => same(anchor, destination) || route.length > 0)
    .sort((left, right) => routeScore(entity, left.anchor, left.route) - routeScore(entity, right.anchor, right.route) || left.index - right.index)[0];
}

function setRoute(entity: Entity, anchor: GridPoint, route: GridPoint[]): void {
  const next = route[0];
  if (!next) { entity.navigation = { waypoints: [], moving: false }; return; }
  entity.navigation = { edge: { a: anchor, b: next, target: next }, waypoints: route.slice(1), moving: true };
}

function beginRoute(state: SimulationState, entity: Entity, destination: GridPoint): boolean {
  const choice = chooseRoute(state, entity, destination);
  if (!choice) return false;
  if (same(choice.anchor, destination)) { entity.position = center(destination); entity.navigation = emptyNavigation(); return true; }
  setRoute(entity, choice.anchor, choice.route);
  return true;
}

function stopEntity(entity: Entity): void { entity.navigation.waypoints = []; entity.navigation.moving = false; }

function footprintTargets(state: SimulationState, resident: Entity): GridPoint[] {
  const home = resident.home;
  if (!home) return [];
  const homeTile = tileAt(state.map, home);
  const settlement = state.map.settlements.find((candidate) => candidate.id === homeTile?.settlementId || same(candidate.position, home));
  if (!settlement) return [];
  let bySettlement = footprintCache.get(state.map);
  if (!bySettlement) { bySettlement = new Map(); footprintCache.set(state.map, bySettlement); }
  const cached = bySettlement.get(settlement.id);
  if (cached) return cached;
  const targets = state.map.tiles.filter((tile) => tile.walkable && (tile.settlementId === settlement.id || same(tile, settlement.position))).map(({ x, y }) => ({ x, y })).sort((a, b) => a.y - b.y || a.x - b.x);
  bySettlement.set(settlement.id, targets);
  return targets;
}

function chooseResidentTarget(state: SimulationState, resident: Entity): void {
  const wander = resident.wander;
  if (!wander) return;
  const currentTile = gridOf(resident.position);
  const localTargets = footprintTargets(state, resident).filter((target) => !same(target, currentTile) && distance(target, currentTile) <= 4);
  const targets = localTargets.length ? localTargets : footprintTargets(state, resident).filter((target) => !same(target, currentTile));
  if (!targets.length) { wander.idleRemainingMs = 1000; return; }
  const random = createRandom(`${state.seed}:${resident.id}:${wander.decisionCount}`);
  const target = targets.map((candidate) => ({ candidate, value: random() })).sort((a, b) => a.value - b.value)[0].candidate;
  wander.decisionCount += 1;
  if (!beginRoute(state, resident, target)) wander.idleRemainingMs = 1000;
}

function moveOne(entity: Entity, dtSeconds: number): void {
  let remaining = entity.speed * dtSeconds;
  let iterations = 0;
  while (remaining > EPSILON && entity.navigation.moving && iterations++ < 32) {
    const edge = entity.navigation.edge;
    if (!edge) { stopEntity(entity); break; }
    const target = center(edge.target);
    const distanceToTarget = Math.abs(target.x - entity.position.x) + Math.abs(target.y - entity.position.y);
    if (distanceToTarget <= remaining + EPSILON) {
      entity.position = target;
      remaining = Math.max(0, remaining - distanceToTarget);
      const next = entity.navigation.waypoints.shift();
      if (next) entity.navigation.edge = { a: edge.target, b: next, target: next };
      else { entity.navigation.edge = undefined; entity.navigation.moving = false; }
      continue;
    }
    const dx = target.x - entity.position.x;
    const dy = target.y - entity.position.y;
    if (Math.abs(dx) > Math.abs(dy)) entity.position.x += Math.sign(dx) * remaining;
    else entity.position.y += Math.sign(dy) * remaining;
    remaining = 0;
  }
}

function resolveFallback(state: SimulationState, entity: Entity, clicked: GridPoint): GridPoint | undefined {
  const reachable = new Set<string>();
  const queue = anchorsFor(entity).map((point) => ({ x: point.x, y: point.y }));
  for (const point of queue) reachable.add(`${point.x},${point.y}`);
  for (let index = 0; index < queue.length; index += 1) {
    for (const next of neighbors(state.map, queue[index])) {
      const key = `${next.x},${next.y}`;
      if (!reachable.has(key)) { reachable.add(key); queue.push(next); }
    }
  }
  for (let radius = 0; radius <= 12; radius += 1) {
    const candidates: GridPoint[] = [];
    for (const tile of state.map.tiles) {
      const mapDistance = Math.abs(tile.x - clicked.x) + Math.abs(tile.y - clicked.y);
      if (mapDistance !== radius || !tile.walkable) continue;
      const target = { x: tile.x, y: tile.y };
      if (reachable.has(`${target.x},${target.y}`)) candidates.push(target);
    }
    candidates.sort((a, b) => a.y - b.y || a.x - b.x);
    if (candidates.length) return candidates[0];
  }
  return undefined;
}

export function requestMove(state: SimulationState, destination: GridPoint): boolean {
  const hero = actor(state, 'hero');
  if (same(gridOf(hero.position), destination)) { stopEntity(hero); return true; }
  const target = tileAt(state.map, destination)?.walkable && chooseRoute(state, hero, destination) ? destination : resolveFallback(state, hero, destination);
  if (!target) { stopEntity(hero); return false; }
  const accepted = beginRoute(state, hero, target);
  if (!accepted) stopEntity(hero);
  return accepted;
}

export function advanceSimulation(state: SimulationState, dtSeconds: number): void {
  if (state.paused || dtSeconds <= 0) return;
  const previousTimeMs = state.simulationTimeMs;
  state.simulationTimeMs += dtSeconds * 1000;
  let residentDecisionAvailable = Math.floor(state.simulationTimeMs / 100) !== Math.floor(previousTimeMs / 100);
  for (const entity of state.entities) {
    if (entity.kind === 'resident' && entity.wander && !entity.navigation.moving) {
      entity.wander.idleRemainingMs -= dtSeconds * 1000;
      if (entity.wander.idleRemainingMs <= 0 && residentDecisionAvailable) {
        chooseResidentTarget(state, entity);
        residentDecisionAvailable = false;
      }
    }
    moveOne(entity, dtSeconds);
  }
}

export function tick(state: SimulationState): void { advanceSimulation(state, 1 / 60); }
export { center, gridOf };
