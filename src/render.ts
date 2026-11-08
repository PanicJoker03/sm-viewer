import type { SuperMetroidMap, DoorType, Marker, Door, Point } from './types';
import mapData from './super_metroid_map.json'; // needs "resolveJsonModule": true

const map = mapData as unknown as SuperMetroidMap;

// Measured from the image: map tiles are 18px, and tile walls are centred on
// x = 5 + 18k and y = 6 + 18k (so the grid does NOT start at the image corner).
const DEFAULT_GRID = 18;
const DEFAULT_OFFSET: Point = [5, 6];

const DOOR_COLORS: Record<DoorType, string> = {
  normal: '#2a4bff', missile: '#e03030', super: '#20c020',
  power_bomb: '#e0d020', boss: '#e020e0', other: '#aaaaaa',
};
const MARKER_COLORS: Record<string, string> = {
  save: '#d01010', map_station: '#108010', recharge: '#2860f8',
  tank: '#ffb020', upgrade: '#ff66ff', ship: '#ffee00',
};
const REGION_NAMES: Record<string, string> = {
  crateria: 'Crateria', brinstar: 'Brinstar', norfair: 'Norfair',
  wrecked_ship: 'Wrecked Ship', maridia: 'Maridia', tourian: 'Tourian',
};

const prettify = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

export interface RenderOptions {
  grid?: number;         // grid cell size in image pixels (default 18)
  gridOffset?: Point;    // image-pixel position of a tile corner (default [5, 6])
  showGrid?: boolean;    // draw faint grid lines (default true)
  hoverRadius?: number;  // px radius for picking items/doors under the mouse (default 10)
}

interface ViewState {
  scale: number;
  grid: number;
  offset: Point;
  showGrid: boolean;
  radius: number;
  mouse: Point | null;   // image-space coords
  base: HTMLCanvasElement;
}

const states = new WeakMap<HTMLCanvasElement, ViewState>();

/** Draw the map and attach hover handling (safe to call again to change scale/options). */
export function render(canvas: HTMLCanvasElement, scale = 0.6, opts: RenderOptions = {}): void {
  const prev = states.get(canvas);
  const { width, height } = map.metadata.map_area;

  const state: ViewState = {
    scale,
    grid: opts.grid ?? prev?.grid ?? DEFAULT_GRID,
    offset: opts.gridOffset ?? prev?.offset ?? DEFAULT_OFFSET,
    showGrid: opts.showGrid ?? prev?.showGrid ?? true,
    radius: opts.hoverRadius ?? prev?.radius ?? 10,
    mouse: prev?.mouse ?? null,
    base: document.createElement('canvas'),
  };
  states.set(canvas, state);

  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.style.cursor = 'crosshair';

  // cache the static map in an offscreen canvas so hover redraws are cheap
  state.base.width = canvas.width;
  state.base.height = canvas.height;
  const bctx = state.base.getContext('2d')!;
  bctx.scale(scale, scale);
  drawMap(bctx);
  if (state.showGrid) drawGrid(bctx, state.grid, state.offset);

  draw(canvas, state);
  if (!prev) attachHover(canvas);
}

