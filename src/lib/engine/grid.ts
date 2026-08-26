import type { GridPoint, WorldMap } from './types';

export const keyOf = ({ x, y }: GridPoint): string => `${x},${y}`;
export const equals = (a: GridPoint, b: GridPoint): boolean => a.x === b.x && a.y === b.y;

export function tileAt(map: WorldMap, point: GridPoint) {
  if (point.x < 0 || point.y < 0 || point.x >= map.width || point.y >= map.height) return undefined;
  return map.tiles[point.y * map.width + point.x];
}

export function neighbors(map: WorldMap, point: GridPoint): GridPoint[] {
  return [
    { x: point.x + 1, y: point.y },
    { x: point.x - 1, y: point.y },
    { x: point.x, y: point.y + 1 },
    { x: point.x, y: point.y - 1 },
  ].filter((candidate) => tileAt(map, candidate)?.walkable);
}

export function distance(a: GridPoint, b: GridPoint): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

export function findPath(map: WorldMap, start: GridPoint, goal: GridPoint): GridPoint[] {
  if (!tileAt(map, goal)?.walkable || equals(start, goal)) return [];
  const open = [start];
  const cameFrom = new Map<string, GridPoint>();
  const score = new Map<string, number>([[keyOf(start), 0]]);
  const closed = new Set<string>();

  const priority = (point: GridPoint) =>
    (score.get(keyOf(point)) ?? Infinity) + distance(point, goal);
  const enqueue = (point: GridPoint): void => {
    open.push(point);
    let index = open.length - 1;
    while (index > 0) {
      const parent = Math.floor((index - 1) / 2);
      if (priority(open[parent]) <= priority(open[index])) break;
      [open[parent], open[index]] = [open[index], open[parent]];
      index = parent;
    }
  };
  const dequeue = (): GridPoint => {
    const first = open[0];
    const last = open.pop()!;
    if (open.length) {
      open[0] = last;
      let index = 0;
      while (true) {
        const left = index * 2 + 1;
        const right = left + 1;
        let smallest = index;
        if (left < open.length && priority(open[left]) < priority(open[smallest])) smallest = left;
        if (right < open.length && priority(open[right]) < priority(open[smallest]))
          smallest = right;
        if (smallest === index) break;
        [open[index], open[smallest]] = [open[smallest], open[index]];
        index = smallest;
      }
    }
    return first;
  };

  while (open.length) {
    const current = dequeue();
    if (closed.has(keyOf(current))) continue;
    if (equals(current, goal)) {
      const path: GridPoint[] = [];
      let step = current;
      while (!equals(step, start)) {
        path.unshift(step);
        step = cameFrom.get(keyOf(step))!;
      }
      return path;
    }
    closed.add(keyOf(current));
    for (const next of neighbors(map, current)) {
      if (closed.has(keyOf(next))) continue;
      const nextTile = tileAt(map, next)!;
      const cost = nextTile.road
        ? 0.65
        : nextTile.terrain === 'mountain'
          ? 4
          : nextTile.terrain === 'forest'
            ? 1.5
            : 1;
      const tentative = (score.get(keyOf(current)) ?? Infinity) + cost;
      if (tentative < (score.get(keyOf(next)) ?? Infinity)) {
        cameFrom.set(keyOf(next), current);
        score.set(keyOf(next), tentative);
        enqueue(next);
      }
    }
  }
  return [];
}
