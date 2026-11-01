// Terrain features that only the painted 2D art showed, as v7-style models: rock shapes become clusters of lumpy
// boulders, bush shapes rows of leafy bushes and ferns, the beach log a drift log, cliffs strata walls with a grass lip
// and pools water inside a ring of stones. The world's north edge (behind the camp) gets the v7 back cliff.
import {CatmullRomCurve3, CircleGeometry, Float32BufferAttribute, BufferGeometry, Group, Mesh, Shape, ShapeGeometry, TubeGeometry, Vector2, Vector3} from 'three';
import {obstacles} from '../terrain';
import {WIDTH, shore} from '../shared';
import {UNIT} from './space';
import {mulberry} from './look';
import {paint} from './paint3d';
import type {Placement} from './props-layout';

type Pt = {x: number; y: number};
export type StandInKind = 'rock' | 'bush' | 'log' | 'cliff' | 'pool';
// Collision shapes only the painted 2D art showed, with the height (scene units) their models rise to.
export const STAND_INS: Record<string, {kind: StandInKind; height: number}> = {
  'beach-ridge': {kind: 'rock', height: .9}, 'beach-rock': {kind: 'rock', height: .8}, 'east-rocks': {kind: 'rock', height: 1}, 'beach-small-rock': {kind: 'rock', height: .35}, 'beach-bottom-rock': {kind: 'rock', height: .45},
  'beach-foreground': {kind: 'bush', height: .45}, 'beach-log': {kind: 'log', height: .35},
  'jungle-cliff': {kind: 'cliff', height: 2.4}, 'jungle-main-rock': {kind: 'rock', height: 1.6}, 'jungle-south-rock': {kind: 'rock', height: 1.2}, 'jungle-bottom-rock': {kind: 'rock', height: 1.1}, 'jungle-right-rock': {kind: 'rock', height: 1.2}, 'jungle-left-rock': {kind: 'rock', height: .9},
  'jungle-pool': {kind: 'pool', height: 0}, 'jungle-foreground-left': {kind: 'bush', height: .6}, 'jungle-foreground-right': {kind: 'bush', height: .6},
};
// The back cliff along the world's north edge: wall top height (scene units) and its foot line in game px.
export const BORDER = {height: 1.7, edge: (x: number) => -26 - 7 * Math.sin(x / 170) - 4 * Math.sin(x / 61)};
const BORDER_FAR = -1250, BORDER_EAST = WIDTH + 1150, borderWest = () => shore(0) + 40;

export function insidePolygon(x: number, y: number, pts: readonly Pt[]) {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; }
  return c;
}
const area = (pts: readonly Pt[]) => Math.abs(pts.reduce((s, p, i) => { const q = pts[(i + 1) % pts.length]; return s + p.x * q.y - q.x * p.y; }, 0) / 2);
const centroid = (pts: readonly Pt[]) => ({x: pts.reduce((s, p) => s + p.x, 0) / pts.length, y: pts.reduce((s, p) => s + p.y, 0) / pts.length});
// Jittered hex-grid samples inside a polygon (game px); a shape too small for the grid gets its centre.
function fillPoints(pts: readonly Pt[], spacing: number, seed: number): Pt[] {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), r = mulberry(seed), out: Pt[] = [];
  let row = 0;
  for (let y = Math.min(...ys) + spacing * .45; y < Math.max(...ys); y += spacing * .87, row++)
    for (let x = Math.min(...xs) + spacing * (row % 2 ? .95 : .45); x < Math.max(...xs); x += spacing) {
      const p = {x: x + (r() - .5) * spacing * .45, y: y + (r() - .5) * spacing * .45};
      if (insidePolygon(p.x, p.y, pts)) out.push(p);
    }
  return out.length ? out : [centroid(pts)];
}
// Points every `step` px along a polygon outline (closed).
function along(pts: readonly Pt[], step: number): Pt[] {
  const out: Pt[] = [];
  pts.forEach((a, i) => { const b = pts[(i + 1) % pts.length], n = Math.max(1, Math.round(Math.hypot(b.x - a.x, b.y - a.y) / step)); for (let k = 0; k < n; k++) out.push({x: a.x + (b.x - a.x) * k / n, y: a.y + (b.y - a.y) * k / n}); });
  return out;
}

