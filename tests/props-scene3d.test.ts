import './helpers/fake-canvas.ts';
import test from 'node:test';
import assert from 'node:assert/strict';
import {Mesh, PointLight, type Object3D} from 'three';
import {emptyWorld, addPlayer, worldTargets, type World} from '../src/shared.ts';
import {life} from '../src/island-life.ts';
import {UNIT} from '../src/render3d/space.ts';
import {classMaterial} from '../src/render3d/paint3d.ts';
import {Props3D} from '../src/render3d/props-scene3d.ts';

const WINDOW = {behind: 10, back: 12.6, spread: .7};
function world(extra: (w: World) => void = () => {}) {
  const w = emptyWorld(); addPlayer(w, 'solo', '박하준'); w.phase = 4; life(w); extra(w);
  return w;
}
const lights = (o: Object3D) => { const out: PointLight[] = []; o.traverse(c => { if (c instanceof PointLight) out.push(c); }); return out; };
const meshes = (o: Object3D) => { const out: Mesh[] = []; o.traverse(c => { if (c instanceof Mesh) out.push(c); }); return out; };

test('Building the house keeps the one camp light (so no shader is rebuilt) and only dims it', () => {
  const props = new Props3D(), tent = world(), house = world(w => { w.house = {built: true, stock: {}, placed: [], nextId: 1, floor: 0, light: false}; });
  props.update(tent, worldTargets(tent), 0, 0, 1300 / UNIT, 680 / UNIT, WINDOW);
  assert.equal(lights(props.group).length, 1);
  assert.ok(lights(props.group)[0].intensity > 0, 'the campfire lights the camp');
  props.update(house, worldTargets(house), 1, 0, 1300 / UNIT, 680 / UNIT, WINDOW);
  assert.equal(lights(props.group).length, 1, 'the light stays in the scene');
  assert.equal(lights(props.group)[0].intensity, 0, 'no fire, no firelight');
});

test('Using up a resource re-merges only the small target batch of its own chunk, and frees the old one', () => {
  const props = new Props3D(), w = world(x => { x.resources.wood1 = 3; });
  props.update(w, worldTargets(w), 0, 0, 1300 / UNIT, 680 / UNIT, WINDOW);
  const before = new Set(meshes(props.group)), disposed = new Set<Mesh>();
  for (const m of before) { const g = m.geometry, dispose = g.dispose.bind(g); g.dispose = () => { disposed.add(m); dispose(); }; }
  w.resources.wood1 = 0;
  props.update(w, worldTargets(w), 1, 0, 1300 / UNIT, 680 / UNIT, WINDOW);
  const after = new Set(meshes(props.group)), removed = [...before].filter(m => !after.has(m));
  assert.ok(removed.length > 0, 'the branch batch was rebuilt');
  const wood = worldTargets(w).find(t => t.id === 'wood1')!, chunk = `${Math.floor(wood.x / UNIT / 16)},${Math.floor(wood.y / UNIT / 16)}`;
  for (const m of removed) {
    assert.equal(m.userData.layer, 'targets', 'decorations and buildings are not re-merged for a resource');
    assert.equal(m.userData.chunk, chunk, 'other chunks are left alone');
    assert.ok(disposed.has(m), 'the old geometry is freed');
  }
});

test('Prop materials are see-through around the hero and fade near the camera, like trees', () => {
  assert.equal(classMaterial({}).customProgramCacheKey(), 'curve-see');
  assert.equal(classMaterial({map: 'bark', double: true}).customProgramCacheKey(), 'curve-see');
});
