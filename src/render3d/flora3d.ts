import {BufferGeometry, CircleGeometry, Color, ConeGeometry, CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Float32BufferAttribute, Group, IcosahedronGeometry, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, Quaternion, Shape, ShapeGeometry, SphereGeometry, Vector2, Vector3, type Material} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {frontierTrees} from '../world-layout';
import {obstacles} from '../terrain';
import {landmarks, type World} from '../shared';
import {UNIT, inView, type ViewWindow} from './space';
import {curvify, leafTexture, lumpy, mulberry, seeing, std, toon} from './look';
import {BORDER, STAND_INS, borderTreeSpots} from './terrain3d';

export {STAND_INS, lumpy};

// base: ground height under the tree in scene units (border trees stand on the cliff plateau).
export type TreePlacement = {id: string; x: number; y: number; palm: boolean; scale: number; turn: number; choppable: boolean; base?: number};
// Every tree on the island: the 138 wild frontier trees (every 4th a palm, as in 2D), the jungle palm behind the
// palm-trunk collision shape, and the 10 choppable landmark trees (tree-beach is a palm).
export function treePlacements(): TreePlacement[] {
  const out: TreePlacement[] = frontierTrees.map((t, i) => { const r = mulberry(i + 7); return {id: t.id, x: t.x, y: t.y, palm: i % 4 === 0, scale: .85 + r() * .2, turn: r() * Math.PI * 2, choppable: false}; });
  const trunk = obstacles.find(o => o.id === 'palm-trunk');
  if (trunk) out.push({id: 'palm-trunk', x: (trunk.bounds.left + trunk.bounds.right) / 2, y: trunk.bounds.bottom, palm: true, scale: 1.1, turn: .6, choppable: false});
  for (const l of landmarks.filter(l => l.kind === 'tree')) out.push({id: l.id, x: l.x, y: l.y, palm: l.id === 'tree-beach', scale: l.id === 'tree-beach' ? .9 : 1.05, turn: (l.x % 628) / 100, choppable: true});
  // Two palms behind the first beach (v7 has palms by the water), rooted in the ridge rocks so nobody walks through
  // them and north of the beach so they never stand between the camera and the camp.
  [[1000, 360, .95, 2.4], [850, 335, .9, 2.8]].forEach(([x, y, scale, turn], i) => out.push({id: `beach-palm-${i}`, x, y, palm: true, scale, turn, choppable: false}));
  borderTreeSpots().forEach((t, i) => out.push({id: `border-tree-${i}`, x: t.x, y: t.y, palm: t.palm, scale: t.scale, turn: t.turn, choppable: false, base: BORDER.height}));
  return out;
}
export const rockPlacements = () => landmarks.filter(l => l.kind === 'stone').map((l, i) => ({id: l.id, x: l.x, y: l.y, turn: i * 1.7, scale: l.id === 'stone' ? 1 : 1.15}));

// A collision shape is drawn by a tree, by a target's prop (landmark, museum, shop …) or by a stand-in block.
export const obstacleCovered = (id: string, targetIds: ReadonlySet<string>) => id.startsWith('wild-tree-') || id === 'palm-trunk' || targetIds.has(id) || id in STAND_INS;

// Gives every vertex one colour so several parts can share one vertex-coloured material.
function painted(geometry: BufferGeometry, hex: string) {
  const c = new Color(hex), n = geometry.attributes.position.count, colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) colors.set([c.r, c.g, c.b], i * 3);
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3));
  return geometry;
}
// mergeGeometries needs identical attribute sets; parts stay indexed (every tree part is) so shared vertices are not tripled.
function only(geometry: BufferGeometry, names: readonly string[]) {
  const g = geometry;
  for (const name of Object.keys(g.attributes)) if (!names.includes(name)) g.deleteAttribute(name);
  return g;
}
const SOLID = ['position', 'normal', 'color'], TEXTURED = ['position', 'normal', 'uv', 'color'];
const placed = (g: BufferGeometry, x: number, y: number, z: number, e = new Euler()) => g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(e), new Vector3(1, 1, 1)));

