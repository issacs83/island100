import test from 'node:test';
import assert from 'node:assert/strict';
import {Box3} from 'three';
import {obstacles} from '../src/terrain.ts';
import {shore, WIDTH} from '../src/shared.ts';
import {UNIT} from '../src/render3d/space.ts';
import {STAND_INS, treePlacements} from '../src/render3d/flora3d.ts';
import {MODELS} from '../src/render3d/props-layout.ts';
import {BORDER, insidePolygon, standInPlacements, terrainGroups} from '../src/render3d/terrain3d.ts';

test('Every stand-in collision shape is drawn by models standing inside it — rocks, bushes, a log — or by a cliff or pool', () => {
  const placements = standInPlacements(), groups = terrainGroups();
  for (const o of obstacles.filter(o => o.id in STAND_INS)) {
    const kind = STAND_INS[o.id].kind;
    if (kind === 'cliff' || kind === 'pool') { assert.ok(groups.some(g => g.name === o.id), `${o.id} has no ${kind}`); continue; }
    const mine = placements.filter(p => p.from === o.id);
    assert.ok(mine.length > 0, `${o.id} has no models`);
    for (const p of mine) assert.ok(p.model in MODELS, `${o.id} uses unknown model ${p.model}`);
    const inside = mine.filter(p => insidePolygon(p.x, p.y, o.points)).length;
    assert.ok(inside >= mine.length * .7, `${o.id}: only ${inside}/${mine.length} models inside the shape`);
  }
});

test('Big rock shapes get bigger boulders than small ones', () => {
  const biggest = (id: string) => Math.max(...standInPlacements().filter(p => p.from === id && p.model === 'boulder').map(p => typeof p.scale === 'number' ? p.scale : p.scale![1]));
  assert.ok(biggest('jungle-main-rock') > biggest('beach-small-rock') * 1.5);
});

test('A cliff rises to its stand-in height over its whole shape', () => {
  const cliff = terrainGroups().find(g => g.name === 'jungle-cliff')!, o = obstacles.find(o => o.id === 'jungle-cliff')!;
  const box = new Box3().setFromObject(cliff);
  assert.ok(Math.abs(box.max.y - STAND_INS['jungle-cliff'].height) < .25, `top ${box.max.y}`);
  assert.ok(box.min.x <= o.bounds.left / UNIT + .1 && box.max.x >= o.bounds.right / UNIT - .1);
});

test('The north border is a cliff along the top edge of the land, from the shore to the east end, outside the walkable world', () => {
  const border = terrainGroups().find(g => g.name === 'north-border')!, box = new Box3().setFromObject(border);
  assert.ok(box.max.z <= .05, `border reaches z ${box.max.z}`);
  assert.ok(box.min.x <= (shore(0) + 80) / UNIT && box.max.x >= WIDTH / UNIT, `x ${box.min.x}..${box.max.x}`);
  assert.ok(Math.abs(box.max.y - BORDER.height) < .25);
});

test('Trees stand on the border plateau, none of them choppable, none inside the world', () => {
  const trees = treePlacements().filter(t => t.id.startsWith('border-tree-'));
  assert.ok(trees.length >= 30, `${trees.length} border trees`);
  for (const t of trees) { assert.equal(t.choppable, false); assert.ok(t.y < -40, `${t.id} at y ${t.y}`); assert.equal(t.base, BORDER.height); }
});
