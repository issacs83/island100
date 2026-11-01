import test from 'node:test';
import assert from 'node:assert/strict';
import {MeshStandardMaterial} from 'three';
import {surfaceAt, shore} from '../src/terrain.ts';
import {CAMP} from '../src/exploration.ts';
import {WIDTH, HEIGHT} from '../src/shared.ts';
import {UNIT} from '../src/render3d/space.ts';
import {bend, curvify} from '../src/render3d/look.ts';
import {CHUNK, GROUND_BOUNDS, buildGroundChunk, chunkBounds, groundChunks, groundColor, groundKind} from '../src/render3d/ground3d.ts';
import {buildWaterGeometry} from '../src/render3d/water3d.ts';

test('The 3D ground uses the 2D surface rules on land and marks the sea west of the shore', () => {
  for (let y = 100; y < HEIGHT; y += 173) for (let x = 40; x < WIDTH; x += 211) {
    const kind = groundKind(x, y);
    if (x < shore(y)) assert.equal(kind, 'sea', `${x},${y}`);
    else assert.equal(kind, surfaceAt({x, y}), `${x},${y}`);
  }
});

test('Every vertex of the camp chunk is coloured by groundColor at its own game point', () => {
  const key = groundChunks().find(k => { const b = chunkBounds(k); return CAMP.x / UNIT >= b.x0 && CAMP.x / UNIT < b.x1 && CAMP.y / UNIT >= b.z0 && CAMP.y / UNIT < b.z1; })!;
  const g = buildGroundChunk(key), p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i += 97) {
    const want = groundColor(p.getX(i) * UNIT, p.getZ(i) * UNIT);
    assert.ok(Math.abs(c.getX(i) - want.r) < 1e-6 && Math.abs(c.getY(i) - want.g) < 1e-6 && Math.abs(c.getZ(i) - want.b) < 1e-6, `vertex ${i}`);
  }
});

test('Land stays flat at height 0 and the sea floor sinks offshore', () => {
  const key = groundChunks().find(k => chunkBounds(k).x0 <= 0 && chunkBounds(k).x1 > 0 && chunkBounds(k).z0 <= 10 && chunkBounds(k).z1 > 10)!;
  const g = buildGroundChunk(key), p = g.attributes.position;
  let sea = 0;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i) * UNIT, y = p.getZ(i) * UNIT;
    if (x < shore(y)) { assert.ok(p.getY(i) <= 0, `sea vertex above water ${x},${y}`); sea++; }
    else assert.equal(p.getY(i), 0);
  }
  assert.ok(sea > 0, 'the chunk holds some sea');
});

test('Ground chunks tile the ground bounds without gaps or overlaps', () => {
  const chunks = groundChunks();
  let area = 0;
  for (const k of chunks) { const b = chunkBounds(k); assert.ok(b.x1 - b.x0 <= CHUNK && b.z1 - b.z0 <= CHUNK); area += (b.x1 - b.x0) * (b.z1 - b.z0); }
  assert.equal(area, (GROUND_BOUNDS.x1 - GROUND_BOUNDS.x0) * (GROUND_BOUNDS.z1 - GROUND_BOUNDS.z0));
});

test('Water distance is positive offshore and negative on land', () => {
  const g = buildWaterGeometry(), p = g.attributes.position, d = g.attributes.aDist;
  for (let i = 0; i < p.count; i += 211) {
    const x = p.getX(i) * UNIT, y = p.getZ(i) * UNIT;
    assert.ok(Math.abs(d.getX(i) - (shore(y) - x) / UNIT) < 1e-3, `${x},${y}`);
  }
  assert.ok(p.count < 25000, `${p.count} water vertices`);
});

test('Bent materials drop vertices by dz squared after the model transform', () => {
  const material = curvify(new MeshStandardMaterial());
  const shader = {uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}'};
  material.onBeforeCompile(shader as never, {} as never);
  assert.ok(shader.vertexShader.includes('bentWorld.y -= dzc * dzc * uCurve;'));
  assert.ok(shader.vertexShader.includes('uniform vec3 uFocus;'));
  assert.equal(shader.uniforms.uCurve, bend.uCurve);
});

test('See-through materials dither away near-camera fragments around the hero; plain bent materials do not', () => {
  const fake = () => ({uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n#include <clipping_planes_fragment>\n}'});
  const see = curvify(new MeshStandardMaterial(), {seeThrough: true}), plain = curvify(new MeshStandardMaterial());
  const a = fake(), b = fake();
  see.onBeforeCompile(a as never, {} as never);
  plain.onBeforeCompile(b as never, {} as never);
  assert.ok(a.fragmentShader.includes('discard') && a.fragmentShader.includes('uSee') && a.vertexShader.includes('vSeeDepth'));
  assert.ok(!b.fragmentShader.includes('discard') && !b.vertexShader.includes('vSeeDepth'));
  assert.notEqual(see.customProgramCacheKey(), plain.customProgramCacheKey());
});

test('The see-through hole opens only above knee height, so low props in front of the hero stay solid', () => {
  const fake = () => ({uniforms: {} as Record<string, unknown>, vertexShader: '#include <common>\nvoid main() {\n#include <project_vertex>\n}', fragmentShader: '#include <common>\nvoid main() {\n#include <clipping_planes_fragment>\n}'});
  const see = curvify(new MeshStandardMaterial(), {seeThrough: true}), shader = fake();
  see.onBeforeCompile(shader as never, {} as never);
  // The unbent world height travels to the fragment shader and scales the hole around the hero.
  assert.ok(shader.vertexShader.includes('vSeeHeight = bentWorld.y;'), 'world height is captured before the bend');
  assert.match(shader.fragmentShader, /seeHole = .*smoothstep\(SEE_FROM, SEE_FULL, vSeeHeight\)/);
});
