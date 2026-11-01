// Prop looks. Builders paint meshes with paint(colour, look); batch3d moves the colour into vertex colours and draws
// every mesh of one look class with a single shared material, built here on first use (canvas textures need a DOM).
import {CanvasTexture, Color, DoubleSide, MeshBasicMaterial, MeshStandardMaterial, SRGBColorSpace, type Material, type MeshStandardMaterialParameters, type Texture} from 'three';
import {canvasTexture, mulberry, seeing} from './look';

// map: a TEXTURES name or 'sign:<text>'; night: emissive colour the look glows with after dark (windows, lanterns).
export type Look = {map?: string; roughness?: number; metalness?: number; double?: boolean; emissive?: string; glow?: number; opacity?: number; night?: string};
export type Paint = {color: string; look: Look};

const specs = new Map<string, Material>();
// A cheap stand-in material that only carries the paint; never rendered directly.
export function paint(color: string, look: Look = {}): Material {
  const key = color + JSON.stringify(look);
  let m = specs.get(key);
  if (!m) { m = new MeshBasicMaterial(); m.userData.paint = {color, look} satisfies Paint; specs.set(key, m); }
  return m;
}
export const paintOf = (m: Material): Paint | undefined => m.userData.paint;

// Looks are bucketed so near-identical ones share a class (one draw call each): glossy or matte, no metalness,
// one translucency.
const bucket = (v: number, edges: readonly number[], values: readonly number[]) => { const i = edges.findIndex(e => v < e); return values[i < 0 ? values.length - 1 : i]; };
export function classLook(look: Look): Look {
  const out: Look = {roughness: bucket(look.roughness ?? .85, [.45], [.3, .9])};
  if (look.map) out.map = look.map;
  if (look.double) out.double = true;
  if (look.emissive) { out.emissive = look.emissive; out.glow = look.glow ?? 1; }
  if (look.opacity !== undefined) out.opacity = .75;
  if (look.night) out.night = look.night;
  return out;
}
export const classKey = (look: Look) => JSON.stringify(classLook(look));

