// Where props stand: the model for every target (by kind and state) and the fixed decorations around the camp and
// the first beach. Pure data in game pixels; props-scene3d.ts builds, bakes and batches it.
import type {Group} from 'three';
import {shore, type Landmark, type World} from '../shared';
import {life} from '../island-life';
import {resourceRules} from '../resources';
import {groundKind} from './ground3d';
import * as P from './props3d';
import * as I from './items3d';

// scale: uniform or [x, y, z]; arg: model option (colour, length, item …); spent: used-up resource (drawn smaller, darker).
// from: the stand-in collision shape a terrain model draws.
export type Placement = {model: string; x: number; y: number; turn?: number; scale?: number | readonly [number, number, number]; arg?: string; spent?: boolean; from?: string};

const num = (a: string | undefined, fallback: number) => a === undefined || a === '' || Number.isNaN(Number(a)) ? fallback : Number(a);
export const MODELS: Record<string, (arg?: string) => Group> = {
  tent: () => P.tent(), cottage: () => P.cottage(), campfire: () => P.campfire(), bench: () => P.logBench(), stump: () => P.stump(),
  barrel: () => P.barrel(), bucket: () => P.bucket(), firewood: () => P.firewood(), backpack: () => P.backpack(), museum: () => P.museum(),
  parasol: () => P.parasol(), lounger: a => P.lounger(a ?? '#3ea7b8'), torch: () => P.tikiTorch(), pier: a => P.pier(num(a, 6)),
  workbench: () => P.workbench(), board: () => P.board(), stall: () => P.stall(), arch: () => P.jungleArch(), cave: () => P.caveMouth(), clothesline: a => P.clothesline(num(a, 2.6)),
  bush: a => { const [c, seed] = (a ?? '').split('|'); return P.bush(c === 'none' ? null : c || '#e8402f', num(seed, 1)); },
  flowers: a => { const [c, n, seed] = (a ?? '').split('|'); return P.flowerPatch(c || '#e8402f', num(n, 8), num(seed, 1)); },
  stepStone: a => P.steppingStone(num(a, 1)), starfish: () => I.starfish(), shell: a => I.shellItem(a),
  branch: a => I.branch(num(a, 1)), coconuts: () => I.coconuts(), grass: a => I.grassClump(num(a, 1)), bottle: () => I.bottle(),
  xmark: () => I.digMark(), sandMound: () => I.mound('sand'), soilMound: () => I.mound('soil'), rockPool: () => I.rockPool(), reef: a => I.reef(num(a, 1)), bubbles: () => I.bubbles(),
  bed: a => { const [stage, flower, wet] = (a ?? '-1|hibiscus|dry').split('|'); return I.gardenBed(num(stage, -1), flower, wet === 'wet'); },
  flag: a => I.campFlag(a ?? '#719e79'),
  rock: a => P.rock(1, num(a, 1)), boulder: a => { const [seed, moss] = (a ?? '').split('|'); return P.boulder(num(seed, 1), moss === 'moss'); }, fern: a => I.fern(num(a, 1)), log: a => I.driftLog(num(a, 2.2)), plant: a => I.tropicalPlant(num(a, 1)),
};
// Models that stand in the sea on purpose.
export const SEA_MODELS = new Set(['pier', 'reef', 'bubbles']);

export type Layer = 'prop' | 'flora' | 'actor' | 'critter' | 'fruit';
const PROP_KINDS = ['camp', 'workbench', 'board', 'bag', 'rain', 'museum', 'shop', 'jungle', 'cave', 'dig', 'buried', 'worm', 'wood', 'fiber', 'coconut', 'fishing', 'reef-fishing', 'shrimp', 'dive', 'shell', 'plot', 'message'];
const LAYERS: Record<string, Layer> = {tree: 'flora', stone: 'flora', animal: 'actor', monster: 'actor', friend: 'actor', bug: 'critter', fruit: 'fruit', ...Object.fromEntries(PROP_KINDS.map(k => [k, 'prop' as const]))};
// Which 3D layer draws a target kind (undefined: nothing would draw it).
export const drawnBy = (kind: string): Layer | undefined => LAYERS[kind];

// 2D camp flag colours (scene.ts drawFire), picked with w.campColor.
const CAMP_COLORS = ['#719e79', '#e5ac60', '#799dc6', '#ca7d73'];
const seedOf = (id: string) => ([...id].reduce((h, c) => h * 31 + c.charCodeAt(0) | 0, 7) >>> 0) % 1000;

// Targets whose props change often (picked up, regrown, dug, planted): batched apart from buildings and decorations so
// a change re-merges only them. Buildings and fixed spots (rain barrel, pier …) are never drawn as used up.
export const VOLATILE_KINDS = new Set(['dig', 'buried', 'worm', 'wood', 'fiber', 'coconut', 'dive', 'shell', 'plot', 'message']);

