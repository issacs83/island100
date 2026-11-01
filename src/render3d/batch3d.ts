// Static batching for props: every painted mesh under a placed group is baked into world space, its paint colour
// moved into vertex colours, and meshes of one look class concatenated, so a whole area of props costs one draw call
// per class instead of one per mesh.
import {BufferAttribute, Color, Float32BufferAttribute, Mesh, type BufferGeometry, type Object3D} from 'three';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';
import {classKey, classLook, paintOf, type Look} from './paint3d';

export type Baked = {key: string; look: Look; geometry: BufferGeometry};
const KEEP = ['position', 'normal', 'uv', 'color'];

// One mesh's geometry in world space with exactly position, normal, uv and colour, indexed.
function prepared(mesh: Mesh, color: Color, tint: number): BufferGeometry {
  const g = mesh.geometry.clone().applyMatrix4(mesh.matrixWorld), n = g.getAttribute('position').count;
  for (const name of Object.keys(g.attributes)) if (!KEEP.includes(name)) g.deleteAttribute(name);
  if (!g.getAttribute('normal')) g.computeVertexNormals();
  if (!g.getAttribute('uv')) g.setAttribute('uv', new Float32BufferAttribute(new Float32Array(n * 2), 2));
  const own = g.getAttribute('color'), colors = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) {
    const k = own ? [own.getX(i), own.getY(i), own.getZ(i)] : [1, 1, 1];
    colors[i * 3] = k[0] * color.r * tint; colors[i * 3 + 1] = k[1] * color.g * tint; colors[i * 3 + 2] = k[2] * color.b * tint;
  }
  g.setAttribute('color', new Float32BufferAttribute(colors, 3));
  if (!g.index) g.setIndex(new BufferAttribute(n > 65535 ? Uint32Array.from({length: n}, (_, i) => i) : Uint16Array.from({length: n}, (_, i) => i), 1));
  return g;
}

// Bakes a placed group (its own transform included). tint < 1 darkens, for spent resources.
export function bake(root: Object3D, tint = 1): Baked[] {
  root.updateMatrixWorld(true);
  const groups = new Map<string, {look: Look; parts: BufferGeometry[]}>(), color = new Color();
  root.traverse(o => {
    if (!(o instanceof Mesh)) return;
    const p = paintOf(o.material);
    if (!p) throw new Error(`unpainted mesh in prop ${root.name || root.type}`);
    const key = classKey(p.look);
    let entry = groups.get(key);
    if (!entry) { entry = {look: classLook(p.look), parts: []}; groups.set(key, entry); }
    entry.parts.push(prepared(o, color.set(p.color), tint));
  });
  return [...groups].map(([key, {look, parts}]) => ({key, look, geometry: merge(parts)}));
}

// Concatenates baked parts of the same class (parts stay untouched).
export function mergeBaked(parts: readonly Baked[]): Baked[] {
  const groups = new Map<string, Baked[]>();
  for (const b of parts) { const list = groups.get(b.key); if (list) list.push(b); else groups.set(b.key, [b]); }
  return [...groups].map(([key, list]) => ({key, look: list[0].look, geometry: list.length === 1 ? list[0].geometry.clone() : merge(list.map(b => b.geometry))}));
}

// mergeGeometries picks 16- or 32-bit indices for the result itself.
function merge(parts: BufferGeometry[]): BufferGeometry {
  const merged = mergeGeometries(parts, false);
  if (!merged) throw new Error('prop parts could not be merged');
  return merged;
}
