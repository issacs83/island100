import test from 'node:test';
import assert from 'node:assert/strict';
import {canStand} from '../src/terrain.ts';
import {SHOT_SPOTS} from '../qa/shot-spots.ts';

test('The nine comparison spots are places the hero can stand, two of them also shot on a phone', () => {
  assert.equal(SHOT_SPOTS.length, 9);
  assert.deepEqual(SHOT_SPOTS.filter(s => !canStand(s)).map(s => s.key), []);
  assert.deepEqual(SHOT_SPOTS.filter(s => s.phone).map(s => s.key), ['camp', 'first-beach']);
});