export function targetPlacements(t: Landmark, w: World): Placement[] {
  const spent = VOLATILE_KINDS.has(t.kind) && t.id in resourceRules && !(w.resources[t.id] > 0), at = (model: string, dx = 0, dy = 0, more: Partial<Placement> = {}): Placement => ({model, x: t.x + dx, y: t.y + dy, ...(spent ? {spent} : {}), ...more});
  switch (t.kind) {
    // Tent (or cottage) over the camp shape, east of the workbench, south of the stall and the rain barrel; the fire at
    // the 2D fire spot in front of it; the flag where 2D draws it.
    case 'camp': return w.house?.built
      ? [at('cottage', 30, -55, {scale: .62}), at('flag', 108, 8, {arg: CAMP_COLORS[w.campColor ?? 0]})]
      : [at('tent', 46, -58, {scale: [.74, .9, .68], turn: -.12}), at('campfire', -14, 8, {scale: .72}), at('flag', 108, 8, {arg: CAMP_COLORS[w.campColor ?? 0]})];
    // The workbench's collision strip is only 25 px deep, so the table is narrower front to back than v7's.
    case 'workbench': return [at('workbench', 0, -11, {scale: [.8, .8, .45]})];
    case 'board': return [at('board', 0, -10)];
    case 'bag': return [at('backpack', 0, -6, {turn: .4})];
    case 'rain': return t.id === 'rain' ? [at('barrel', 0, -10), at('bucket', 42, 16)] : [at('bucket', 30, 12)];
    case 'museum': return [at('museum', 0, -80, {scale: .68})];
    case 'shop': return [at('stall', 0, -36, {scale: .9})];
    case 'jungle': return [at('arch')];
    case 'cave': return [at('cave', 0, -20)];
    case 'dig': return [at(groundKind(t.x, t.y) === 'grass' ? 'soilMound' : 'sandMound')];
    case 'buried': return [at('xmark')];
    case 'worm': return [at('soilMound')];
    case 'wood': return [at('branch', 0, 0, {turn: seedOf(t.id) % 6, arg: String(seedOf(t.id) % 9)})];
    case 'fiber': return [at('grass', 0, 0, {arg: String(seedOf(t.id) % 9)})];
    case 'coconut': return [at('coconuts')];
    // The pier starts on the sand just inland of the fishing spot and runs out to sea (−x).
    case 'fishing': return [{model: 'pier', x: Math.max(t.x + 12, shore(t.y) + 40), y: t.y + 18, arg: t.id === 'fishing' ? '6.4' : '4.8'}];
    case 'reef-fishing': return [{model: 'reef', x: shore(t.y) - 46, y: t.y + 6, arg: '3'}];
    case 'shrimp': return [at('rockPool')];
    case 'dive': return [at('bubbles')];
    case 'shell': return [at('shell', 0, 0, {arg: life(w).shells[t.id]?.item, turn: seedOf(t.id) % 6})];
    case 'plot': { const plot = life(w).plots[Number(t.id.split('-')[1])]; return [at('bed', 0, 0, {arg: `${plot?.stage ?? -1}|${plot?.flower ?? 'hibiscus'}|${plot?.wet ? 'wet' : 'dry'}`})]; }
    case 'message': return [at('bottle', 0, 0, {turn: .6})];
    default: return [];
  }
}

// Fixed decorations in game pixels (v7 vocabulary): lounge corner under the ridge, camp extras, pier torches,
// path stones to the museum, flower bushes and patches on the grass edge, starfish on the sand.
export function decorPlacements(): Placement[] {
  const pierY = 628, beside = (y: number, dx: number) => shore(y) + dx;
  return [
    {model: 'parasol', x: 958, y: 432}, {model: 'lounger', x: 922, y: 458, turn: 1.3, arg: '#3ea7b8'}, {model: 'lounger', x: 992, y: 474, turn: 1.22, arg: '#f2f0e8'},
    {model: 'clothesline', x: 1062, y: 482, turn: -.5, arg: '2.4'},
    {model: 'stump', x: 1338, y: 652, scale: .8},
    {model: 'torch', x: beside(pierY - 66, 22), y: pierY - 66}, {model: 'torch', x: beside(pierY + 50, 70), y: pierY + 50},
    {model: 'torch', x: 1238, y: 378}, {model: 'torch', x: 1402, y: 378},
    {model: 'stepStone', x: 1396, y: 700, arg: '1'}, {model: 'stepStone', x: 1440, y: 708, arg: '2'}, {model: 'stepStone', x: 1486, y: 702, arg: '3'}, {model: 'stepStone', x: 1530, y: 692, arg: '4'}, {model: 'stepStone', x: 1574, y: 702, arg: '5'},
    {model: 'bush', x: 1398, y: 602, arg: '#e8402f|21'}, {model: 'bush', x: 1546, y: 762, arg: '#ff7fae|22'}, {model: 'bush', x: 1742, y: 612, arg: '#e8402f|23'}, {model: 'bush', x: 1236, y: 400, arg: 'none|24', scale: .9},
    {model: 'flowers', x: 1458, y: 742, arg: '#e8402f|9|31'}, {model: 'flowers', x: 1562, y: 832, arg: '#ffd23f|8|32'}, {model: 'flowers', x: 1662, y: 722, arg: '#ffffff|8|33'},
    {model: 'flowers', x: 1196, y: 396, arg: '#ff8fbf|7|34'}, {model: 'flowers', x: 1458, y: 598, arg: '#ff8a3d|7|35'},
    {model: 'flowers', x: 1700, y: 690, arg: '#ff8fbf|8|36'}, {model: 'bush', x: 1290, y: 392, arg: '#ffd23f|25', scale: .8},
    {model: 'bucket', x: 842, y: 560, turn: .4}, {model: 'shell', x: 1098, y: 908, arg: 'conch', turn: .5},
    {model: 'starfish', x: 956, y: 602}, {model: 'starfish', x: 1012, y: 862}, {model: 'shell', x: 1042, y: 832, arg: 'scallop', turn: 1.2}, {model: 'shell', x: 978, y: 520, arg: 'scallop', turn: -.6},
  ];
}
