import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacles} from '../src/terrain.ts';
import {landmarks} from '../src/shared.ts';
import {groundKind} from '../src/render3d/ground3d.ts';
import {insidePolygon} from '../src/render3d/terrain3d.ts';
import {UNIT} from '../src/render3d/space.ts';
import {dressingAround} from '../src/render3d/dressing3d.ts';

const camp = {x: 1300 / UNIT, z: 680 / UNIT}, meadow = {x: 2360 / UNIT, z: 1820 / UNIT};

test('Grass gets tufts, clover and daisies; sand gets pebbles; nothing grows in the sea', () => {
  const items = [...dressingAround(camp.x, camp.z), ...dressingAround(meadow.x, meadow.z)];
  const kinds = new Set(items.map(i => i.kind));
  for (const k of ['tuft', 'clover', 'daisy', 'pebble']) assert.ok(kinds.has(k as never), `no ${k}`);
  for (const i of items) {
    const ground = groundKind(i.x * UNIT, i.z * UNIT);
    assert.notEqual(ground, 'sea');
    if (i.kind === 'pebble') assert.ok(ground === 'sand' || ground === 'wetSand', `pebble on ${ground}`); else assert.equal(ground, 'grass', `${i.kind} on ${ground}`);
  }
  assert.ok(items.filter(i => i.kind === 'tuft').length > 300, 'the lawn is dressed densely like v7');
});

test('Nothing grows inside a collision shape or on top of a landmark', () => {
  const items = dressingAround(camp.x, camp.z);
  for (const i of items) {
    const x = i.x * UNIT, y = i.z * UNIT;
    const shape = obstacles.find(o => x >= o.bounds.left && x <= o.bounds.right && y >= o.bounds.top && y <= o.bounds.bottom && insidePolygon(x, y, o.points));
    assert.equal(shape, undefined, `${i.kind} inside ${shape?.id}`);
    const on = landmarks.find(l => Math.hypot(l.x - x, l.y - y) < 34);
    assert.equal(on, undefined, `${i.kind} on ${on?.id}`);
  }
});

test('Dressing is fixed to the ground: every tuft still inside the moved window is the same tuft', () => {
  const key = (i: {kind: string; x: number; z: number}) => `${i.kind}:${i.x.toFixed(3)}:${i.z.toFixed(3)}`;
  const a = dressingAround(camp.x, camp.z), b = new Set(dressingAround(camp.x + 5, camp.z - 3).map(key));
  const bx0 = Math.min(...[...b].map(k => Number(k.split(':')[1]))), bx1 = Math.max(...[...b].map(k => Number(k.split(':')[1])));
  const bz0 = Math.min(...[...b].map(k => Number(k.split(':')[2]))), bz1 = Math.max(...[...b].map(k => Number(k.split(':')[2])));
  const overlap = a.filter(i => i.x > bx0 + 1 && i.x < bx1 - 1 && i.z > bz0 + 1 && i.z < bz1 - 1);
  assert.ok(overlap.length > 200);
  assert.deepEqual(overlap.filter(i => !b.has(key(i))).map(key), []);
});

test('A portrait phone, which sees farther behind the focus, gets its lawn dressed down to the bottom edge', () => {
  const phone = {behind: 9.1, back: 10, spread: .32}, items = dressingAround(camp.x, camp.z, phone);
  assert.ok(items.some(i => i.z > camp.z + 9), 'grass behind the old 6-unit limit is dressed');
});
