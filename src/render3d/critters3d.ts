// Bugs as small animated models (one instanced mesh per species) and mangoes on fruit trees, replacing P1's orbs.
import {Color, ConeGeometry, CylinderGeometry, Euler, Float32BufferAttribute, Group, InstancedMesh, Matrix4, Quaternion, SphereGeometry, Vector3, type BufferGeometry} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Landmark, World} from '../shared';
import {fruitTrees, life} from '../island-life';
import {UNIT} from './space';
import {std} from './look';
import {treePlacements} from './flora3d';

const CAPACITY = 8;
// One colour per part, merged so a species is a single draw call.
function part(g: BufferGeometry, hex: string, x = 0, y = 0, z = 0, e = new Euler()) {
  g.applyMatrix4(new Matrix4().compose(new Vector3(x, y, z), new Quaternion().setFromEuler(e), new Vector3(1, 1, 1)));
  for (const name of Object.keys(g.attributes)) if (name !== 'position' && name !== 'normal') g.deleteAttribute(name);
  const c = new Color(hex), n = g.getAttribute('position').count, col = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  return g.index ? g.toNonIndexed() : g;
}
const wing = (r: number, sx: number, sz: number, x: number, z: number, hex: string) => part(new SphereGeometry(r, 10, 4).scale(sx, .08, sz), hex, x, 0, z);
// Wings spread along ±x; flapping scales x.
const MODELS: Record<string, () => BufferGeometry> = {
  butterfly: () => mergeGeometries([part(new CylinderGeometry(.018, .018, .2, 6), '#2b2118', 0, 0, 0, new Euler(Math.PI / 2, 0, 0)), wing(.11, 1, .8, .1, -.03, '#ffb23f'), wing(.11, 1, .8, -.1, -.03, '#ffb23f'), wing(.08, 1, .9, .07, .07, '#2b2118'), wing(.08, 1, .9, -.07, .07, '#2b2118')])!,
  dragonfly: () => mergeGeometries([part(new CylinderGeometry(.014, .01, .42, 6), '#3a7fc4', 0, 0, .05, new Euler(Math.PI / 2, 0, 0)), part(new SphereGeometry(.035, 8, 6), '#2f6aa8', 0, 0, -.16), wing(.12, 1, .22, .12, -.08, '#dff4ff'), wing(.12, 1, .22, -.12, -.08, '#dff4ff'), wing(.1, 1, .22, .1, -.01, '#dff4ff'), wing(.1, 1, .22, -.1, -.01, '#dff4ff')])!,
  cicada: () => mergeGeometries([part(new SphereGeometry(.06, 8, 6).scale(1, .8, 1.6), '#6b5a2e'), wing(.07, .7, 1.6, .045, .05, '#cfe3d0'), wing(.07, .7, 1.6, -.045, .05, '#cfe3d0')])!,
  beetle: () => mergeGeometries([part(new SphereGeometry(.07, 10, 8).scale(1, .7, 1.3), '#2a1d14'), part(new ConeGeometry(.02, .12, 6), '#3a2a1c', 0, .03, -.12, new Euler(-1.2, 0, 0))])!,
  firefly: () => mergeGeometries([part(new SphereGeometry(.03, 8, 6), '#4a4030'), part(new SphereGeometry(.04, 8, 6), '#e8ff7a', 0, -.01, .04)])!,
  hermitCrab: () => mergeGeometries([part(new ConeGeometry(.1, .2, 10), '#f2a07a', 0, .1, 0, new Euler(0, 0, -1.2)), part(new SphereGeometry(.06, 8, 6), '#e0503a', .1, .05, 0), ...[-1, 1].map(s => part(new CylinderGeometry(.012, .012, .12, 4), '#e0503a', .1, .03, s * .07, new Euler(s * 1.1, 0, 0)))])!,
};
// Height above the ground: flyers hover, tree bugs cling to the trunk, crabs walk.
const LIFT: Record<string, number> = {butterfly: .95, dragonfly: .85, cicada: 1.15, beetle: .9, firefly: .7, hermitCrab: 0};

// Front canopy lobes of the broadleaf tree (flora3d broadleafParts): centre and radius, tree-local units.
const LOBES = [[0, 3.1, 0, .84], [.98, 2.58, .22, .8], [-.98, 2.62, .18, .82], [.38, 2.38, .98, .78], [-.48, 2.32, .92, .76], [0, 1.98, .25, .72]];
const FRUIT_PER_COUNT = 3;

