// Props in the 3D scene, batched per 16-unit chunk in two layers: 'decor' (decorations, terrain models, buildings and
// fixed spots) is re-merged only when a building changes, 'targets' (things picked up, regrown, dug or planted) when
// one of them changes. Fires get flickering flame cards and a glow; one permanent point light follows the campfire, so
// the scene's light count never changes and no shader is rebuilt when the tent becomes a house. Windows glow at night.
import {AdditiveBlending, Box3, BufferGeometry, Color, DoubleSide, Float32BufferAttribute, Group, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, PointLight, Points, PointsMaterial, Quaternion, Sprite, SpriteMaterial, Vector3, type Material, type MeshStandardMaterial} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import type {Landmark, World} from '../shared';
import {UNIT, bendY, inView, type ViewWindow} from './space';
import {curvify, mulberry} from './look';
import {classMaterial} from './paint3d';
import {bake, mergeBaked, type Baked} from './batch3d';
import {groundHeight} from './ground3d';
import {flameTexture, glowTexture} from './props3d';
import {MODELS, VOLATILE_KINDS, decorPlacements, drawnBy, targetPlacements, type Placement} from './props-layout';
import {standInPlacements, terrainGroups} from './terrain3d';

// Chunk size (scene units); how far ahead of the focus a chunk is still drawn (props are low, so less than trees);
// seconds between checks of the target props for changes.
const PROP_CHUNK = 16, PROP_AHEAD = 36, SYNC_EVERY = .25;
// Models whose base sits at the water surface rather than on the sea floor.
const AFLOAT = new Set(['pier', 'bubbles']);
const chunkOf = (x: number, z: number) => `${Math.floor(x / PROP_CHUNK)},${Math.floor(z / PROP_CHUNK)}`;

// A placement's transform: on the ground (or afloat), turned, scaled; spent resources shrink.
export function placementMatrix(p: Placement) {
  const s = p.scale ?? 1, k = p.spent ? .7 : 1, scale = typeof s === 'number' ? new Vector3(s * k, s * k, s * k) : new Vector3(s[0] * k, s[1] * k, s[2] * k);
  return new Matrix4().compose(new Vector3(p.x / UNIT, AFLOAT.has(p.model) ? 0 : groundHeight(p.x, p.y), p.y / UNIT), new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), p.turn ?? 0), scale);
}
// Bakes a placement from a per-model cache: a model is built and baked once, then only transformed.
export function bakePlacement(p: Placement, models: Map<string, Baked[]>): Baked[] {
  const key = `${p.model}|${p.arg ?? ''}|${p.spent ? 1 : 0}`;
  let local = models.get(key);
  if (!local) { local = bake(MODELS[p.model](p.arg), p.spent ? .55 : 1); models.set(key, local); }
  const m = placementMatrix(p);
  return local.map(b => ({...b, geometry: b.geometry.clone().applyMatrix4(m)}));
}

type Layer = 'decor' | 'targets';
type Chunk = {fixed: Baked[]; sig: Record<Layer, string>; meshes: Record<Layer, Mesh[]>; box: Box3};
type Fire = {group: Group; flames: Mesh; glow: Sprite; embers?: Points; base: number; x: number; z: number; size: number; phase: number; camp: boolean};

export class Props3D {
  readonly group = new Group();
  private materials = new Map<string, Material>();
  private models = new Map<string, Baked[]>();
  private chunks = new Map<string, Chunk>();
  private fires: Fire[] = [];
  private fireKey = '';
  private light = new PointLight('#ffa25a', 0, 7, 1.3);
  private glowing: MeshStandardMaterial[] = [];
  private synced = -1;

  constructor() {
    const fixed = new Map<string, Baked[]>(), into = (key: string, parts: Baked[]) => { const list = fixed.get(key); if (list) list.push(...parts); else fixed.set(key, [...parts]); };
    for (const p of [...decorPlacements(), ...standInPlacements()]) into(chunkOf(p.x / UNIT, p.y / UNIT), bakePlacement(p, this.models));
    // Cliffs and pools are already in world space and join the chunk of their centre; the long north border is always drawn.
    for (const g of terrainGroups()) {
      if (g.name === 'north-border') { this.meshes(mergeBaked(bake(g)), 'border', 'decor'); continue; }
      const c = new Box3().setFromObject(g).getCenter(g.position.clone());
      into(chunkOf(c.x, c.z), bake(g));
    }
    // Batches are built on the first update with the target props ('\0' never matches a real signature).
    for (const [key, list] of fixed) this.chunk(key).fixed = mergeBaked(list);
    this.group.add(this.light);
    this.syncFires(decorPlacements().filter(p => p.model === 'torch'), []);
  }

