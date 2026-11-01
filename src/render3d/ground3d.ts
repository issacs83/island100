import {BufferAttribute, BufferGeometry, Color} from 'three';
import {surfaceAt, shore, type Surface} from '../terrain';
import {WIDTH, HEIGHT} from '../shared';
import {UNIT} from './space';
import {GROUND, noise2} from './look';

// Ground covers the island plus a margin of sea and land so the camera never shows an edge before P2 adds borders.
export const GROUND_BOUNDS = {x0: -16, z0: -16, x1: 121, z1: 75};
export const CHUNK = 16, SEGMENTS_PER_UNIT = 3;
export type GroundKind = Surface | 'sea';
export type ChunkKey = {cx: number; cz: number};

const clampX = (x: number) => Math.min(Math.max(x, 0), WIDTH), clampY = (y: number) => Math.min(Math.max(y, 0), HEIGHT);
// Surface the 3D ground paints at a game point: sea west of the shore, otherwise the 2D surface rules (edges repeat outward).
export function groundKind(x: number, y: number): GroundKind {
  if (x < shore(y)) return 'sea';
  return surfaceAt({x: clampX(x), y: clampY(y)});
}
// Height in scene units: walkable land is flat at 0; the sea floor slopes to −2.2 offshore like the v7 scene.
export function groundHeight(x: number, y: number) {
  const d = (x - shore(y)) / UNIT;
  return d < 0 ? Math.max(-2.2, d * .22) : 0;
}
const C = Object.fromEntries(Object.entries(GROUND).map(([k, v]) => [k, new Color(v)])) as Record<keyof typeof GROUND, Color>;
// Vertex colour: sand darkens toward the waterline, grass varies with noise, the sea floor deepens offshore.
export function groundColor(x: number, y: number, out = new Color()): Color {
  const kind = groundKind(x, y), d = (x - shore(y)) / UNIT;
  switch (kind) {
    case 'sea': return out.copy(C.seaFloor).lerp(C.deepFloor, Math.min(1, -d / 2));
    case 'wetSand': return out.copy(C.wetSand);
    case 'sand': return out.copy(C.wetSand).lerp(C.sand, Math.min(1, Math.max(0, (d - .3) / 1.4)));
    case 'grass': return out.copy(C.grassA).lerp(C.grassB, noise2(x / UNIT * .22 + 3, y / UNIT * .22));
    case 'dirt': return out.copy(C.dirt);
    case 'stone': return out.copy(C.stone);
  }
}
// Chunk grid over GROUND_BOUNDS; each chunk is at most CHUNK × CHUNK scene units.
export function groundChunks(): ChunkKey[] {
  const out: ChunkKey[] = [];
  for (let cz = 0; GROUND_BOUNDS.z0 + cz * CHUNK < GROUND_BOUNDS.z1; cz++)
    for (let cx = 0; GROUND_BOUNDS.x0 + cx * CHUNK < GROUND_BOUNDS.x1; cx++) out.push({cx, cz});
  return out;
}
export function chunkBounds({cx, cz}: ChunkKey) {
  const x0 = GROUND_BOUNDS.x0 + cx * CHUNK, z0 = GROUND_BOUNDS.z0 + cz * CHUNK;
  return {x0, z0, x1: Math.min(x0 + CHUNK, GROUND_BOUNDS.x1), z1: Math.min(z0 + CHUNK, GROUND_BOUNDS.z1)};
}
// Vertex-coloured height field for one chunk, in scene units, with uvs for the tiling detail texture.
export function buildGroundChunk(key: ChunkKey): BufferGeometry {
  const b = chunkBounds(key), nx = Math.round((b.x1 - b.x0) * SEGMENTS_PER_UNIT), nz = Math.round((b.z1 - b.z0) * SEGMENTS_PER_UNIT);
  const count = (nx + 1) * (nz + 1), positions = new Float32Array(count * 3), colors = new Float32Array(count * 3), uvs = new Float32Array(count * 2), color = new Color();
  for (let j = 0, v = 0; j <= nz; j++) for (let i = 0; i <= nx; i++, v++) {
    const X = b.x0 + (b.x1 - b.x0) * i / nx, Z = b.z0 + (b.z1 - b.z0) * j / nz, x = X * UNIT, y = Z * UNIT;
    positions.set([X, groundHeight(x, y), Z], v * 3);
    groundColor(x, y, color);
    colors.set([color.r, color.g, color.b], v * 3);
    uvs.set([X / 4, Z / 4], v * 2);
  }
  const index: number[] = [];
  for (let j = 0; j < nz; j++) for (let i = 0; i < nx; i++) {
    const a = j * (nx + 1) + i, right = a + 1, below = a + nx + 1, diagonal = below + 1;
    index.push(a, below, right, right, below, diagonal);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute('position', new BufferAttribute(positions, 3));
  geometry.setAttribute('color', new BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new BufferAttribute(uvs, 2));
  geometry.setIndex(index);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
