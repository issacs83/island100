import {CanvasTexture, DataTexture, IcosahedronGeometry, MeshStandardMaterial, MeshToonMaterial, NearestFilter, RedFormat, RepeatWrapping, SRGBColorSpace, Vector2, Vector3, type BufferGeometry, type Material, type MeshStandardMaterialParameters, type MeshToonMaterialParameters} from 'three';
import {mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js';
import {CURVE} from './space';

// Uniforms every bent material shares: curve strength and the focus in scene units (set each frame).
export const bend = {uCurve: {value: CURVE}, uFocus: {value: new Vector3()}};

// See-through, the 3D form of the 2D rule that fades trees in front of the hero: in opted-in materials, fragments
// nearer the camera than the hero are dithered away inside a screen circle around him (uSee = centre x, y and
// radius in drawing-buffer pixels, radius 0 turns it off), and anything closer to the camera than uNearFade.y fades
// out so foreground trees never fill the screen. Shadows use the default depth material and are unaffected.
export const seeThrough = {uSee: {value: new Vector3()}, uSeeDepth: {value: 0}, uNearFade: {value: new Vector2(4, 7)}};

// Bends a built-in material like the v7 scene: world-space y drops by dz² · uCurve before the view transform.
// Shadow depth stays unbent on purpose, so receivers (also unbent in worldpos_vertex) line up with casters.
export function curvify<T extends Material>(material: T, options: {seeThrough?: boolean} = {}): T {
  const see = !!options.seeThrough;
  material.onBeforeCompile = shader => {
    shader.uniforms.uCurve = bend.uCurve;
    shader.uniforms.uFocus = bend.uFocus;
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uCurve;\nuniform vec3 uFocus;' + (see ? '\nvarying float vSeeDepth;\nvarying float vSeeHeight;' : ''))
      .replace('#include <project_vertex>', [
        'vec4 mvPosition = vec4( transformed, 1.0 );',
        '#ifdef USE_BATCHING', 'mvPosition = batchingMatrix * mvPosition;', '#endif',
        '#ifdef USE_INSTANCING', 'mvPosition = instanceMatrix * mvPosition;', '#endif',
        'vec4 bentWorld = modelMatrix * mvPosition;',
        ...(see ? ['vSeeHeight = bentWorld.y;'] : []),
        'float dzc = bentWorld.z - uFocus.z;',
        'bentWorld.y -= dzc * dzc * uCurve;',
        'mvPosition = viewMatrix * bentWorld;',
        'gl_Position = projectionMatrix * mvPosition;',
        ...(see ? ['vSeeDepth = -mvPosition.z;'] : [])].join('\n'));
    if (!see) return;
    shader.uniforms.uSee = seeThrough.uSee;
    shader.uniforms.uSeeDepth = seeThrough.uSeeDepth;
    shader.uniforms.uNearFade = seeThrough.uNearFade;
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uSee;\nuniform float uSeeDepth;\nuniform vec2 uNearFade;\nvarying float vSeeDepth;\nvarying float vSeeHeight;\n#define SEE_FROM 0.55\n#define SEE_FULL 0.95')
      .replace('#include <clipping_planes_fragment>', [
        '#include <clipping_planes_fragment>',
        // Only what could hide the hero opens up: nothing below knee height (logs, bushes, beds stay solid).
        'float seeHole = (uSee.z > 0.0 && vSeeDepth < uSeeDepth - 0.5) ? (1.0 - smoothstep(0.55, 1.0, length(gl_FragCoord.xy - uSee.xy) / uSee.z)) * smoothstep(SEE_FROM, SEE_FULL, vSeeHeight) : 0.0;',
        'float seeCut = max(seeHole, 1.0 - smoothstep(uNearFade.x, uNearFade.y, vSeeDepth));',
        // 2×2 ordered dither: at full strength three of four pixels drop out, close to the 2D tree alpha of .38.
        'if (seeCut > 0.0 && mod(floor(gl_FragCoord.x) + 2.0 * floor(gl_FragCoord.y), 4.0) / 4.0 + 0.125 < seeCut * 0.85) discard;'].join('\n'));
  };
  // Bent and see-through variants must not share a compiled program.
  material.customProgramCacheKey = () => see ? 'curve-see' : 'curve';
  return material;
}
// Re-bends a material with see-through on (for trees and tall stand-ins).
export const seeing = <T extends Material>(material: T) => curvify(material, {seeThrough: true});

// Day and night palettes from the v7 scene; the renderer blends them by nightStrength.
export type Palette = {sky: [string, string, string, string]; fog: string; hemi: [string, string, number]; sun: [string, number, [number, number, number]]; water: [string, string, string]; foam: string; tint: string; exposure: number; bloom: [number, number]};
export const DAY: Palette = {sky: ['#4fb0f0', '#9bd6fb', '#d8f1ff', '#e9f7ff'], fog: '#d6effd', hemi: ['#d2ecff', '#ead8a8', 1.75], sun: ['#fff2dc', 2.9, [-9, 16, 10]], water: ['#7fe0d6', '#33b2d6', '#1d7fc0'], foam: '#ffffff', tint: '#ffffff', exposure: 1.05, bloom: [.18, .92]};
export const NIGHT: Palette = {sky: ['#050b20', '#0c1a42', '#1f3166', '#2c4076'], fog: '#1a2650', hemi: ['#3c528f', '#1a1f33', .6], sun: ['#aac0ff', .8, [10, 14, -6]], water: ['#2c5a84', '#1d3c6c', '#122850'], foam: '#6f86bd', tint: '#7d8bc2', exposure: 1.12, bloom: [.6, .55]};
// Ground colours (v7 ground mesh), one per surface kind plus the sea floor ramp.
export const GROUND = {sand: '#f2e3b4', wetSand: '#d6bd88', grassA: '#68b648', grassB: '#8fd464', dirt: '#d8b47e', stone: '#c9c2b2', seaFloor: '#e7d6a4', deepFloor: '#b9a679'} as const;

export const std = (color: string, extra: MeshStandardMaterialParameters = {}) => curvify(new MeshStandardMaterial({color, roughness: .85, metalness: 0, ...extra}));
const toonRamp = new DataTexture(new Uint8Array([74, 150, 255]), 3, 1, RedFormat);
toonRamp.minFilter = toonRamp.magFilter = NearestFilter;
toonRamp.needsUpdate = true;
// Three light bands (0.29 / 0.59 / 1.0) for the broadleaf canopies.
export const toon = (color: string, extra: MeshToonMaterialParameters = {}) => curvify(new MeshToonMaterial({color, gradientMap: toonRamp, ...extra}));

// Small deterministic random source so the island looks the same on every load.
export function mulberry(seed: number) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const hash = (x: number, y: number) => { const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return n - Math.floor(n); };
// Smooth value noise in [0, 1].
export function noise2(x: number, y: number) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy, sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
  const a = hash(ix, iy), b = hash(ix + 1, iy), c = hash(ix, iy + 1), d = hash(ix + 1, iy + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
export const noise3 = (x: number, y: number, z: number) => (noise2(x + z * 1.7, y) + noise2(x, y + z * 2.3)) / 2;

// Tiling sRGB texture drawn on a canvas; browser only.
export function canvasTexture(size: number, draw: (g: CanvasRenderingContext2D, size: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}
// Speckles and grass ticks multiplied over the ground colours (v7 groundTex).
export const groundDetailTexture = () => canvasTexture(512, (g, s) => {
  g.fillStyle = '#fff'; g.fillRect(0, 0, s, s);
  const r = mulberry(2);
  for (let i = 0; i < 9000; i++) { g.fillStyle = r() < .5 ? 'rgba(150,130,90,.16)' : 'rgba(255,255,255,.5)'; g.fillRect(r() * s, r() * s, 1 + r() * 1.5, 1 + r() * 1.5); }
  for (let i = 0; i < 700; i++) { const x = r() * s, y = r() * s; g.strokeStyle = 'rgba(40,90,30,.13)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(x - 3, y - 4); g.lineTo(x, y); g.lineTo(x + 3, y - 5); g.stroke(); }
});
// Overlapping leaves for broadleaf canopies (v7 bigLeafTex).
export const leafTexture = () => canvasTexture(512, (g, sz) => {
  g.fillStyle = '#3a8434'; g.fillRect(0, 0, sz, sz);
  const r = mulberry(29);
  for (let row = -1; row < 12; row++) for (let col = -1; col < 10; col++) {
    const x = col * 58 + (row % 2) * 29 + (r() - .5) * 10, y = row * 46 + (r() - .5) * 8, w = 44 + r() * 14, h = w * 1.02;
    const gr = g.createLinearGradient(x - w * .5, y - h * .6, x + w * .4, y + h * .45);
    gr.addColorStop(0, '#9ade6e'); gr.addColorStop(.5, '#62b44c'); gr.addColorStop(1, '#3b8434');
    g.fillStyle = gr; g.strokeStyle = 'rgba(24,62,22,.85)'; g.lineWidth = 3.2; g.beginPath(); g.moveTo(x, y - h * .6);
    g.bezierCurveTo(x + w * .66, y - h * .34, x + w * .5, y + h * .32, x, y + h * .47);
    g.bezierCurveTo(x - w * .5, y + h * .32, x - w * .66, y - h * .34, x, y - h * .6);
    g.fill(); g.stroke();
    g.strokeStyle = 'rgba(36,88,32,.6)'; g.lineWidth = 1.8; g.beginPath(); g.moveTo(x, y - h * .48); g.lineTo(x, y + h * .36); g.stroke();
  }
});
// Lumpy sphere from the v7 scene: icosphere pushed in and out by noise.
export function lumpy(radius: number, detail: number, amount: number, seed: number) {
  let geometry: BufferGeometry = new IcosahedronGeometry(radius, detail);
  geometry.deleteAttribute('normal');
  geometry = mergeVertices(geometry);
  const p = geometry.attributes.position, v = new Vector3();
  for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i); v.multiplyScalar(1 + (noise3(v.x * 2.1 + seed, v.y * 2.1, v.z * 2.1) - .5) * amount); p.setXYZ(i, v.x, v.y, v.z); }
  geometry.computeVertexNormals();
  return geometry;
}
