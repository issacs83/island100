// Ground dressing from the v7 lawn: grass tufts, clover and daisies on grass, pebbles on sand. Placed per ground cell
// from a hash of the cell, so a spot always keeps the same tuft; only a window around the view is instanced.
import {Color, ConeGeometry, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {obstacles} from '../terrain';
import {landmarks} from '../shared';
import {MUSEUM, gardenPlots, shellSpots} from '../island-life';
import {UNIT, type ViewWindow} from './space';
import {lumpy, mulberry, noise2, std} from './look';
import {groundKind} from './ground3d';
import {insidePolygon} from './terrain3d';

export type Dressing = {kind: 'tuft' | 'clover' | 'daisy' | 'pebble'; x: number; z: number; turn: number; scale: number};
// Cell size (scene units); how far ahead the lawn is dressed; how far the focus moves before re-placing; landmark clearance (px).
const CELL = .7, AHEAD = 24, RECENTER = 3, KEEP_CLEAR = 34;
// Window used without a camera (tests): a 1280×720 view.
const DEFAULT_VIEW: ViewWindow = {behind: 6, back: 12.6, spread: .95};
const KINDS = ['tuft', 'clover', 'daisy', 'pebble'] as const;

// Cells blocked by a collision shape or a landmark, computed once.
let blocked: Set<string> | undefined;
function isBlocked(cx: number, cz: number) {
  if (!blocked) {
    blocked = new Set();
    for (const o of obstacles) for (let x = Math.floor(o.bounds.left / UNIT / CELL); x <= o.bounds.right / UNIT / CELL; x++) for (let z = Math.floor(o.bounds.top / UNIT / CELL); z <= o.bounds.bottom / UNIT / CELL; z++) {
      // Blocked when any corner or the centre of the cell is inside the shape.
      const pts = [[.5, .5], [0, 0], [1, 0], [0, 1], [1, 1]].map(([a, b]) => ({x: (x + a) * CELL * UNIT, y: (z + b) * CELL * UNIT}));
      if (pts.some(p => insidePolygon(p.x, p.y, o.points))) blocked.add(`${x},${z}`);
    }
    const r = KEEP_CLEAR / UNIT / CELL + 1;
    for (const l of [...landmarks, ...gardenPlots, ...shellSpots, MUSEUM]) for (let x = Math.floor(l.x / UNIT / CELL - r); x <= l.x / UNIT / CELL + r; x++) for (let z = Math.floor(l.y / UNIT / CELL - r); z <= l.y / UNIT / CELL + r; z++) blocked.add(`${x},${z}`);
  }
  return blocked.has(`${cx},${cz}`);
}

function cellItem(cx: number, cz: number): Dressing | undefined {
  if (isBlocked(cx, cz)) return;
  const r = mulberry((cx * 73856093) ^ (cz * 19349663)), x = (cx + .15 + r() * .7) * CELL, z = (cz + .15 + r() * .7) * CELL, roll = r(), turn = r() * 6.3, scale = .8 + r() * .6;
  const ground = groundKind(x * UNIT, z * UNIT);
  if (ground === 'grass') {
    if (roll < .05) return {kind: 'daisy', x, z, turn, scale};
    if (roll < .25 && noise2(x * .5, z * .5) > .55) return {kind: 'clover', x, z, turn, scale};
    if (roll < .72) return {kind: 'tuft', x, z, turn, scale};
  }
  if ((ground === 'sand' || ground === 'wetSand') && roll < .07) return {kind: 'pebble', x, z, turn, scale: .6 + r() * .8};
}
// Everything dressed in the view window around (fx, fz), out to the bottom screen edge plus the re-placing step.
export function dressingAround(fx: number, fz: number, win: ViewWindow = DEFAULT_VIEW): Dressing[] {
  const out: Dressing[] = [], behind = win.behind + RECENTER + CELL, side = (win.back + AHEAD) * win.spread + RECENTER;
  for (let cz = Math.floor((fz - AHEAD) / CELL); cz <= (fz + behind) / CELL; cz++) for (let cx = Math.floor((fx - side) / CELL); cx <= (fx + side) / CELL; cx++) { const d = cellItem(cx, cz); if (d) out.push(d); }
  return out;
}

const tinted = (g: BufferGeometry, hex: string) => { const c = new Color(hex), n = g.getAttribute('position').count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new Float32BufferAttribute(a, 3)); return g; };
const SHAPES: Record<Dressing['kind'], () => BufferGeometry> = {
  tuft: () => mergeGeometries([0, 1, 2].map(i => tinted(new ConeGeometry(.035, .22, 4).translate(0, .11, 0).rotateZ((i - 1) * .35).rotateY(i * 2.1), '#4a9a36')))!,
  clover: () => mergeGeometries([0, 2.1, 4.2].map(a => tinted(new SphereGeometry(.05, 5, 3).scale(1, .25, 1).translate(Math.cos(a) * .045, .02, Math.sin(a) * .045), '#5aa83f')))!,
  daisy: () => mergeGeometries([...Array.from({length: 6}, (_, k) => { const a = k / 6 * Math.PI * 2; return tinted(new SphereGeometry(.03, 4, 2).scale(1.4, .3, .7).rotateY(-a).translate(Math.cos(a) * .035, .09, Math.sin(a) * .035), '#ffffff'); }), tinted(new SphereGeometry(.02, 4, 3).translate(0, .1, 0), '#ffd23a'), tinted(new ConeGeometry(.008, .09, 4).translate(0, .045, 0), '#4a9a36')])!,
  pebble: () => { const g = lumpy(.07, 1, .4, 3); g.deleteAttribute('uv'); return tinted(g.scale(1.2, .55, 1), '#b8ad98'); },
};
const CAPACITY: Record<Dressing['kind'], number> = {tuft: 3200, clover: 900, daisy: 500, pebble: 600};

export class Dressing3D {
  readonly group = new Group();
  private meshes = {} as Record<Dressing['kind'], InstancedMesh>;
  private centre = {x: Infinity, z: Infinity};
  private view = '';

  constructor() {
    const material = std('#ffffff', {vertexColors: true, roughness: .9});
    for (const kind of KINDS) {
      const geometry = SHAPES[kind]();
      if (!geometry.getAttribute('normal')) geometry.computeVertexNormals();
      const mesh = new InstancedMesh(geometry, material, CAPACITY[kind]);
      mesh.count = 0; mesh.frustumCulled = false; mesh.receiveShadow = true;
      this.meshes[kind] = mesh; this.group.add(mesh);
    }
  }

  // Re-places the instances when the focus has moved RECENTER units from the last window centre or the view changed.
  update(fx: number, fz: number, win: ViewWindow) {
    const view = [win.behind, win.back, win.spread].map(v => v.toFixed(1)).join(',');
    if (Math.hypot(fx - this.centre.x, fz - this.centre.z) < RECENTER && view === this.view) return;
    this.centre = {x: fx, z: fz}; this.view = view;
    const counts = {tuft: 0, clover: 0, daisy: 0, pebble: 0}, m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), p = new Vector3(), s = new Vector3();
    for (const d of dressingAround(fx, fz, win)) {
      if (counts[d.kind] >= CAPACITY[d.kind]) continue;
      m.compose(p.set(d.x, 0, d.z), q.setFromAxisAngle(up, d.turn), s.setScalar(d.scale));
      this.meshes[d.kind].setMatrixAt(counts[d.kind]++, m);
    }
    for (const kind of KINDS) { this.meshes[kind].count = counts[kind]; this.meshes[kind].instanceMatrix.needsUpdate = true; }
  }
}
