import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld, addPlayer, worldTargets, type World} from '../src/shared.ts';
import {buriedCandidates, life, shellSpots} from '../src/island-life.ts';
import {obstacles} from '../src/terrain.ts';
import {groundKind} from '../src/render3d/ground3d.ts';
import {MODELS, SEA_MODELS, decorPlacements, drawnBy, targetPlacements} from '../src/render3d/props-layout.ts';
import {bakePlacement} from '../src/render3d/props-scene3d.ts';
import {UNIT} from '../src/render3d/space.ts';

function world(extra: (w: World) => void = () => {}) {
  const w = emptyWorld(); addPlayer(w, 'solo', '박하준'); w.phase = 4; life(w); extra(w);
  return w;
}
const inside = (x: number, y: number, pts: readonly {x: number; y: number}[]) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) { const a = pts[i], b = pts[j]; if ((a.y > y) !== (b.y > y) && x < (b.x - a.x) * (y - a.y) / (b.y - a.y) + a.x) c = !c; } return c; };

test('Every kind of target is drawn by a model, a tree, a billboard, a critter or tree fruit — no placeholder left', () => {
  const kinds = new Set([world(), world(w => { w.house = {built: true, stock: {}, placed: [], nextId: 1, floor: 0, light: false}; })].flatMap(w => worldTargets(w).map(t => t.kind)));
  for (const kind of ['cave', 'buried', 'monster']) kinds.add(kind);
  const missing = [...kinds].filter(k => !drawnBy(k));
  assert.deepEqual(missing, []);
  const w = world();
  for (const t of worldTargets(w).filter(t => drawnBy(t.kind) === 'prop')) {
    const list = targetPlacements(t, w);
    assert.ok(list.length > 0, `${t.id} (${t.kind}) has no model`);
    for (const p of list) assert.ok(p.model in MODELS, `${t.id} uses unknown model ${p.model}`);
  }
});

test('The camp is a tent with a campfire, and a cottage (no fire, as in 2D) once the house is built', () => {
  const tentWorld = world(), houseWorld = world(w => { w.house = {built: true, stock: {}, placed: [], nextId: 1, floor: 0, light: false}; });
  const models = (w: World) => targetPlacements(worldTargets(w).find(t => t.kind === 'camp')!, w).map(p => p.model);
  assert.ok(models(tentWorld).includes('tent') && models(tentWorld).includes('campfire'));
  assert.ok(models(houseWorld).includes('cottage') && !models(houseWorld).includes('tent') && !models(houseWorld).includes('campfire'));
});

test('A used-up resource is drawn smaller and darker until it regrows', () => {
  const w = world(w => { w.resources.wood1 = 0; });
  const wood = worldTargets(w).find(t => t.id === 'wood1')!;
  assert.ok(targetPlacements(wood, w).every(p => p.spent));
  const full = world(w => { w.resources.wood1 = 3; });
  assert.ok(targetPlacements(worldTargets(full).find(t => t.id === 'wood1')!, full).every(p => !p.spent));
});

test('Shells show the item lying there, and garden beds their stage and flower', () => {
  const w = world(w => { life(w).shells['shell-0'].item = 'conch'; life(w).plots[1] = {stage: 3, wet: true, stageAt: 0, flower: 'plumeria'}; });
  const shell = worldTargets(w).find(t => t.id === 'shell-0')!, bed = worldTargets(w).find(t => t.id === 'plot-1')!;
  assert.equal(targetPlacements(shell, w)[0].arg, 'conch');
  assert.equal(targetPlacements(bed, w)[0].arg, '3|plumeria|wet');
});

test('Decorations stay on land (except sea pieces), clear of every target and outside target collision shapes', () => {
  const w = world(), targets = worldTargets(w), targetShapes = obstacles.filter(o => targets.some(t => t.id === o.id));
  const decor = decorPlacements();
  assert.ok(decor.length >= 30, `${decor.length} decorations`);
  for (const d of decor) {
    assert.ok(d.model in MODELS, `unknown model ${d.model}`);
    if (!SEA_MODELS.has(d.model)) assert.notEqual(groundKind(d.x, d.y), 'sea', `${d.model} at ${d.x},${d.y} is in the sea`);
    // Daily spots count too: any day's X mark, shell or bottle may lie there.
    const spots = [...targets.filter(t => !['friend', 'animal', 'bug'].includes(t.kind)), ...buriedCandidates, ...shellSpots, ...shellSpots.map(s => ({id: `bottle-near-${s.id}`, x: s.x + 28, y: s.y + 10}))];
    const near = spots.find(t => Math.hypot(t.x - d.x, t.y - d.y) < 45);
    assert.equal(near, undefined, `${d.model} at ${d.x},${d.y} sits on ${near?.id}`);
    const shape = targetShapes.find(o => inside(d.x, d.y, o.points));
    assert.equal(shape, undefined, `${d.model} at ${d.x},${d.y} is inside ${shape?.id}`);
  }
});

test('Target props keep out of other targets\' collision shapes (tent pegs and ropes, cottage walls, stall, museum)', () => {
  const house = world(w => { w.house = {built: true, stock: {}, placed: [], nextId: 1, floor: 0, light: false}; });
  const models = new Map(), problems: string[] = [];
  for (const w of [world(), house]) {
    const targets = worldTargets(w), shapes = obstacles.filter(o => targets.some(t => t.id === o.id));
    for (const t of targets.filter(t => drawnBy(t.kind) === 'prop')) {
      // Where the game's own shapes overlap (workbench and camp), a model may fill its own shape.
      const others = shapes.filter(o => o.id !== t.id), own = shapes.find(o => o.id === t.id);
      for (const p of targetPlacements(t, w)) for (const b of bakePlacement(p, models)) {
        const pos = b.geometry.getAttribute('position');
        for (let i = 0; i < pos.count; i++) {
          // Roofs, awnings and the tent ridge overhang the path; only what stands on the ground counts.
          if (pos.getY(i) > 1.2) continue;
          const x = pos.getX(i) * UNIT, y = pos.getZ(i) * UNIT;
          if (own && inside(x, y, own.points)) continue;
          const hit = others.find(o => x >= o.bounds.left && x <= o.bounds.right && y >= o.bounds.top && y <= o.bounds.bottom && inside(x, y, o.points));
          if (hit && !problems.some(s => s.startsWith(`${t.id} (${p.model}) → ${hit.id}`))) problems.push(`${t.id} (${p.model}) → ${hit.id} at ${Math.round(x)},${Math.round(y)}`);
        }
      }
    }
  }
  assert.deepEqual(problems, []);
});
