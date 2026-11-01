import test from 'node:test';
import assert from 'node:assert/strict';
import {obstacles} from '../src/terrain.ts';
import {emptyWorld, addPlayer, worldTargets} from '../src/shared.ts';
import {broadleafParts, obstacleCovered, palmParts, rockPlacements, treePlacements} from '../src/render3d/flora3d.ts';

test('Every 2D tree has a 3D tree: 138 wild trees (35 palms), the jungle palm and 10 choppable trees', () => {
  const trees = treePlacements();
  assert.equal(trees.filter(t => t.id.startsWith('wild-tree-')).length, 138);
  assert.equal(trees.filter(t => t.id.startsWith('wild-tree-') && t.palm).length, 35);
  assert.equal(trees.filter(t => t.choppable).length, 10);
  assert.equal(trees.find(t => t.id === 'tree-beach')?.palm, true);
  assert.ok(trees.some(t => t.id === 'palm-trunk' && t.palm));
});

test('Every mineable stone landmark gets a rock', () => {
  assert.deepEqual(rockPlacements().map(r => r.id).sort(), ['frontier-stone', 'frontier-stone-0', 'frontier-stone-1', 'frontier-stone-2', 'frontier-stone-3', 'frontier-stone-4', 'frontier-stone-5', 'stone']);
});

test('Every collision shape is drawn by something in 3D: a tree, a target prop or a stand-in', () => {
  const w = emptyWorld(); addPlayer(w, 'solo', '박하준'); w.phase = 4;
  const ids = new Set(worldTargets(w).map(t => t.id));
  const missing = obstacles.map(o => o.id).filter(id => !obstacleCovered(id, ids));
  assert.deepEqual(missing, []);
});

test('Tree models merge into one geometry per material', () => {
  const palm = palmParts(3), leaf = broadleafParts(1);
  for (const g of [palm.trunk, palm.fronds, leaf.trunk, leaf.canopy]) { assert.ok(g.attributes.position.count > 0); assert.ok(g.attributes.color); }
  assert.ok(leaf.canopy.attributes.uv, 'canopy keeps uvs for the leaf texture');
});
