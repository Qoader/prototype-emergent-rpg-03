import { findPath, tileAt } from './grid';
import { createRandom } from './random';
import type { Country, GridPoint, Settlement, SettlementKind, Tile, WorldMap } from './types';

export const WORLD_WIDTH = 192;
export const WORLD_HEIGHT = 144;
const countryColors = [0xb85c57, 0x6795bd, 0x8b79af, 0x719d70, 0xc38c4c];
const starts = [
  'Alder',
  'Briar',
  'Cinder',
  'Dawn',
  'Elder',
  'Frost',
  'Glen',
  'Hollow',
  'Iron',
  'Juniper',
];
const ends = ['mark', 'reach', 'vale', 'hold', 'mere', 'watch', 'fall', 'ward', 'crest', 'ford'];

const pointDistance = (a: GridPoint, b: GridPoint) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

function name(random: () => number, used: Set<string>): string {
  let candidate = '';
  do
    candidate = `${starts[Math.floor(random() * starts.length)]}${ends[Math.floor(random() * ends.length)]}`;
  while (used.has(candidate));
  used.add(candidate);
  return candidate;
}

function isLand(tile: Tile | undefined): boolean {
  return Boolean(tile && tile.terrain !== 'water' && tile.walkable);
}

function nearby(map: WorldMap, point: GridPoint, radius: number): Tile[] {
  const result: Tile[] = [];
  for (let y = point.y - radius; y <= point.y + radius; y += 1) {
    for (let x = point.x - radius; x <= point.x + radius; x += 1) {
      const candidate = { x, y };
      const tile = tileAt(map, candidate);
      if (Math.max(Math.abs(x - point.x), Math.abs(y - point.y)) <= radius && isLand(tile))
        result.push(tile!);
    }
  }
  return result;
}

function clearSettlement(map: WorldMap, settlement: Settlement): void {
  const { position, radius } = settlement;
  for (const point of nearby(map, position, radius)) {
    const tile = tileAt(map, point)!;
    tile.terrain = 'meadow';
    tile.walkable = true;
    tile.tree = false;
    tile.settlementId = settlement.id;
    const dx = point.x - position.x;
    const dy = point.y - position.y;
    if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) tile.road = true;
    else if ((Math.abs(dx) + Math.abs(dy)) % 2 === 0) tile.building = settlement.kind;
  }
  const center = tileAt(map, position)!;
  center.road = true;
  center.building = undefined;
}

function chooseSettlementSite(
  map: WorldMap,
  random: () => number,
  countryId: string,
  radius: number,
  existing: Settlement[],
): GridPoint | undefined {
  const candidates = map.tiles.filter((tile) => tile.countryId === countryId && isLand(tile));
  for (let attempt = 0; attempt < 600; attempt += 1) {
    const candidate = candidates[Math.floor(random() * candidates.length)];
    if (
      !candidate ||
      candidate.x < radius + 2 ||
      candidate.y < radius + 2 ||
      candidate.x >= map.width - radius - 2 ||
      candidate.y >= map.height - radius - 2
    )
      continue;
    const footprint = nearby(map, candidate, radius);
    if (footprint.length < (radius * 2 + 1) ** 2) continue;
    if (footprint.some((tile) => tile.countryId !== countryId || tile.settlementId)) continue;
    if (
      existing.some(
        (settlement) =>
          pointDistance(settlement.position, candidate) < settlement.radius + radius + 7,
      )
    )
      continue;
    return candidate;
  }
  return undefined;
}

function connect(map: WorldMap, source: GridPoint, target: GridPoint): void {
  const line = (horizontalFirst: boolean): GridPoint[] => {
    const points: GridPoint[] = [];
    let { x, y } = source;
    const walk = (axis: 'x' | 'y') => {
      const destination = axis === 'x' ? target.x : target.y;
      while ((axis === 'x' ? x : y) !== destination) {
        if (axis === 'x') x += Math.sign(destination - x);
        else y += Math.sign(destination - y);
        points.push({ x, y });
      }
    };
    walk(horizontalFirst ? 'x' : 'y');
    walk(horizontalFirst ? 'y' : 'x');
    return points;
  };
  const horizontal = line(true);
  const vertical = line(false);
  const path = !horizontal.some((point) => tileAt(map, point)?.terrain === 'water')
    ? horizontal
    : !vertical.some((point) => tileAt(map, point)?.terrain === 'water')
      ? vertical
      : findPath(map, source, target);
  for (const point of path) {
    const tile = tileAt(map, point)!;
    tile.road = true;
    tile.walkable = true;
    tile.tree = false;
  }
}