// v7 rock(): about .62 units tall at scale 1; footprint radius about .69. Boulders top out at MAX_BOULDER so a big shape
// reads as a pile of stones rather than one smooth mound; jungle piles are mossy.
const ROCK_TOP = .62, MAX_BOULDER = 2.1;
function rockCluster(id: string, pts: readonly Pt[], height: number, seed: number): Placement[] {
  const r = mulberry(seed), spacing = Math.min(80, Math.max(40, Math.sqrt(area(pts)) / 3)), s = height / ROCK_TOP, moss = id.startsWith('jungle-');
  return fillPoints(pts, spacing, seed).map((p, i) => { const k = Math.min(MAX_BOULDER, s * (.7 + r() * .45)); return {model: 'boulder', x: p.x, y: p.y, turn: r() * 6.3, scale: [k, k * (.8 + r() * .3), k], arg: `${(seed * 7 + i) % 6}${moss && i % 3 === 0 ? '|moss' : ''}`, from: id}; });
}
const BUSH_COLORS = ['#e8402f', 'none', '#ff7fae', 'none', '#ffd23f', 'none'];
// Low shapes (the beach foreground) are mostly ferns with a few small flowering bushes; jungle shapes are big-leaved
// tropical plants with ferns and the odd bush, like the 2D jungle foreground.
function bushField(id: string, pts: readonly Pt[], height: number, seed: number): Placement[] {
  const r = mulberry(seed), low = height < .5;
  return fillPoints(pts, low ? 48 : 56, seed).map((p, i): Placement => {
    // Jungle bushes stay in the back half of the shape; the front half, nearest the camera, keeps to low plants.
    const back = p.y < (Math.min(...pts.map(q => q.y)) + Math.max(...pts.map(q => q.y))) / 2;
    const base = {x: p.x, y: p.y, turn: r() * 6.3, from: id}, pick = low ? (i % 3 === 1 ? 'bush' : 'fern') : (['plant', 'fern', 'plant', back ? 'bush' : 'fern'] as const)[i % 4];
    if (pick === 'bush') return {...base, model: 'bush', scale: (low ? .62 : .75) * (.85 + r() * .3), arg: `${BUSH_COLORS[(seed + i) % BUSH_COLORS.length]}|${(seed + i) % 4}`};
    if (pick === 'plant') return {...base, model: 'plant', scale: 1.1 + r() * .4, arg: String((seed + i) % 4)};
    return {...base, model: 'fern', scale: (low ? .8 : 1) * (.9 + r() * .3), arg: String((seed + i) % 3)};
  });
}
function driftLog(id: string, pts: readonly Pt[]): Placement[] {
  const xs = pts.map(p => p.x), ys = pts.map(p => p.y), c = centroid(pts), w = Math.max(...xs) - Math.min(...xs), h = Math.max(...ys) - Math.min(...ys);
  return [{model: 'log', x: c.x, y: c.y, turn: w >= h ? 0 : Math.PI / 2, arg: String(Math.max(w, h) / UNIT * .95), from: id}];
}

// Rocks, bushes and logs for every stand-in shape, plus boulders at cliff feet and around pools.
export function standInPlacements(): Placement[] {
  const out: Placement[] = [];
  obstacles.forEach((o, i) => {
    const s = STAND_INS[o.id];
    if (!s) return;
    if (s.kind === 'rock') out.push(...rockCluster(o.id, o.points, s.height, 11 + i));
    if (s.kind === 'bush') out.push(...bushField(o.id, o.points, s.height, 31 + i));
    if (s.kind === 'log') out.push(...driftLog(o.id, o.points));
    if (s.kind === 'pool') along(o.points, 70).forEach((p, k) => out.push({model: 'rock', x: p.x, y: p.y, turn: k * 1.3, scale: .55 + (k % 3) * .12, arg: String(70 + k), from: o.id}));
  });
  // A rocky headland where the north cliff meets the sea.
  const west = borderWest();
  [[-30, -40, 2.4], [-95, -10, 1.9], [-40, 22, 1.4], [-150, 18, 1.2], [10, 18, 1.1]].forEach(([dx, dy, k], i) => out.push({model: 'rock', x: west + dx, y: dy, turn: i * 2.1, scale: [k, k * .9, k], arg: String(90 + i), from: 'north-border'}));
  return out;
}

