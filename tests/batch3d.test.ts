import test from 'node:test';
import assert from 'node:assert/strict';
import {BoxGeometry, Color, ExtrudeGeometry, Float32BufferAttribute, Group, Mesh, Shape} from 'three';
import {paint, classKey} from '../src/render3d/paint3d.ts';
import {bake, mergeBaked} from '../src/render3d/batch3d.ts';
import {bush, campfire, cottage, tent} from '../src/render3d/props3d.ts';

const colorsOf = (g: {getAttribute(n: string): {count: number; getX(i: number): number; getY(i: number): number; getZ(i: number): number}}) => {
  const c = g.getAttribute('color'), out = new Set<string>();
  for (let i = 0; i < c.count; i++) out.add([c.getX(i), c.getY(i), c.getZ(i)].map(v => v.toFixed(3)).join(','));
  return out;
};
const key = (hex: string) => {const c = new Color(hex); return [c.r, c.g, c.b].map(v => v.toFixed(3)).join(',');};

test('Meshes with one look merge into one geometry and keep their colours as vertex colours', () => {
  const g = new Group();
  g.add(new Mesh(new BoxGeometry(1, 1, 1), paint('#ff0000')), new Mesh(new BoxGeometry(1, 1, 1), paint('#00ff00')));
  const out = bake(g);
  assert.equal(out.length, 1);
  assert.deepEqual([...colorsOf(out[0].geometry)].sort(), [key('#ff0000'), key('#00ff00')].sort());
  assert.equal(out[0].geometry.getAttribute('position').count, 48);
});

test('Baking applies the placement transform of the group and of each mesh', () => {
  const g = new Group(), m = new Mesh(new BoxGeometry(1, 1, 1), paint('#ffffff'));
  m.position.set(1, .5, 0); g.add(m); g.position.set(10, 0, 5); g.rotation.y = Math.PI / 2;
  const [b] = bake(g);
  b.geometry.computeBoundingBox();
  const c = b.geometry.boundingBox!.getCenter(m.position.clone());
  assert.ok(Math.abs(c.x - 10) < 1e-6 && Math.abs(c.y - .5) < 1e-6 && Math.abs(c.z - 4) < 1e-6, `centre ${c.toArray()}`);
});

test('Looks that differ only by colour or by a nearby roughness share a class; a texture or a glow does not', () => {
  assert.equal(classKey({roughness: .9}), classKey({roughness: .95}));
  assert.equal(classKey({}), classKey({roughness: .85}));
  assert.notEqual(classKey({}), classKey({map: 'bark'}));
  assert.equal(classKey({roughness: .6}), classKey({roughness: .95}));
  assert.equal(classKey({roughness: .3, metalness: .6}), classKey({roughness: .3}));
  assert.notEqual(classKey({}), classKey({roughness: .2}));
  assert.notEqual(classKey({}), classKey({emissive: '#ffb340'}));
});

test('Non-indexed geometry (extrusions) merges with indexed geometry', () => {
  const s = new Shape(); s.moveTo(0, 0); s.lineTo(1, 0); s.lineTo(0, 1); s.closePath();
  const extrude = new ExtrudeGeometry(s, {depth: .2, bevelEnabled: false}), box = new BoxGeometry(1, 1, 1);
  const g = new Group();
  g.add(new Mesh(extrude, paint('#ffffff')), new Mesh(box, paint('#ffffff')));
  const [b] = bake(g);
  assert.equal(b.geometry.getAttribute('position').count, extrude.getAttribute('position').count + box.getAttribute('position').count);
  assert.ok(b.geometry.index, 'merged geometry is indexed');
});

test('Vertex colours already on a part are multiplied by the paint colour, and spent props are darkened', () => {
  const geo = new BoxGeometry(1, 1, 1), n = geo.getAttribute('position').count;
  geo.setAttribute('color', new Float32BufferAttribute(new Array(n * 3).fill(.5), 3));
  const g = new Group(); g.add(new Mesh(geo, paint('#ffffff')));
  assert.deepEqual([...colorsOf(bake(g)[0].geometry)], ['0.500,0.500,0.500']);
  const dark = new Group(); dark.add(new Mesh(new BoxGeometry(1, 1, 1), paint('#ffffff')));
  assert.deepEqual([...colorsOf(bake(dark, .6)[0].geometry)], ['0.600,0.600,0.600']);
});

test('Parts baked separately merge per class; the v7 camp set needs only a handful of draw calls', () => {
  const parts = [tent(), campfire(), bush('#e8402f', 3), cottage()].flatMap(g => bake(g));
  const merged = mergeBaked(parts);
  assert.equal(new Set(merged.map(b => b.key)).size, merged.length);
  assert.ok(merged.length <= 16, `${merged.length} classes`);
  const total = (list: typeof parts) => list.reduce((n, b) => n + b.geometry.getAttribute('position').count, 0);
  assert.equal(total(merged), total(parts));
});
