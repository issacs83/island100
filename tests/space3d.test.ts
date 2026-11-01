import test from 'node:test';
import assert from 'node:assert/strict';
import {PerspectiveCamera} from 'three';
import {landmarks} from '../src/shared.ts';
import {CURVE, LOOK_HEIGHT, PITCH, UNIT, aimCamera, bendY, cameraDistance, groundVisible, inView, pickBox, viewWindow, pickGround, projectScene, seeCircle, standingBox, treeBox} from '../src/render3d/space.ts';
import {hitSize} from '../src/render3d/hits.ts';

const FOCUS = {x: 1300, y: 680};
const rig = (w: number, h: number) => { const camera = new PerspectiveCamera(); aimCamera(camera, FOCUS, w, h); return camera; };

test('The desktop camera keeps the v7 framing: 5.4 up and 12.6 back from the focus', () => {
  const d = cameraDistance(1280, 720);
  assert.ok(Math.abs(d * Math.sin(PITCH) - 5.4) < .05, `up ${d * Math.sin(PITCH)}`);
  assert.ok(Math.abs(d * Math.cos(PITCH) - 12.6) < .05, `back ${d * Math.cos(PITCH)}`);
});

test('A portrait phone still sees 6.5 units of ground across at the focus', () => {
  const camera = rig(390, 844), fz = FOCUS.y / UNIT, fx = FOCUS.x / UNIT;
  const left = projectScene(camera, fz, fx - 3.25, LOOK_HEIGHT, fz, 390, 844), right = projectScene(camera, fz, fx + 3.25, LOOK_HEIGHT, fz, 390, 844);
  assert.ok(Math.abs(left.x) < 1 && Math.abs(right.x - 390) < 1, `edges ${left.x} ${right.x}`);
});

test('The ground drops by dz squared times the curve away from the focus', () => {
  assert.equal(bendY(0, 10, 10), 0);
  assert.ok(Math.abs(bendY(0, 0, 10) + 100 * CURVE) < 1e-12);
});

test('Picking a projected ground point returns that game point on desktop and phone screens', () => {
  for (const [w, h] of [[1280, 720], [390, 844]]) {
    const camera = rig(w, h), fz = FOCUS.y / UNIT;
    let checked = 0;
    for (const dx of [-500, -200, 0, 150, 300, 600]) for (const dy of [-700, -400, -150, 0, 150, 300]) {
      const x = FOCUS.x + dx, y = FOCUS.y + dy, p = projectScene(camera, fz, x / UNIT, 0, y / UNIT, w, h);
      if (p.x < 0 || p.x > w || p.y < 0 || p.y > h) continue;
      const q = pickGround(camera, fz, p.x, p.y, w, h);
      assert.ok(q && Math.abs(q.x - x) < .5 && Math.abs(q.y - y) < .5, `${w}x${h} ${x},${y} -> ${JSON.stringify(q)}`);
      checked++;
    }
    assert.ok(checked >= 8, `${w}x${h}: only ${checked} points were on screen`);
  }
});

test('A click above the horizon picks no ground', () => {
  const camera = rig(1280, 720);
  assert.equal(pickGround(camera, FOCUS.y / UNIT, 640, -1000, 1280, 720), undefined);
});

test('A click inside several boxes picks the one whose centre is nearest, then the nearer object', () => {
  const tree = {id: 'tree', left: 100, top: 50, right: 300, bottom: 400, depth: .5, seeThrough: false};
  const bug = {id: 'bug', left: 180, top: 330, right: 220, bottom: 380, depth: .6, seeThrough: false};
  assert.equal(pickBox([tree, bug], 200, 355), 'bug');
  assert.equal(pickBox([tree, bug], 200, 100), 'tree');
  assert.equal(pickBox([tree, bug], 50, 50), undefined);
  const back = {id: 'back', left: 0, top: 0, right: 10, bottom: 10, depth: .7, seeThrough: false}, front = {...back, id: 'front', depth: .3};
  assert.equal(pickBox([back, front], 5, 5), 'front');
});

test('Targets behind the bent horizon are out of sight; nearby ones are in sight (south-grove view)', () => {
  const hero = {x: 2450, y: 3250}, camera = new PerspectiveCamera();
  aimCamera(camera, hero, 1280, 720);
  const camp = landmarks.find(l => l.id === 'camp')!;
  assert.equal(groundVisible(camera, hero.y / UNIT, camp.x, camp.y, 1280, 720), false);
  assert.equal(groundVisible(camera, hero.y / UNIT, hero.x + 100, hero.y - 200, 1280, 720), true);
});