const toScene = (p: Pt, y = 0) => new Vector3(p.x / UNIT, y, p.y / UNIT);
// Strata wall along a polyline (px), from below the ground to `height`, u running along the wall.
function wall(line: readonly Pt[], height: number): BufferGeometry {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  let u = 0;
  line.forEach((p, i) => {
    if (i) u += Math.hypot(p.x - line[i - 1].x, p.y - line[i - 1].y) / UNIT * .22;
    pos.push(p.x / UNIT, -.3, p.y / UNIT, p.x / UNIT, height, p.y / UNIT); uv.push(u, 0, u, 1);
    if (i) { const a = (i - 1) * 2; idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3); }
  });
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
// A raised block of land: grass top, strata walls, a rounded grass lip along the edge facing the camera.
function mesa(name: string, outline: readonly Pt[], height: number, lip: readonly Pt[]) {
  const g = new Group();
  g.name = name;
  const top = new ShapeGeometry(new Shape(outline.map(p => new Vector2(p.x / UNIT, -p.y / UNIT)))).rotateX(-Math.PI / 2).translate(0, height, 0);
  g.add(new Mesh(top, paint('#79c24f', {roughness: .95})));
  g.add(new Mesh(wall([...outline, outline[0]], height), paint('#ffffff', {map: 'strata', roughness: .95, double: true})));
  const curve = new CatmullRomCurve3(lip.map(p => toScene(p, height + .02)));
  g.add(new Mesh(new TubeGeometry(curve, lip.length * 3, .15, 8, false), paint('#6dbd4b', {roughness: .9})));
  return g;
}
function pool(name: string, outline: readonly Pt[]) {
  const g = new Group(), r = mulberry(5);
  g.name = name;
  g.add(new Mesh(new ShapeGeometry(new Shape(outline.map(p => new Vector2(p.x / UNIT, -p.y / UNIT)))).rotateX(-Math.PI / 2).translate(0, .06, 0), paint('#4cc3d9', {roughness: .15, opacity: .85})));
  for (const p of fillPoints(outline, 120, 9).slice(0, 7)) {
    const pad = new Mesh(new CircleGeometry(.28 + r() * .12, 14, .3, Math.PI * 1.8), paint('#5fae45', {roughness: .7}));
    pad.rotation.x = -Math.PI / 2; pad.position.copy(toScene(p, .08)); g.add(pad);
  }
  return g;
}
// Foot line of the north cliff and the trees standing on its plateau.
function borderLine(): Pt[] { const out: Pt[] = []; for (let x = borderWest(); x <= BORDER_EAST; x += 40) out.push({x, y: BORDER.edge(x)}); return out; }
export function borderTreeSpots() {
  const r = mulberry(77), out: {x: number; y: number; palm: boolean; scale: number; turn: number}[] = [];
  for (let x = borderWest() + 110, i = 0; x < WIDTH + 400; x += 130 + r() * 100, i++) out.push({x, y: -110 - r() * 90 - (i % 2) * 150, palm: i % 3 === 1, scale: .9 + r() * .2, turn: r() * 6.3});
  return out;
}

// Cliff and pool stand-ins and the north border, as painted groups for batching (named after their shape).
export function terrainGroups(): Group[] {
  const out: Group[] = [];
  for (const o of obstacles) {
    const s = STAND_INS[o.id];
    if (s?.kind === 'cliff') out.push(mesa(o.id, o.points, s.height, [...o.points, o.points[0]]));
    if (s?.kind === 'pool') out.push(pool(o.id, o.points));
  }
  const line = borderLine(), west = borderWest();
  out.push(mesa('north-border', [{x: west, y: BORDER_FAR}, ...line, {x: BORDER_EAST, y: BORDER_FAR}].reverse(), BORDER.height, [{x: west, y: BORDER.edge(west) - 260}, ...line]));
  return out;
}
