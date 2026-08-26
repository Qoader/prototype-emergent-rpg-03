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

  while (open.length) {
    open.sort(
      (a, b) =>
        (score.get(keyOf(a)) ?? Infinity) +
        distance(a, goal) -
        ((score.get(keyOf(b)) ?? Infinity) + distance(b, goal)),
    );
    const current = open.shift()!;
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
      const tentative = (score.get(keyOf(current)) ?? Infinity) + 1;
      if (tentative < (score.get(keyOf(next)) ?? Infinity)) {
        cameFrom.set(keyOf(next), current);
        score.set(keyOf(next), tentative);
        if (!open.some((point) => equals(point, next))) open.push(next);
      }
    }
  }
  return [];
}