test('Of the objects under a click the nearest wins; ones within a unit behind it compete by centre distance', () => {
  const front = {id: 'front', left: 0, top: 0, right: 100, bottom: 200, depth: 12, seeThrough: false};
  const back = {id: 'back', left: 40, top: 40, right: 60, bottom: 60, depth: 25, seeThrough: false};
  assert.equal(pickBox([front, back], 50, 50), 'front');
  assert.equal(pickBox([front, {...back, id: 'beside', depth: 12.6}], 50, 50), 'beside');
});

test('A butterfly beside the trunk of a nearer tree stays clickable (second-wave sneak layout)', () => {
  const hero = {x: 2790, y: 3150}, camera = new PerspectiveCamera(), fz = hero.y / UNIT;
  aimCamera(camera, hero, 1280, 720);
  const tree = treeBox(camera, fz, 'frontier-tree-4', 2640, 3350, 1280, 720), bug = standingBox(camera, fz, 'bug', 2498, 3119, .7, .9, 1280, 720);
  const click = projectScene(camera, fz, 2498 / UNIT, 0, 3094 / UNIT, 1280, 720);
  assert.equal(pickBox([tree, bug], click.x, click.y), 'bug');
});

test('Inside the see-through circle a tree in front of the hero lets ground clicks through', () => {
  const tree = landmarks.find(l => l.id === 'tree-grove')!, hero = {x: tree.x, y: tree.y - 110}, camera = new PerspectiveCamera(), fz = hero.y / UNIT;
  aimCamera(camera, hero, 1280, 720);
  const box = treeBox(camera, fz, tree.id, tree.x, tree.y, 1280, 720), see = seeCircle(camera, fz, hero.x, hero.y, 1280, 720);
  const click = projectScene(camera, fz, (hero.x + 20) / UNIT, 0, (hero.y + 40) / UNIT, 1280, 720);
  assert.equal(pickBox([box], click.x, click.y), tree.id, 'without see-through the tree would take this click');
  assert.equal(pickBox([box], click.x, click.y, see), undefined);
});

test('A click on the crown of a nearer tree picks that tree, not a tree farther back whose crown overlaps it', () => {
  const near = {id: 'near', left: 0, top: 0, right: 0, bottom: 0, depth: 9, seeThrough: true, crown: {x: 100, y: 100, rx: 80, ry: 60}};
  const far = {id: 'far', left: 0, top: 0, right: 0, bottom: 0, depth: 22, seeThrough: true, crown: {x: 120, y: 90, rx: 30, ry: 25}};
  assert.equal(pickBox([near, far], 118, 92), 'near');
});

test('A butterfly just behind a grass stalk stays clickable wherever it flutters (second-wave sneak layout)', () => {
  const hero = {x: 2790, y: 3150}, camera = new PerspectiveCamera(), fz = hero.y / UNIT;
  aimCamera(camera, hero, 1280, 720);
  const tree = treeBox(camera, fz, 'frontier-tree-4', 2640, 3350, 1280, 720), fiber = standingBox(camera, fz, 'frontier-fiber', 2500, 3200, ...hitSize('fiber', false), 1280, 720);
  for (const at of [{x: 2502, y: 3121}, {x: 2498, y: 3119}, {x: 2520, y: 3160}, {x: 2480, y: 3140}]) {
    const bug = standingBox(camera, fz, 'bug', at.x, at.y, ...hitSize('bug', false), 1280, 720), click = projectScene(camera, fz, at.x / UNIT, 0, (at.y - 25) / UNIT, 1280, 720);
    assert.equal(pickBox([tree, fiber, bug], click.x, click.y), 'bug', `bug at ${at.x},${at.y}`);
  }
});

test('The view window comes from the camera: it holds the ground at the bottom screen corners and trees up to the bent horizon, on desktop and on a portrait phone', () => {
  for (const [w, h] of [[1920, 1080], [1280, 720], [390, 844]]) {
    const camera = new PerspectiveCamera(34, w / h, .1, 200), focus = {x: 1300, y: 680}, fx = focus.x / UNIT, fz = focus.y / UNIT;
    aimCamera(camera, focus, w, h);
    const win = viewWindow(camera, fz, w, h);
    for (const sx of [0, w / 2, w]) {
      const p = pickGround(camera, fz, sx, h - 1, w, h)!, x = p.x / UNIT, z = p.y / UNIT;
      assert.ok(inView(fx, fz, win, 24, 0, x, x, z, z), `${w}×${h}: bottom ground at ${x.toFixed(1)},${z.toFixed(1)} (focus ${fx.toFixed(1)},${fz.toFixed(1)}) is outside the window`);
    }
    assert.ok(inView(fx, fz, win, 44, 0, fx, fx, fz - 42, fz - 42), `${w}×${h}: a tree 42 units ahead is cut`);
    assert.ok(!inView(fx, fz, win, 24, 0, fx, fx, fz + win.behind + 3, fz + win.behind + 3), `${w}×${h}: ground behind the bottom edge is kept`);
  }
});
