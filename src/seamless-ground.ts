// Seamless ground helpers.
// The island is one continuous outdoor space. Painted art pieces (beach, jungle, terrain extension)
// must meet without straight seams, so every edge is dissolved with a noise-shaped feather and the
// open ground is laid with mirror tiling (adjacent tiles share identical edge pixels).

import type {Point} from './terrain';

// Deterministic smooth value noise in the range 0..1.
export function noise1(t: number, seed = 0): number {
  // Hash an integer lattice coordinate into 0..1.
  const hash = (n: number) => {
    const s = Math.sin(n * 127.1 + seed * 311.7) * 43758.5453;
    return s - Math.floor(s);
  };
  const i = Math.floor(t);
  const f = t - i;
  // Smoothstep interpolation keeps the noise free of visible kinks.
  const u = f * f * (3 - 2 * f);
  return hash(i) * (1 - u) + hash(i + 1) * u;
}

// Two-octave noise used to make feather lines look organic instead of ruler-straight.
export function edgeNoise(t: number, seed = 0): number {
  return noise1(t / 90, seed) * 0.7 + noise1(t / 23, seed + 7) * 0.3;
}

export type FeatherEdges = {left?: number; right?: number; top?: number; bottom?: number};

// Alpha multiplier (0..1) for one pixel near the requested edges.
// Each edge has its own band width. The band is pushed inward by a noise amount so the
// visible border wanders like vegetation instead of following the image rectangle.
export function featherAlpha(x: number, y: number, w: number, h: number, edges: FeatherEdges, seed = 0): number {
  let alpha = 1;
  // Distance from each edge, paired with the coordinate that runs along that edge.
  const checks: Array<[number | undefined, number, number, number]> = [
    [edges.left, x, y, 1],
    [edges.right, w - 1 - x, y, 2],
    [edges.top, y, x, 3],
    [edges.bottom, h - 1 - y, x, 4],
  ];
  for (const [band, distance, along, salt] of checks) {
    if (!band) continue;
    // Noise decides how far into the band the transparent zone reaches at this position.
    const reach = edgeNoise(along, seed + salt) * band * 0.5;
    const t = Math.max(0, Math.min(1, (distance - reach) / (band * 0.5)));
    // Smoothstep for a soft ramp without banding.
    alpha = Math.min(alpha, t * t * (3 - 2 * t));
  }
  return alpha;
}

// Apply featherAlpha to an RGBA buffer in place.
export function featherPixels(data: Uint8ClampedArray, w: number, h: number, edges: FeatherEdges, seed = 0): void {
  const maxBand = Math.max(edges.left || 0, edges.right || 0, edges.top || 0, edges.bottom || 0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      // Skip the untouched interior quickly.
      const nearEdge = (edges.left && x < edges.left) || (edges.right && w - 1 - x < edges.right) || (edges.top && y < edges.top) || (edges.bottom && h - 1 - y < edges.bottom);
      if (!nearEdge || maxBand === 0) continue;
      const i = (y * w + x) * 4 + 3;
      data[i] = Math.round(data[i] * featherAlpha(x, y, w, h, edges, seed));
    }
  }
}

// Round, noise-edged alpha for small ground stamps (trail dirt).
export function blobPixels(data: Uint8ClampedArray, size: number, seed = 0): void {
  const c = (size - 1) / 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = x - c;
      const dy = y - c;
      const angle = Math.atan2(dy, dx);
      // Wobbly radius so stamps do not read as circles.
      const radius = c * (0.72 + 0.28 * noise1((angle + Math.PI) * 2.2, seed));
      const d = Math.hypot(dx, dy);
      const t = Math.max(0, Math.min(1, (radius - d) / (c * 0.35)));
      const i = (y * size + x) * 4 + 3;
      data[i] = Math.round(data[i] * t * t * (3 - 2 * t));
    }
  }
}

export type MirrorTile = {x: number; y: number; flipX: boolean; flipY: boolean};

// Mirror tiling: every other column flips horizontally and every other row flips vertically,
// so touching edges always come from the same source pixels and no seam can appear.
export function mirrorTiles(x0: number, y0: number, x1: number, y1: number, tileW: number, tileH: number): MirrorTile[] {
  const tiles: MirrorTile[] = [];
  for (let row = 0, y = y0; y < y1; row++, y += tileH) {
    for (let col = 0, x = x0; x < x1; col++, x += tileW) {
      tiles.push({x, y, flipX: col % 2 === 1, flipY: row % 2 === 1});
    }
  }
  return tiles;
}