export class Critters3D {
  readonly group = new Group();
  private bugs: Record<string, InstancedMesh> = {};
  private fruit: InstancedMesh;
  private trees = treePlacements();

  constructor() {
    const body = std('#ffffff', {vertexColors: true, roughness: .55});
    for (const [species, make] of Object.entries(MODELS)) {
      const mesh = new InstancedMesh(make(), species === 'firefly' ? std('#ffffff', {vertexColors: true, emissive: '#d8ff6a', emissiveIntensity: .9}) : body, CAPACITY);
      mesh.count = 0; mesh.frustumCulled = false; mesh.castShadow = species !== 'firefly';
      this.bugs[species] = mesh; this.group.add(mesh);
    }
    this.fruit = new InstancedMesh(new SphereGeometry(.15, 12, 10), std('#f5a12c', {roughness: .32}), fruitTrees.length * 3 * FRUIT_PER_COUNT);
    this.fruit.count = 0; this.fruit.frustumCulled = false; this.fruit.castShadow = true;
    this.group.add(this.fruit);
  }

  update(w: World, targets: readonly Landmark[], now: number) {
    const L = life(w), counts: Record<string, number> = {}, m = new Matrix4(), q = new Quaternion(), e = new Euler(), v = new Vector3(), s = new Vector3();
    for (const t of targets) {
      if (t.kind !== 'bug') continue;
      const species = L.bugs.find(b => b.id === t.id)?.species ?? 'butterfly', mesh = this.bugs[species];
      if (!mesh || (counts[species] ?? 0) >= CAPACITY) continue;
      const i = counts[species] = (counts[species] ?? 0) + 1, ph = t.x * .013 + t.y * .007, flyer = LIFT[species] > .5 && species !== 'cicada' && species !== 'beetle';
      const dx = flyer ? Math.sin(now * .7 + ph) * .45 : species === 'hermitCrab' ? Math.sin(now * .4 + ph) * .3 : 0, dz = flyer ? Math.sin(now * 1.1 + ph) * .3 : 0;
      v.set(t.x / UNIT + dx, LIFT[species] + (flyer ? Math.sin(now * 2.2 + ph) * .12 : 0), t.y / UNIT + dz);
      e.set(0, flyer ? Math.atan2(Math.cos(now * .7 + ph) * .45 * .7, Math.cos(now * 1.1 + ph) * .3 * 1.1) : ph, 0);
      const flap = species === 'butterfly' ? .25 + .75 * Math.abs(Math.sin(now * 11 + ph)) : species === 'dragonfly' ? .85 + .15 * Math.sin(now * 40 + ph) : 1;
      m.compose(v, q.setFromEuler(e), s.set(flap * 1.3, 1.3, 1.3));
      mesh.setMatrixAt(i - 1, m);
    }
    for (const [species, mesh] of Object.entries(this.bugs)) { mesh.count = counts[species] ?? 0; mesh.instanceMatrix.needsUpdate = true; }
    // Mangoes on the camera side of each broadleaf fruit tree, three per fruit left to shake (palms carry their coconuts).
    let n = 0;
    fruitTrees.forEach(f => {
      const tree = this.trees[f.treeIndex], count = L.fruit[f.id]?.count ?? 0;
      if (f.palm || !tree || !count) return;
      for (let k = 0; k < count * FRUIT_PER_COUNT; k++) {
        const [cx, cy, cz, r] = LOBES[k % LOBES.length], a = (k * 2.4 + f.treeIndex) % (Math.PI * 2), c = Math.cos(tree.turn), sn = Math.sin(tree.turn);
        const d = v.set(Math.cos(a) * .7, ((k * .37) % 1 - .3) * .8, .9).normalize();
        const lx = cx * c + cz * sn, lz = -cx * sn + cz * c;
        m.compose(s.set(tree.x / UNIT + (lx + d.x * r * .97) * tree.scale, (cy + d.y * r * .97) * tree.scale, tree.y / UNIT + (lz + d.z * r * .97) * tree.scale), q.identity(), new Vector3(1, 1, 1));
        this.fruit.setMatrixAt(n++, m);
      }
    });
    this.fruit.count = n; this.fruit.instanceMatrix.needsUpdate = true;
  }
}
