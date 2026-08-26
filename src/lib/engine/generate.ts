import { createRandom } from './random';
import type { GridPoint, Terrain, Tile, WorldMap } from './types';

const terrainColors: Terrain[] = [
  'meadow',
  'meadow',
  'meadow',
  'forest',
  'forest',
  'water',
  'mountain',
];

export function generateMap(seed: string, width = 30, height = 22): WorldMap {
  const random = createRandom(seed);
  const tiles: Tile[] = [];
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const edge = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      let terrain = edge ? 'mountain' : terrainColors[Math.floor(random() * terrainColors.length)];
      if (y === Math.floor(height / 2)) terrain = 'road';
      tiles.push({
        x,
        y,
        terrain,
        walkable: terrain !== 'water' && terrain !== 'mountain',
        discovered: false,
      });
    }
  }
  const map = { width, height, tiles };
  const landmarks: Array<[GridPoint, 'village' | 'shrine' | 'ruin']> = [
    [{ x: 5, y: 11 }, 'village'],
    [{ x: 16, y: 7 }, 'shrine'],
    [{ x: 25, y: 14 }, 'ruin'],
  ];
  for (const [point, landmark] of landmarks) {
    const tile = tiles[point.y * width + point.x];
    tile.terrain = 'road';
    tile.walkable = true;
    tile.landmark = landmark;
  }
  return map;
}

export const heroSpawn: GridPoint = { x: 10, y: 11 };