export type Stamp = {x: number; y: number; variant: number; flip: boolean; scale: number};

// Evenly spaced, slightly jittered stamps along polylines. Used to paint the walkable dirt trails
// exactly where the footstep surface logic says dirt is, so art and gameplay agree.
export function trailStamps(trails: Point[][], spacing: number, jitter: number): Stamp[] {
  const stamps: Stamp[] = [];
  let n = 0;
  for (const trail of trails) {
    for (let i = 1; i < trail.length; i++) {
      const a = trail[i - 1];
      const b = trail[i];
      const length = Math.hypot(b.x - a.x, b.y - a.y);
      // Unit normal for sideways jitter.
      const nx = -(b.y - a.y) / length;
      const ny = (b.x - a.x) / length;
      for (let d = 0; d < length; d += spacing) {
        const t = d / length;
        const side = (noise1(n * 0.37, 41) - 0.5) * 2 * jitter;
        stamps.push({
          x: a.x + (b.x - a.x) * t + nx * side,
          y: a.y + (b.y - a.y) * t + ny * side,
          variant: n % 2,
          flip: noise1(n * 0.91, 5) > 0.5,
          scale: 0.85 + noise1(n * 0.53, 9) * 0.3,
        });
        n++;
      }
    }
  }
  return stamps;
}

// Painted-art placement shared by the renderer and tests.
// The extension source image is 1672x941. Its west edge is open sea, then sand, then grass.
export const GROUND_SCALE = 1820 / 1672;
export const COAST_CROP = {x: 0, width: 560};
export const WATER_CROP = {x: 0, width: 60};
export const INLAND_CROP = {x: 520, width: 1152};
// World x where the coast column starts. Its painted foam (about 150 source px in) lines up
// with shore(y) used by collision and the animated surf.
export const COAST_X = 490;
export const DIRT_CROPS = [{x: 950, y: 380, size: 130}, {x: 1320, y: 620, size: 130}];

// Seamless procedural sea tile (wraps on both axes). Colours are sampled from the painted surf
// at runtime so the open sea continues the coast art instead of repeating a mirrored strip.
export function seaPixels(data: Uint8ClampedArray, size: number, near: [number, number, number], far: [number, number, number]): void {
  const tau = Math.PI * 2;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size;
      const v = y / size;
      // Low-contrast swell made of integer-frequency waves: periodic, so tiles meet without seams,
      // and soft enough that no stripes or repeating motif can be read at gameplay zoom.
      const swell = 0.5
        + 0.22 * Math.sin(tau * (u + 0.3 * Math.sin(tau * v)))
        + 0.18 * Math.sin(tau * (2 * v + 0.25 * Math.sin(tau * 2 * u)))
        + 0.1 * Math.sin(tau * (3 * u + 2 * v));
      // Sparse caustic glints.
      const c = Math.sin(tau * (7 * u + 0.4 * Math.sin(tau * 3 * v))) * Math.sin(tau * (6 * v + 0.4 * Math.sin(tau * 2 * u)));
      const glint = Math.max(0, c - 0.82) * 3;
      const t = Math.max(0, Math.min(1, swell)) * 0.35;
      const i = (y * size + x) * 4;
      for (let k = 0; k < 3; k++) data[i + k] = Math.min(255, Math.round(near[k] * (1 - t) + far[k] * t + glint * 60));
      data[i + 3] = 255;
    }
  }
}

// Ground patches laid over mirror-tile axes to break the kaleidoscope symmetry that mirror
// tiling would otherwise show. Returns world positions and source variants.
export function symmetryBreakers(x0: number, x1: number, height: number, tileW: number, tileH: number, step: number, variants: number): Stamp[] {
  const out: Stamp[] = [];
  let n = 0;
  const push = (x: number, y: number) => {
    out.push({x: x + (noise1(n * 0.71, 3) - 0.5) * 160, y: y + (noise1(n * 0.43, 8) - 0.5) * 160, variant: n % variants, flip: noise1(n * 1.3, 4) > 0.5, scale: 0.9 + noise1(n * 0.29, 6) * 0.35});
    n++;
  };
  for (let x = x0 + tileW; x < x1; x += tileW) for (let y = step / 2; y < height; y += step) push(x, y);
  for (let y = tileH; y < height; y += tileH) for (let x = x0 + step / 2; x < x1; x += step) push(x, y);
  return out;
}