function drawMap(ctx: CanvasRenderingContext2D): void {
  const { width, height } = map.metadata.map_area;
  ctx.fillStyle = '#ebebeb'; ctx.fillRect(0, 0, width, height);

  for (const room of map.rooms) {
    ctx.beginPath();
    room.polygon.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
    ctx.closePath();
    ctx.fillStyle = '#000032'; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = map.metadata.region_colors[room.region]; ctx.stroke();
  }
  for (const d of map.doors) {
    const [w, h] = d.orientation === 'vertical' ? [5, 10] : [10, 5];
    ctx.fillStyle = DOOR_COLORS[d.type];
    ctx.fillRect(d.center[0] - w / 2, d.center[1] - h / 2, w, h);
  }
  for (const m of map.markers) {
    ctx.fillStyle = MARKER_COLORS[m.category] ?? '#fff';
    ctx.beginPath(); ctx.arc(m.xy[0], m.xy[1], 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.strokeStyle = '#00e5ff'; ctx.lineWidth = 3;
  for (const e of map.elevators) { ctx.beginPath(); ctx.moveTo(...e.top); ctx.lineTo(...e.bottom); ctx.stroke(); }
}

function drawGrid(ctx: CanvasRenderingContext2D, grid: number, [ox, oy]: Point): void {
  const { width, height } = map.metadata.map_area;
  ctx.save();
  ctx.strokeStyle = 'rgba(120,140,255,0.22)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = ox % grid; x <= width; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
  for (let y = oy % grid; y <= height; y += grid) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
  ctx.stroke();
  ctx.restore();
}

/* ------------------------------ hover ------------------------------ */

function attachHover(canvas: HTMLCanvasElement): void {
  canvas.addEventListener('mousemove', (e) => {
    const st = states.get(canvas)!;
    const r = canvas.getBoundingClientRect();
    const k = canvas.width / r.width; // handles CSS-resized canvases
    const x = ((e.clientX - r.left) * k) / st.scale;
    const y = ((e.clientY - r.top) * k) / st.scale;
    const { width, height } = map.metadata.map_area;
    st.mouse = x >= 0 && y >= 0 && x < width && y < height ? [x, y] : null;
    draw(canvas, st);
  });
  canvas.addEventListener('mouseleave', () => {
    const st = states.get(canvas)!;
    st.mouse = null;
    draw(canvas, st);
  });
}

function draw(canvas: HTMLCanvasElement, st: ViewState): void {
  const ctx = canvas.getContext('2d')!;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(st.base, 0, 0);
  if (!st.mouse) return;

  const [mx, my] = st.mouse;
  const col = Math.floor((mx - st.offset[0]) / st.grid);
  const row = Math.floor((my - st.offset[1]) / st.grid);
  const cx = st.offset[0] + col * st.grid;   // cell top-left, image px
  const cy = st.offset[1] + row * st.grid;

  // highlighted grid cell + hovered item ring (image space)
  ctx.setTransform(st.scale, 0, 0, st.scale, 0, 0);
  ctx.fillStyle = 'rgba(255,220,0,0.35)';
  ctx.fillRect(cx, cy, st.grid, st.grid);
  ctx.strokeStyle = '#ffdc00';
  ctx.lineWidth = 2 / st.scale;
  ctx.strokeRect(cx, cy, st.grid, st.grid);

  const marker = markerNear(mx, my, st.radius);
  if (marker) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2 / st.scale;
    ctx.beginPath(); ctx.arc(marker.xy[0], marker.xy[1], 9, 0, Math.PI * 2); ctx.stroke();
  }

  // info panel (screen space)
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawInfoPanel(ctx, canvas, st, col, row, marker);
}

function drawInfoPanel(
  ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement, st: ViewState,
  col: number, row: number, marker: Marker | undefined,
): void {
  const [mx, my] = st.mouse!;
  const room = roomAt(mx, my);
  const door = doorNear(mx, my, st.radius);

  const lines: [string, string][] = [
    ['Pixel', `${Math.round(mx)}, ${Math.round(my)}`],
    ['Grid', `${col}, ${row}  (${st.grid}px)`],
    ['Area', room ? REGION_NAMES[room.region] ?? prettify(room.region) : '-'],
    ['Room', room ? room.id : '-'],
    ['Item', marker ? prettify(marker.type) : '-'],
  ];
  if (door) lines.push(['Door', prettify(door.type)]);

  const pad = 8, lineH = 16, labelW = 48;
  ctx.font = '12px ui-monospace, Menlo, Consolas, monospace';
  const valueW = Math.max(...lines.map(([, v]) => ctx.measureText(v).width));
  const w = Math.ceil(pad * 2 + labelW + valueW);
  const h = pad * 2 + lines.length * lineH - 4;

  // top-left corner, hop to top-right if the mouse is near it
  let px = 8;
  const py = 8;
  const sx = mx * st.scale, sy = my * st.scale;
  if (sx < px + w + 24 && sy < py + h + 24) px = canvas.width - w - 8;

  ctx.fillStyle = 'rgba(0,0,0,0.8)';
  ctx.fillRect(px, py, w, h);
  ctx.strokeStyle = '#ffdc00';
  ctx.lineWidth = 1;
  ctx.strokeRect(px + 0.5, py + 0.5, w - 1, h - 1);

  ctx.textBaseline = 'top';
  lines.forEach(([label, value], i) => {
    const y = py + pad + i * lineH;
    ctx.fillStyle = '#8fa8ff'; ctx.fillText(label, px + pad, y);
    ctx.fillStyle = '#ffffff'; ctx.fillText(value, px + pad + labelW, y);
  });
}

function nearest<T>(items: T[], pos: (t: T) => Point, x: number, y: number, r: number): T | undefined {
  let best: T | undefined, bd = r * r;
  for (const it of items) {
    const [ix, iy] = pos(it);
    const d = (ix - x) ** 2 + (iy - y) ** 2;
    if (d <= bd) { bd = d; best = it; }
  }
  return best;
}
const markerNear = (x: number, y: number, r: number): Marker | undefined => nearest(map.markers, m => m.xy, x, y, r);
const doorNear = (x: number, y: number, r: number): Door | undefined => nearest(map.doors, d => d.center, x, y, r);

/* ------------------------------ utilities ------------------------------ */

/** Room graph for pathfinding. */
export function buildGraph() {
  const adj = new Map<string, { to: string; door?: DoorType }[]>();
  for (const c of map.connections) {
    (adj.get(c.a) ?? adj.set(c.a, []).get(c.a)!).push({ to: c.b, door: c.doorType });
    (adj.get(c.b) ?? adj.set(c.b, []).get(c.b)!).push({ to: c.a, door: c.doorType });
  }
  return adj;
}

/** Hit-test: which room is under an image-space point? */
export function roomAt(x: number, y: number) {
  return map.rooms.find(r => {
    const [bx, by, bw, bh] = r.bbox;
    if (x < bx || y < by || x > bx + bw || y > by + bh) return false;
    let inside = false; const p = r.polygon;
    for (let i = 0, j = p.length - 1; i < p.length; j = i++) {
      const [xi, yi] = p[i], [xj, yj] = p[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  });
}