// One serrated palm frond with dark spine and light edges (v7).
export function frond(length: number, width: number, droop: number) {
  const N = 16, pos: number[] = [], col: number[] = [], idx: number[] = [], dark = new Color('#56b52c'), light = new Color('#8ee34a');
  for (let i = 0; i <= N; i++) {
    const t = i / N, x = t * length, y = .16 * t * length - droop * t * t, w = width * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.04)), .65) * (1 - .25 * t), serr = i % 2 ? 1 : .62, crease = .14 * w;
    pos.push(x, y, 0, x - .06, y + crease, w * serr * .5, x - .06, y + crease, -w * serr * .5);
    col.push(...dark.toArray(), ...light.toArray(), ...light.toArray());
  }
  for (let i = 0; i < N; i++) { const a = i * 3, b = (i + 1) * 3; idx.push(a, a + 1, b + 1, a, b + 1, b, a, b, b + 2, a, b + 2, a + 2); }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new Float32BufferAttribute(pos, 3));
  geometry.setAttribute('color', new Float32BufferAttribute(col, 3));
  geometry.setIndex(idx);
  geometry.computeVertexNormals();
  return geometry;
}
// A leaning palm (base at the origin) split by material: trunk with coconuts, and double-sided fronds.
export function palmParts(seed = 1) {
  const trunk: BufferGeometry[] = [], fronds: BufferGeometry[] = [], lean = [.5, .15], r = mulberry(seed);
  let px = 0, py = 0, pz = 0;
  for (let i = 0; i < 9; i++) {
    const t = i / 9, h = .42, nx = lean[0] * t * t * 1.6, nz = lean[1] * t * t * 1.6;
    trunk.push(painted(only(placed(new CylinderGeometry(.25 - t * .09, .28 - t * .09, h, 10), nx, py + h / 2, nz, new Euler(lean[1] * t * .4, 0, -lean[0] * t * .4)), SOLID), i % 2 ? '#c79a62' : '#ae8250'));
    px = nx; pz = nz; py += h * .97;
  }
  for (let k = 0; k < 9; k++) {
    const shape = frond(2.5, .66, 1.15 + r() * .3);
    fronds.push(only(placed(shape, px, py, pz, new Euler(0, k / 9 * Math.PI * 2 + r() * .3, .1 + r() * .15, 'YZX')), SOLID));
  }
  for (const [cx, cz] of [[.14, .12], [-.14, .1], [0, -.15]]) trunk.push(painted(only(new SphereGeometry(.15, 10, 8).translate(px + cx, py - .12, pz + cz), SOLID), '#7f9a35'));
  return {trunk: mergeGeometries(trunk)!, fronds: mergeGeometries(fronds)!};
}
// A broadleaf tree split by material: bark trunk with roots, and a toon canopy (darker core, eight lobes).
export function broadleafParts(seed = 1) {
  const trunk: BufferGeometry[] = [], canopy: BufferGeometry[] = [], r = mulberry(seed * 13 + 5);
  trunk.push(painted(only(new CylinderGeometry(.2, .35, 1.6, 10).translate(0, .8, 0), SOLID), '#9a6a42'));
  for (const a of [0, 2.1, 4.2]) trunk.push(painted(only(placed(new ConeGeometry(.12, .55, 6), Math.cos(a) * .27, .14, Math.sin(a) * .27, new Euler(Math.sin(a) * .95, 0, -Math.cos(a) * .95)), SOLID), '#8a5c38'));
  canopy.push(painted(only(lumpy(1.05, 2, .1, seed).translate(0, 2.45, 0), TEXTURED), '#a9c79a'));
  const lobes = [[0, 3.1, 0, .84], [.98, 2.58, .22, .8], [-.98, 2.62, .18, .82], [.38, 2.38, .98, .78], [-.48, 2.32, .92, .76], [.62, 2.8, -.72, .76], [-.58, 2.84, -.66, .74], [0, 1.98, .25, .72]];
  lobes.forEach(([x, y, z, radius], i) => canopy.push(painted(only(lumpy(radius * (1 + (r() - .5) * .12), 2, .12, seed * 31 + i).translate(x, y, z), TEXTURED), '#ffffff')));
  return {trunk: mergeGeometries(trunk)!, canopy: mergeGeometries(canopy)!};
}
export function rockGeometry(seed = 1) { const g = lumpy(.55, 2, .35, seed); g.scale(1.25, .72, 1); g.translate(0, .22, 0); return g; }
const stumpGeometry = () => new CylinderGeometry(.32, .4, .38, 10).translate(0, .19, 0);

function instanced(geometry: BufferGeometry, material: Material, count: number, shadows = true) {
  const mesh = new InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = count; mesh.frustumCulled = false; mesh.castShadow = shadows; mesh.receiveShadow = shadows;
  return mesh;
}
// A tree's crown stays above the bent horizon up to about 43 units ahead on a wide screen (review measurement), so
// trees are kept to TREE_AHEAD; the set is rebuilt every TREE_STEP units the focus moves.
const TREE_AHEAD = 44, TREE_STEP = 4;
// Shadow discs under trees and rocks (v7 blob()); radius per kind in scene units.
const BLOB = {broadleaf: 1.55, palm: 1.1, rock: .7, stump: .55};

// Trees, rocks and stand-in blocks; instance matrices are rewritten only when a tree is cut or regrows, or a rock is used up or refills.
export class Flora3D {
  readonly group = new Group();
  private trees = treePlacements();
  private rocks = rockPlacements();
  private state = '';
  private palmTrunks: InstancedMesh; private palmFronds: InstancedMesh; private leafTrunks: InstancedMesh; private canopies: InstancedMesh;
  private stumps: InstancedMesh; private rockMesh: InstancedMesh; private blobs: InstancedMesh;