  private chunk(key: string) {
    let c = this.chunks.get(key);
    if (!c) { c = {fixed: [], sig: {decor: '\0', targets: '\0'}, meshes: {decor: [], targets: []}, box: new Box3()}; this.chunks.set(key, c); }
    return c;
  }

  private material(b: Baked) {
    let m = this.materials.get(b.key);
    if (!m) { m = classMaterial(b.look); this.materials.set(b.key, m); if (m.userData.glow) this.glowing.push(m as MeshStandardMaterial); }
    return m;
  }

  private meshes(baked: readonly Baked[], chunk: string, layer: Layer) {
    return baked.map(b => {
      const m = new Mesh(b.geometry, this.material(b));
      // Small target items (branches, shells, beds …) cast no sun shadow: it saves a shadow-pass draw per class and chunk.
      m.castShadow = layer === 'decor' && !b.look.opacity; m.receiveShadow = true; m.frustumCulled = false; m.userData = {chunk, layer};
      this.group.add(m);
      return m;
    });
  }

  // Replaces one layer of a chunk with a fresh batch per look class and frees the old geometry.
  private rebuild(key: string, layer: Layer, baked: readonly Baked[]) {
    const c = this.chunk(key);
    for (const m of c.meshes[layer]) { this.group.remove(m); m.geometry.dispose(); }
    c.meshes[layer] = this.meshes(mergeBaked(baked), key, layer);
    c.box.makeEmpty();
    for (const m of [...c.meshes.decor, ...c.meshes.targets]) { m.geometry.computeBoundingBox(); c.box.union(m.geometry.boundingBox!); }
  }

  // Target props by chunk and layer; a layer is re-merged only when one of its placements changed.
  private syncTargets(w: World, targets: readonly Landmark[]) {
    const byChunk = new Map<string, Record<Layer, Placement[]>>(), fires: Placement[] = [];
    for (const t of targets) {
      if (drawnBy(t.kind) !== 'prop') continue;
      const key = chunkOf(t.x / UNIT, t.y / UNIT), entry = byChunk.get(key) ?? {decor: [], targets: []}, layer: Layer = VOLATILE_KINDS.has(t.kind) ? 'targets' : 'decor';
      for (const p of targetPlacements(t, w)) { entry[layer].push(p); if (p.model === 'campfire') fires.push(p); }
      byChunk.set(key, entry);
    }
    for (const key of new Set([...byChunk.keys(), ...this.chunks.keys()])) {
      const c = this.chunk(key), entry = byChunk.get(key) ?? {decor: [], targets: []};
      for (const layer of ['decor', 'targets'] as const) {
        const sig = entry[layer].map(p => JSON.stringify(p)).join('\n');
        if (c.sig[layer] === sig) continue;
        const parts = entry[layer].flatMap(p => bakePlacement(p, this.models));
        this.rebuild(key, layer, layer === 'decor' ? [...c.fixed, ...parts] : parts);
        c.sig[layer] = sig;
      }
    }
    this.syncFires(decorPlacements().filter(p => p.model === 'torch'), fires);
  }

  private syncFires(torches: readonly Placement[], camp: readonly Placement[]) {
    const key = JSON.stringify(camp);
    if (key === this.fireKey && this.fires.length) return;
    this.fireKey = key;
    for (const f of this.fires) {
      this.group.remove(f.group, f.glow);
      f.flames.geometry.dispose(); (f.flames.material as Material).dispose(); f.glow.material.dispose();
      if (f.embers) { f.embers.geometry.dispose(); (f.embers.material as Material).dispose(); }
    }
    this.fires = [...camp.map(p => this.fire(p, true)), ...torches.map(p => this.fire(p, false))];
  }

