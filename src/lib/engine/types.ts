export type Terrain = 'meadow' | 'forest' | 'water' | 'mountain' | 'road';
export type LandmarkKind = 'village' | 'shrine' | 'ruin';
export type ActorKind = 'hero' | 'guard' | 'threat';
export type GridPoint = { x: number; y: number };

export interface Tile extends GridPoint {
  terrain: Terrain;
  walkable: boolean;
  discovered: boolean;
  landmark?: LandmarkKind;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[];
}

export interface Entity {
  id: string;
  kind: ActorKind;
  name: string;
  position: GridPoint;
  route: GridPoint[];
  home?: GridPoint;
}

export interface WorldFacts {
  villageAlarm: boolean;
  threatRepelled: boolean;
  shrineBlessed: boolean;
}

export interface WorldEvent {
  id: string;
  time: number;
  text: string;
}

export interface SimulationState {
  seed: string;
  time: number;
  map: WorldMap;
  entities: Entity[];
  facts: WorldFacts;
  events: WorldEvent[];
  paused: boolean;
  ruleCooldowns: Record<string, number>;
}

export interface WorldSnapshotV1 {
  version: 1;
  state: SimulationState;
}