  constructor() {
    const palm = palmParts(3), leaf = broadleafParts(1), palms = this.trees.filter(t => t.palm).length, leaves = this.trees.length - palms;
    this.palmTrunks = instanced(palm.trunk, seeing(std('#ffffff', {vertexColors: true, roughness: .9})), palms);
    this.palmFronds = instanced(palm.fronds, seeing(std('#ffffff', {vertexColors: true, side: DoubleSide, roughness: .7})), palms);
    this.leafTrunks = instanced(leaf.trunk, seeing(std('#ffffff', {vertexColors: true, roughness: .9})), leaves);
    this.canopies = instanced(leaf.canopy, seeing(toon('#ffffff', {map: leafTexture(), vertexColors: true})), leaves);
    this.stumps = instanced(stumpGeometry(), std('#9a6a42', {roughness: .9}), this.trees.filter(t => t.choppable).length);
    this.rockMesh = instanced(rockGeometry(4), std('#b9b3a8', {roughness: .95}), this.rocks.length);
    this.blobs = instanced(new CircleGeometry(1, 20).rotateX(-Math.PI / 2).translate(0, .02, 0), curvify(new MeshBasicMaterial({color: '#2b3a1c', transparent: true, opacity: .22, depthWrite: false})), this.trees.length + this.rocks.length, false);
    this.blobs.renderOrder = 1;
    this.group.add(this.palmTrunks, this.palmFronds, this.leafTrunks, this.canopies, this.stumps, this.rockMesh, this.blobs);
  }

  // Only trees in the view window are drawn; the list is refreshed every TREE_STEP units moved (or when the view changes),
  // with that step added to the window so nothing pops in between refreshes.
  update(w: World, fx: number, fz: number, win: ViewWindow, ahead = TREE_AHEAD) {
    const state = this.trees.filter(t => t.choppable).map(t => w.resources[t.id] ? 1 : 0).join('') + '|' + this.rocks.map(r => w.resources[r.id] > 0 ? 1 : 0).join('') + '|' + Math.round(fx / TREE_STEP) + ',' + Math.round(fz / TREE_STEP) + '|' + [win.behind, win.back, win.spread, ahead].map(v => v.toFixed(1)).join(',');
    if (state === this.state) return;
    this.state = state;
    const m = new Matrix4(), q = new Quaternion(), up = new Vector3(0, 1, 0), counts = {palm: 0, leaf: 0, stump: 0, blob: 0};
    const put = (mesh: InstancedMesh, i: number, x: number, y: number, turn: number, s: number, base = 0) => { q.setFromAxisAngle(up, turn); m.compose(new Vector3(x / UNIT, base, y / UNIT), q, new Vector3(s, s, s)); mesh.setMatrixAt(i, m); };
    for (const t of this.trees) {
      if (!inView(fx, fz, win, ahead, TREE_STEP + 2, t.x / UNIT, t.x / UNIT, t.y / UNIT, t.y / UNIT)) continue;
      if (t.choppable && !w.resources[t.id]) { put(this.stumps, counts.stump++, t.x, t.y, t.turn, 1); put(this.blobs, counts.blob++, t.x, t.y, 0, BLOB.stump); continue; }
      if (t.palm) {
        put(this.palmTrunks, counts.palm, t.x, t.y, t.turn, t.scale, t.base); put(this.palmFronds, counts.palm++, t.x, t.y, t.turn, t.scale, t.base);
        // The palm leans .8 along x and .24 along z before the turn; its shade sits under the crown.
        const lx = (.8 * Math.cos(t.turn) + .24 * Math.sin(t.turn)) * t.scale * UNIT, lz = (-.8 * Math.sin(t.turn) + .24 * Math.cos(t.turn)) * t.scale * UNIT;
        put(this.blobs, counts.blob++, t.x + lx, t.y + lz, 0, BLOB.palm * t.scale, t.base);
      } else {
        put(this.leafTrunks, counts.leaf, t.x, t.y, t.turn, t.scale, t.base); put(this.canopies, counts.leaf++, t.x, t.y, t.turn, t.scale, t.base);
        put(this.blobs, counts.blob++, t.x, t.y, 0, BLOB.broadleaf * t.scale, t.base);
      }
    }
    this.rocks.forEach((r, i) => {
      const spent = !(w.resources[r.id] > 0);
      put(this.rockMesh, i, r.x, r.y, r.turn, r.scale * (spent ? .55 : 1));
      put(this.blobs, counts.blob++, r.x, r.y, 0, BLOB.rock * r.scale * (spent ? .6 : 1));
    });
    this.palmTrunks.count = this.palmFronds.count = counts.palm;
    this.leafTrunks.count = this.canopies.count = counts.leaf;
    this.stumps.count = counts.stump;
    this.blobs.count = counts.blob;
    for (const mesh of [this.palmTrunks, this.palmFronds, this.leafTrunks, this.canopies, this.stumps, this.rockMesh, this.blobs]) mesh.instanceMatrix.needsUpdate = true;
  }
}