  // Crossed flame cards merged into one mesh, a glow sprite and, at the camp, embers (v7 campfire()).
  private fire(p: Placement, camp: boolean): Fire {
    const s = typeof p.scale === 'number' ? p.scale : 1, group = new Group();
    const layers: [number, number, number, number, number][] = camp ? [[.95, 1.2, .64, 3, 0], [.62, .82, .5, 3, .5]] : [[.26, .4, 1.93, 2, 0]];
    const cards = layers.flatMap(([w, h, y, n, rot]) => Array.from({length: n}, (_, i) => new PlaneGeometry(w, h).rotateY(rot + i * Math.PI / n).translate(0, y, 0)));
    const flames = new Mesh(mergeGeometries(cards)!, curvify(new MeshBasicMaterial({map: flameTexture(), transparent: true, depthWrite: false, side: DoubleSide})));
    flames.renderOrder = 3; group.add(flames);
    const glow = new Sprite(new SpriteMaterial({map: glowTexture(), blending: AdditiveBlending, depthWrite: false, transparent: true, opacity: camp ? .7 : 1}));
    const fire: Fire = {group, flames, glow, base: groundHeight(p.x, p.y), x: p.x / UNIT, z: p.y / UNIT, size: camp ? 2.4 : 1.6, phase: p.x * .01, camp};
    if (camp) {
      const r = mulberry(5), pos = new Float32Array(21);
      for (let i = 0; i < 7; i++) pos.set([(r() - .5) * .5, 1.1 + r() * .6, (r() - .5) * .4], i * 3);
      const geo = new BufferGeometry(); geo.setAttribute('position', new Float32BufferAttribute(pos, 3));
      fire.embers = new Points(geo, curvify(new PointsMaterial({color: '#ffd36a', size: .06}))); group.add(fire.embers);
    }
    group.position.set(fire.x, fire.base, fire.z); group.scale.setScalar(s);
    this.group.add(group, glow);
    return fire;
  }

  update(w: World, targets: readonly Landmark[], now: number, night: number, focusX: number, focusZ: number, win: ViewWindow, ahead = PROP_AHEAD) {
    // Target props change rarely (a pickup, a regrowth); four checks a second are plenty.
    if (now - this.synced >= SYNC_EVERY || this.synced < 0) { this.syncTargets(w, targets); this.synced = now; }
    for (const c of this.chunks.values()) {
      const show = !c.box.isEmpty() && inView(focusX, focusZ, win, ahead, 2, c.box.min.x, c.box.max.x, c.box.min.z, c.box.max.z);
      for (const m of [...c.meshes.decor, ...c.meshes.targets]) m.visible = show;
    }
    this.light.intensity = 0;
    for (const f of this.fires) {
      const flick = Math.sin(now * 13 + f.phase) * .06 + Math.sin(now * 7.3 + f.phase * 2) * .05;
      f.flames.scale.set(1 + flick * .6, 1 + flick, 1 + flick * .6);
      // Sprites ignore the bending shader, so their height is bent here; torches glow only after dusk (v7).
      const lift = f.camp ? .6 : 1.95, size = f.size * (f.camp ? 1 + night * .3 : night);
      f.glow.position.set(f.x, bendY(f.base + lift * f.group.scale.y, f.z, focusZ), f.z);
      f.glow.scale.set(size, size, 1); f.glow.visible = size > .05;
      // The camp light hangs a fixed unit above the fire (not shrunk with the ring), so the sand beside it is not burnt out.
      if (f.camp) { this.light.position.set(f.x, f.base + 1, f.z); this.light.intensity = (4 + 7 * night) * (1 + flick); this.light.distance = 7 + 5 * night; }
      if (f.embers) { const p = f.embers.geometry.getAttribute('position'); for (let i = 0; i < p.count; i++) p.setY(i, .9 + ((now * .45 + i * .37) % 1) * 1.1); p.needsUpdate = true; }
    }
    for (const m of this.glowing) { const g = m.userData.glow as {day: Color; dayIntensity: number; night: Color}; m.emissive.copy(g.day).lerp(g.night, night); m.emissiveIntensity = g.dayIntensity + (1.6 - g.dayIntensity) * night; }
  }
}