export function generateMap(seed: string, width = WORLD_WIDTH, height = WORLD_HEIGHT): WorldMap {
  const random = createRandom(seed);
  const tiles: Tile[] = [];
  const center = { x: width / 2, y: height / 2 };
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const nx = (x - center.x) / (width * 0.46);
      const ny = (y - center.y) / (height * 0.45);
      const edge = Math.sqrt(nx * nx + ny * ny);
      const noise = random() * 0.32 - 0.16;
      const water = edge + noise > 0.93;
      const mountain = !water && random() < 0.075 + Math.max(0, edge - 0.55) * 0.16;
      const forest = !water && !mountain && random() < 0.27;
      tiles.push({
        x,
        y,
        terrain: water ? 'water' : mountain ? 'mountain' : forest ? 'forest' : 'meadow',
        walkable: !water,
        road: false,
      });
    }
  }
  const map: WorldMap = { width, height, tiles, countries: [], settlements: [] };
  const countryCount = 4 + Math.floor(random() * 2);
  const countrySeeds: GridPoint[] = [];
  const land = tiles.filter(
    (tile) =>
      isLand(tile) && tile.x > 12 && tile.y > 12 && tile.x < width - 12 && tile.y < height - 12,
  );
  while (countrySeeds.length < countryCount) {
    const candidate = land[Math.floor(random() * land.length)];
    if (candidate && countrySeeds.every((site) => pointDistance(site, candidate) >= 34))
      countrySeeds.push(candidate);
  }
  const usedNames = new Set<string>();
  map.countries = countrySeeds.map((site, index) => ({
    id: `country-${index}`,
    name: name(random, usedNames),
    government: random() < 0.7 ? 'kingdom' : 'empire',
    color: countryColors[index],
    capitalId: `capital-${index}`,
    site,
  })) as (Country & { site: GridPoint })[];
  for (const tile of tiles) {
    if (!isLand(tile)) continue;
    let nearest = 0;
    for (let index = 1; index < countrySeeds.length; index += 1) {
      if (pointDistance(tile, countrySeeds[index]) < pointDistance(tile, countrySeeds[nearest]))
        nearest = index;
    }
    tile.countryId = `country-${nearest}`;
  }

  for (const country of map.countries as (Country & { site: GridPoint })[]) {
    const settlements: Settlement[] = [];
    const create = (kind: SettlementKind, id: string, radius: number): Settlement | undefined => {
      const position =
        kind === 'capital'
          ? country.site
          : chooseSettlementSite(map, random, country.id, radius, map.settlements);
      if (!position) return undefined;
      const settlement = {
        id,
        name: kind === 'capital' ? `${country.name} Crown` : name(random, usedNames),
        kind,
        countryId: country.id,
        position: { ...position },
        radius,
      };
      clearSettlement(map, settlement);
      map.settlements.push(settlement);
      settlements.push(settlement);
      return settlement;
    };
    const capital = create('capital', country.capitalId, 4)!;
    const cityCount = 3 + Math.floor(random() * 2);
    const cities = Array.from({ length: cityCount }, (_, index) =>
      create('city', `city-${country.id}-${index}`, 3),
    ).filter(Boolean) as Settlement[];
    const villageCount = 10 + Math.floor(random() * 6);
    const villages = Array.from({ length: villageCount }, (_, index) =>
      create('village', `village-${country.id}-${index}`, 2),
    ).filter(Boolean) as Settlement[];
    const hubs = [capital];
    for (const city of cities) {
      const nearest = hubs.reduce((best, hub) =>
        pointDistance(hub.position, city.position) < pointDistance(best.position, city.position)
          ? hub
          : best,
      );
      connect(map, city.position, nearest.position);
      hubs.push(city);
    }
    for (const village of villages) {
      const nearest = hubs.reduce((best, hub) =>
        pointDistance(hub.position, village.position) <
        pointDistance(best.position, village.position)
          ? hub
          : best,
      );
      connect(map, village.position, nearest.position);
    }
    void settlements;
  }
  for (const tile of tiles) {
    if (tile.terrain === 'forest' && !tile.road && !tile.building && random() < 0.56)
      tile.tree = true;
  }
  // Remove generator-only capital sites from the public map shape.
  map.countries = map.countries.map(({ id, name: countryName, government, color, capitalId }) => ({
    id,
    name: countryName,
    government,
    color,
    capitalId,
  }));
  return map;
}

export const heroSpawn: GridPoint = { x: 0, y: 0 };
