import test from 'node:test';
import assert from 'node:assert/strict';
import {wantsRender3d} from '../src/island-view.ts';
import {heldKeys} from '../src/render3d/input3d.ts';

test('3D is the default view on WebGL2 devices; ?render=2d opts out', () => {
  assert.equal(wantsRender3d('?render=3d', () => true), true);
  assert.equal(wantsRender3d('?qa&render=3d', () => true), true);
  assert.equal(wantsRender3d('?render=3d', () => false), false);
  assert.equal(wantsRender3d('', () => true), true, '3D by default');
  assert.equal(wantsRender3d('?render=2d', () => true), false);
});

test('Movement keys are read by physical key, so the Korean layout and arrows both work', () => {
  assert.deepEqual(heldKeys(new Set(['KeyW', 'ShiftLeft'])), {up: true, down: false, left: false, right: false, run: true, sneak: false});
  assert.deepEqual(heldKeys(new Set(['ArrowLeft', 'KeyC'])), {up: false, down: false, left: true, right: false, run: false, sneak: true});
  assert.deepEqual(heldKeys(new Set()), {up: false, down: false, left: false, right: false, run: false, sneak: false});
});
