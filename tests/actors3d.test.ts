import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld, addPlayer, worldTargets} from '../src/shared.ts';
import {Color, Scene, Texture, type CanvasTexture} from 'three';
import {Actors3D, actorFrame, actorHeight, frameWindow, listActors} from '../src/render3d/actors3d.ts';
import {drawnBy} from '../src/render3d/props-layout.ts';

test('Character frames follow the 2D rules: talk, walk cycle, blink, idle', () => {
  assert.equal(actorFrame(0, false, 0, 0, .05), 2);
  assert.equal(actorFrame(0, false, 0, 0, .01), 3);
  assert.equal(actorFrame(0, false, 0, 0, 0), 0);
  assert.equal(actorFrame(10.6, true, 0, 0, undefined), 8 + 10 % 8);
  assert.equal(actorFrame(0, false, 4.15, 0, undefined), 1);
  assert.equal(actorFrame(0, false, 2, 0, undefined), 0);
});

test('A frame maps to its cell in the atlas, counted from the top-left like the sheet', () => {
  assert.deepEqual(frameWindow(0, 8, 3), {repeatX: 1 / 8, repeatY: 1 / 3, offsetX: 0, offsetY: 2 / 3});
  assert.deepEqual(frameWindow(10, 8, 3), {repeatX: 1 / 8, repeatY: 1 / 3, offsetX: 2 / 8, offsetY: 1 / 3});
});

test('Hajun stands 1.62 units tall like v7 and Yeoreum art stands a little shorter', () => {
  assert.equal(actorHeight(0), 1.62);
  assert.equal(actorHeight(1), 1.42);
});

test('Actors: online outdoor players, the companion and friends not already playing', () => {
  const w = emptyWorld(), me = addPlayer(w, 'solo', '박하준');
  me.ready = true; w.phase = 4;
  w.companion = {...(w.companion ?? {x: 1050, y: 545, face: 1, walk: 0, moving: false, mode: 'explore'}), x: 1050, y: 545} as unknown as NonNullable<typeof w.companion>;
  w.friends = [{name: '이도윤', color: 2}, {name: '박하준', color: 0}] as unknown as typeof w.friends;
  const ids = listActors(w, me).map(a => a.id);
  assert.ok(ids.includes(me.id) && ids.includes('npc-yeoreum') && ids.includes('friend-0'));
  assert.ok(!ids.includes('friend-1'), 'a friend with a playing name stays hidden');
  me.room = {x: 0, y: 0} as unknown as NonNullable<typeof me.room>;
  assert.ok(!listActors(w, me).some(a => a.id === me.id), 'a player indoors is not drawn outside');
});

test('Every target kind has a 3D look: a prop model, a tree, an actor, a critter or tree fruit', () => {
  const w = emptyWorld(); addPlayer(w, 'solo', '박하준'); w.phase = 4;
  const kinds = new Set([...worldTargets(w).map(t => t.kind), 'monster']);
  assert.ok(kinds.size >= 28, `${kinds.size} kinds`);
  assert.deepEqual([...kinds].filter(k => !drawnBy(k)), []);
});

test('A left-facing frame mirrors its cell in UV space (a negative sprite scale is ignored by three.js)', () => {
  assert.deepEqual(frameWindow(10, 8, 3, true), {repeatX: -1 / 8, repeatY: 1 / 3, offsetX: 3 / 8, offsetY: 1 / 3});
});

test('Yeoreum stands at her 2D spot when no companion runs (coop) unless an online player is named 김여름; offline players do not hide friends', () => {
  const w = emptyWorld(), me = addPlayer(w, 'a', '박하준');
  me.ready = true;
  delete w.companion;
  w.friends = [{name: '이도윤', color: 2}] as unknown as typeof w.friends;
  addPlayer(w, 'b', '이도윤').online = false;
  const actors = listActors(w, me), yeoreum = actors.find(a => a.id === 'npc-yeoreum');
  assert.ok(yeoreum && yeoreum.x === 1050 && yeoreum.y === 545, JSON.stringify(yeoreum));
  assert.ok(actors.some(a => a.id === 'friend-0'), 'an offline player with the same name does not hide the friend');
  addPlayer(w, 'c', '김여름');
  assert.ok(!listActors(w, me).some(a => a.id === 'npc-yeoreum'), 'an online 김여름 replaces the companion');
});

test('Each character sprite clones its atlas texture once, not every frame', () => {
  (globalThis as {Image?: unknown}).Image ??= class { set src(_: string) {} };
  const w = emptyWorld(), me = addPlayer(w, 'solo', '박하준');
  me.ready = true;
  let clones = 0;
  const atlas = {clone: () => { clones++; return new Texture(); }} as unknown as CanvasTexture;
  const actors = new Actors3D(new Scene()), voice = {amplitude: () => 0};
  (actors as unknown as {atlases: unknown}).atlases = {hajun: atlas, yeoreum: atlas};
  actors.update(w, me, 0, 10, new Color(), voice);
  actors.update(w, me, .1, 10, new Color(), voice);
  assert.equal(clones, listActors(w, me).length);
});