const repeat = (t: Texture, n: number) => { t.repeat.set(n, n); return t; };
const siding = (base: string, line: string) => () => canvasTexture(256, (g, sz) => { g.fillStyle = base; g.fillRect(0, 0, sz, sz); for (let y = 0; y < sz; y += 26) { g.fillStyle = line; g.fillRect(0, y + 22, sz, 4); g.fillStyle = 'rgba(255,255,255,.28)'; g.fillRect(0, y, sz, 3); } });
const roof = (base: string, light: string, dark: string) => () => repeat(canvasTexture(256, (g, sz) => { g.fillStyle = base; g.fillRect(0, 0, sz, sz); for (let row = 0; row < 9; row++) for (let col = -1; col < 9; col++) { const x = col * 32 + (row % 2) * 16, y = row * 30; g.fillStyle = row % 2 ? light : base; g.strokeStyle = dark; g.lineWidth = 2; g.beginPath(); g.arc(x + 16, y, 16, 0, Math.PI); g.fill(); g.stroke(); } }), 2);
// Canvas textures from the v7 scene (plus awning, strata and signs).
const TEXTURES: Record<string, () => Texture> = {
  bark: () => canvasTexture(128, (g, s) => { g.fillStyle = '#9a6a42'; g.fillRect(0, 0, s, s); const r = mulberry(4); for (let i = 0; i < 40; i++) { g.strokeStyle = r() < .5 ? 'rgba(70,42,22,.45)' : 'rgba(200,160,110,.35)'; g.lineWidth = 1 + r() * 2; const x = r() * s; g.beginPath(); g.moveTo(x, 0); g.bezierCurveTo(x + 4, s * .3, x - 4, s * .6, x + 2, s); g.stroke(); } }),
  ring: () => canvasTexture(128, (g, s) => { g.fillStyle = '#e2bb85'; g.fillRect(0, 0, s, s); for (let r = 6; r < 64; r += 7) { g.strokeStyle = r % 2 ? 'rgba(160,110,60,.55)' : 'rgba(190,140,85,.45)'; g.lineWidth = 2; g.beginPath(); g.arc(64, 64, r, 0, Math.PI * 2); g.stroke(); } g.strokeStyle = '#8a5a34'; g.lineWidth = 7; g.beginPath(); g.arc(64, 64, 61, 0, Math.PI * 2); g.stroke(); }),
  leaf: () => repeat(canvasTexture(256, (g, s) => { g.fillStyle = '#4f9d40'; g.fillRect(0, 0, s, s); const r = mulberry(3); for (let i = 0; i < 420; i++) { const x = r() * s, y = r() * s, w = 11 + r() * 9; g.save(); g.translate(x, y); g.rotate(r() * .7 - .35); g.fillStyle = ['#4a973c', '#5cad48', '#6abd53', '#428a35', '#76c75b'][i % 5]; g.strokeStyle = 'rgba(30,72,28,.6)'; g.lineWidth = 1.4; g.beginPath(); g.moveTo(-w * .6, 0); g.quadraticCurveTo(0, -w * .95, w * .6, 0); g.quadraticCurveTo(0, w * .35, -w * .6, 0); g.fill(); g.stroke(); g.restore(); } }), 2),
  plank: () => canvasTexture(256, (g, s) => { g.fillStyle = '#f2d6a6'; g.fillRect(0, 0, s, s); for (let y = 0; y < s; y += 32) { g.fillStyle = (y / 32) % 2 ? 'rgba(200,150,95,.18)' : 'rgba(255,255,255,.12)'; g.fillRect(0, y, s, 32); g.strokeStyle = 'rgba(150,100,60,.55)'; g.lineWidth = 2; g.beginPath(); g.moveTo(0, y); g.lineTo(s, y); g.stroke(); } }),
  shingle: roof('#3c9ea3', '#48aeb2', 'rgba(25,80,85,.6)'),
  tent: () => canvasTexture(256, (g, sz) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, sz, sz); for (let x = 0; x < sz; x += 64) { g.fillStyle = 'rgba(40,70,30,.3)'; g.fillRect(x, 0, 4, sz); g.fillStyle = 'rgba(255,255,255,.4)'; g.fillRect(x + 4, 0, 3, sz); } for (let i = 0; i < sz; i += 4) { g.fillStyle = 'rgba(60,90,40,.06)'; g.fillRect(i, 0, 2, sz); g.fillRect(0, i, sz, 2); } }),
  thatch: () => canvasTexture(256, (g, sz) => { g.fillStyle = '#d6b066'; g.fillRect(0, 0, sz, sz); const r = mulberry(23); for (let i = 0; i < 1100; i++) { const x = r() * sz, y = r() * sz, len = 16 + r() * 30; g.strokeStyle = ['#c79e55', '#e8cb85', '#b68a47', '#f2d996'][i % 4]; g.lineWidth = 1.2 + r() * 1.4; g.beginPath(); g.moveTo(x, y); g.lineTo(x + (r() - .5) * 4, y + len); g.stroke(); } for (let y = 0; y < sz; y += 40) { g.fillStyle = 'rgba(105,75,38,.35)'; g.fillRect(0, y, sz, 3); } }),
  deck: () => canvasTexture(256, (g, sz) => { for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#b98552' : '#c99766'; g.fillRect(0, i * 32, sz, 32); g.fillStyle = 'rgba(58,34,18,.7)'; g.fillRect(0, i * 32 + 29, sz, 3); g.strokeStyle = 'rgba(120,80,45,.32)'; g.lineWidth = 1; for (let k = 0; k < 5; k++) { const yy = i * 32 + 5 + k * 5; g.beginPath(); g.moveTo(0, yy); g.bezierCurveTo(sz * .3, yy + 2, sz * .6, yy - 2, sz, yy + 1); g.stroke(); } } }),
  'siding-white': siding('#f8f4ea', 'rgba(170,160,140,.4)'),
  'roof-red': roof('#d9503f', '#e86a55', '#9c2f2a'),
  awning: () => canvasTexture(256, (g, sz) => { for (let x = 0; x < sz; x += 32) { g.fillStyle = (x / 32) % 2 ? '#fff4e2' : '#f05a4a'; g.fillRect(x, 0, 32, sz); } }),
  white: () => canvasTexture(4, (g, s) => { g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s); }),
  // Boulder skin: white base (tinted by the paint colour) with speckles, pits and a few hairline cracks.
  stone: () => canvasTexture(256, (g, s) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, s, s);
    const r = mulberry(41);
    for (let i = 0; i < 2600; i++) { g.fillStyle = r() < .55 ? `rgba(70,64,56,${.08 + r() * .12})` : `rgba(255,255,255,${.25 + r() * .3})`; g.fillRect(r() * s, r() * s, 1 + r() * 2.5, 1 + r() * 2.5); }
    for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(60,55,48,.14)'; g.beginPath(); g.ellipse(r() * s, r() * s, 3 + r() * 9, 2 + r() * 5, r() * 3, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(55,50,44,.3)'; g.lineWidth = 1.4;
    for (let i = 0; i < 14; i++) { let x = r() * s, y = r() * s; g.beginPath(); g.moveTo(x, y); for (let k = 0; k < 4; k++) { x += (r() - .5) * 30; y += r() * 22; g.lineTo(x, y); } g.stroke(); }
  }),
  // v7 cliff strata: wavy sandstone bands, pits and cracks.
  strata: () => canvasTexture(512, (g, s) => {
    const bands = ['#b48c5e', '#cba777', '#a98257', '#d6b688', '#bb9568', '#9a754d'], r = mulberry(17);
    let y = 0, i = 0;
    while (y < s) { const h = 38 + r() * 52; g.fillStyle = bands[i++ % bands.length]; g.beginPath(); g.moveTo(0, y); for (let x = 0; x <= s; x += 16) g.lineTo(x, y + (r() - .5) * 9); g.lineTo(s, y + h); for (let x = s; x >= 0; x -= 16) g.lineTo(x, y + h + (r() - .5) * 9); g.closePath(); g.fill(); y += h; }
    for (let k = 0; k < 110; k++) { g.fillStyle = r() < .5 ? 'rgba(80,55,30,.25)' : 'rgba(255,240,210,.22)'; g.beginPath(); g.ellipse(r() * s, r() * s, 6 + r() * 14, 3 + r() * 6, 0, 0, Math.PI * 2); g.fill(); }
    g.strokeStyle = 'rgba(70,48,28,.35)'; g.lineWidth = 2; for (let k = 0; k < 44; k++) { const x = r() * s, y0 = r() * s; g.beginPath(); g.moveTo(x, y0); g.lineTo(x + (r() - .5) * 8, y0 + 20 + r() * 30); g.stroke(); }
  }),
};
function signTexture(text: string) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 140;
  const s = c.getContext('2d')!;
  s.fillStyle = '#fff4d8'; s.fillRect(0, 0, 512, 140); s.fillStyle = '#6b3f22';
  s.font = '700 76px "Noto Sans KR","Noto Sans CJK KR",sans-serif'; s.textAlign = 'center'; s.textBaseline = 'middle'; s.fillText(text, 256, 74);
  const t = new CanvasTexture(c); t.colorSpace = SRGBColorSpace;
  return t;
}
const textures = new Map<string, Texture>();
export function texture(name: string) {
  let t = textures.get(name);
  if (!t) { t = name.startsWith('sign:') ? signTexture(name.slice(5)) : TEXTURES[name](); textures.set(name, t); }
  return t;
}

// The shared material for one look class: white base, vertex colours carry each mesh's paint.
export function classMaterial(look: Look): Material {
  const p: MeshStandardMaterialParameters = {vertexColors: true, roughness: look.roughness ?? .9, metalness: look.metalness ?? 0};
  // Untextured classes get a plain white map so every prop class shares one shader variant (fewer shader compiles).
  p.map = texture(look.map ?? 'white');
  if (look.double) p.side = DoubleSide;
  if (look.emissive) { p.emissive = new Color(look.emissive); p.emissiveIntensity = look.glow ?? 1; }
  if (look.opacity !== undefined) { p.transparent = true; p.opacity = look.opacity; }
  // See-through like trees: props in front of the hero dither open around him and fade right in front of the camera.
  const m = seeing(new MeshStandardMaterial({color: '#ffffff', ...p}));
  if (look.night) m.userData.glow = {day: new Color(look.emissive ?? '#000000'), dayIntensity: look.glow ?? 0, night: new Color(look.night)};
  return m;
}
