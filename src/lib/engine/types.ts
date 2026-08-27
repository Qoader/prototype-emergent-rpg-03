export type Terrain = 'meadow' | 'forest' | 'water' | 'mountain';
export type GovernmentType = 'kingdom' | 'empire';
export type SettlementKind = 'capital' | 'city' | 'village';
export type ActorKind = 'hero' | 'resident';
export type GridPoint = { x: number; y: number };
export type WorldPoint = { x: number; y: number };

export interface Tile extends GridPoint {
  terrain: Terrain;
  walkable: boolean;
  countryId?: string;
  road: boolean;
  building?: SettlementKind;
  tree?: boolean;
  settlementId?: string;
}

export interface Country {
  id: string;
  name: string;
  government: GovernmentType;
  color: number;
  capitalId: string;
}

export interface Settlement {
  id: string;
  name: string;
  kind: SettlementKind;
  countryId: string;
  position: GridPoint;
  radius: number;
}

export interface WorldMap {
  width: number;
  height: number;
  tiles: Tile[];
  countries: Country[];
  settlements: Settlement[];
}

export interface Entity {
  id: string;
  kind: ActorKind;
  name: string;
  position: WorldPoint;
  navigation: NavigationState;
  home?: GridPoint;
  destination?: GridPoint;
  color: number;
  speed: number;
  wander?: WanderState;
}

export interface ActiveEdge {
  a: GridPoint;
  b: GridPoint;
  target: GridPoint;
}

export interface NavigationState {
  edge?: ActiveEdge;
  waypoints: GridPoint[];
  moving: boolean;
}

export interface WanderState {
  idleRemainingMs: number;
  decisionCount: number;
}

export interface SimulationState {
  seed: string;
  simulationTimeMs: number;
  map: WorldMap;
  entities: Entity[];
  paused: boolean;
}

export interface WorldSnapshotV3 {
  version: 3;
  seed: string;
  simulationTimeMs: number;
  entities: Entity[];
  paused: boolean;
  countryCount: number;
  settlementCounts: Record<SettlementKind, number>;
}

export interface WorldSnapshotV2 {
  version: 2;
  seed: string;
  time: number;
  entities: Array<
    Omit<Entity, 'position' | 'navigation' | 'speed' | 'wander'> & {
      position: GridPoint;
      route: GridPoint[];
    }
  >;
  paused: boolean;
  countryCount: number;
  settlementCounts: Record<SettlementKind, number>;
}
