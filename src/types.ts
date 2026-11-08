export type RegionId = 'crateria' | 'brinstar' | 'norfair' | 'wrecked_ship' | 'maridia' | 'tourian';
export type Point = [number, number];
export type Rect = [x: number, y: number, w: number, h: number];

export interface Room {
  id: string;            // e.g. "brinstar_012"
  region: RegionId;
  bbox: Rect;            // image pixels
  polygon: Point[];      // outline, image pixels
}

export type DoorType = 'normal' | 'missile' | 'super' | 'power_bomb' | 'boss' | 'other';

export interface Door {
  type: DoorType;
  center: Point;
  orientation: 'vertical' | 'horizontal';
  color: [number, number, number];
}

export interface Passage {
  kind: 'dash_cyan' | 'dash_magenta' | 'dash_red' | 'dash';
  center: Point;
  orientation: 'vertical' | 'horizontal';
}

export interface Connection {
  a: string; b: string;                 // room ids
  kind: 'door' | 'passage';
  xy: Point;
  doorType?: DoorType;
  passageType?: string;
}

export interface Marker {
  type: string;                         // 'save', 'missile_tank', 'morph_ball', ...
  category: 'save' | 'map_station' | 'recharge' | 'tank' | 'upgrade' | 'ship';
  xy: Point;
  room: string | null;
}

export interface Boss {
  name: string; kind: 'boss' | 'mini'; region: RegionId; reward: string | null; panel: Rect;
}

export interface Elevator { from_region: RegionId; to_region: RegionId; top: Point; bottom: Point; }

export interface SuperMetroidMap {
  metadata: {
    game: string; source: string; coordinate_system: 'image_pixels'; origin: 'top_left';
    image_size: { width: number; height: number };
    map_area: { x: number; y: number; width: number; height: number };
    region_colors: Record<RegionId, string>;
    notes: string[];
  };
  regions: Record<RegionId, { bbox: Rect; rooms: string[] }>;
  rooms: Room[];
  doors: Door[];
  passages: Passage[];
  connections: Connection[];
  markers: Marker[];
  bosses: Boss[];
  elevators: Elevator[];
  unresolved_upgrades: { name: string; region: RegionId }[];
}
