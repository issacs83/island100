// Small game items in the v7 look: what lies on the ground at a target (drift branch, coconuts, shells, bottle, dig
// marks …), sea spots (coral, ring buoy, bubbles), the garden beds and the camp flag. Same frame as props3d builders.
import {BoxGeometry, CircleGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, type BufferGeometry, type Material} from 'three';
import {lumpy, mulberry} from './look';
import {paint} from './paint3d';
import {hibiscus, shell, starfish} from './props3d';
import {frond} from './flora3d';

const add = (g: Group, geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); g.add(m); return m; };
const bark = () => paint('#ffffff', {map: 'bark', roughness: .9});

// A sun-bleached drift branch with a fork and a leaf tuft (떠밀려 온 나뭇가지).
export function branch(seed = 1) {
  const g = new Group(), r = mulberry(seed);
  add(g, new CylinderGeometry(.07, .09, 1.1, 8), bark(), 0, .08, 0).rotation.set(0, 0, Math.PI / 2 + .05);
  add(g, new CylinderGeometry(.04, .05, .5, 6), bark(), .2, .1, .14).rotation.set(Math.PI / 2, 0, .9);
  add(g, new CylinderGeometry(.05, .06, .7, 7), bark(), -.25, .07, -.12).rotation.set(0, .6, Math.PI / 2);
  for (let i = 0; i < 3; i++) add(g, new SphereGeometry(.09, 6, 4), paint('#6aa84a'), .52 + r() * .08, .12, .05 + i * .07).scale.set(1.4, .35, .7);
  return g;
}
export function coconuts() {
  const g = new Group(), m = paint('#7f5a34', {roughness: .7});
  for (const [x, z] of [[0, 0], [.22, .1], [.08, .24]]) add(g, new SphereGeometry(.15, 12, 10), m, x, .14, z);
  add(g, new SphereGeometry(.15, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint('#f4ecd8'), -.25, .02, .12).rotation.x = Math.PI;
  return g;
}
// A clump of tall grass to pull (튼튼한 풀줄기).
export function grassClump(seed = 1) {
  const g = new Group(), r = mulberry(seed), m = paint('#6fae46', {roughness: .9}), tip = paint('#a8d36a', {roughness: .9});
  for (let i = 0; i < 14; i++) {
    const a = r() * Math.PI * 2, d = r() * .16, h = .55 + r() * .4;
    const blade = add(g, new ConeGeometry(.04, h, 4), i % 3 ? m : tip, Math.cos(a) * d, h / 2, Math.sin(a) * d);
    blade.rotation.set(Math.sin(a) * (.2 + r() * .3), 0, -Math.cos(a) * (.2 + r() * .3));
  }
  return g;
}
export function bottle() {
  const g = new Group(), glass = paint('#9be7f0', {roughness: .1, opacity: .75});
  add(g, new CylinderGeometry(.09, .09, .3, 12), glass, 0, .09, 0).rotation.z = Math.PI / 2;
  add(g, new CylinderGeometry(.04, .06, .12, 10), glass, .2, .09, 0).rotation.z = Math.PI / 2;
  add(g, new CylinderGeometry(.035, .035, .05, 8), paint('#a8743f'), .28, .09, 0).rotation.z = Math.PI / 2;
  add(g, new CylinderGeometry(.05, .05, .2, 8), paint('#fff4d8'), -.02, .09, 0).rotation.z = Math.PI / 2;
  return g;
}
// The daily X mark: two dark cracks in the ground (수상한 X 표시).
export function digMark() {
  const g = new Group(), m = paint('#7a5a3a', {roughness: 1});
  for (const a of [.75, -.75]) add(g, new BoxGeometry(.62, .025, .09), m, 0, .015, 0).rotation.y = a;
  return g;
}
// Soft sand with a few shell bits (dig spot) or dark soil with a twig (worm spot).
export function mound(kind: 'sand' | 'soil') {
  const g = new Group(), sand = kind === 'sand';
  add(g, new SphereGeometry(.42, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), paint(sand ? '#ead6a2' : '#7b5a3c', {roughness: 1}), 0, 0, 0).scale.set(1, .3, .85);
  if (sand) for (const [x, z, c] of [[.15, .1, '#f8c9d8'], [-.18, .05, '#fbe3c4']] as [number, number, string][]) { const s = shell(c, x * 9); s.position.set(x, .08, z); s.scale.setScalar(.7); g.add(s); }
  else add(g, new CylinderGeometry(.015, .02, .35, 5), bark(), .1, .14, 0).rotation.z = 1.1;
  return g;
}
export function rockPool() {
  const g = new Group(), stone = paint('#a39e95', {roughness: .95});
  for (let i = 0; i < 8; i++) { const a = i / 8 * Math.PI * 2; add(g, lumpy(.16, 1, .3, i + 20), stone, Math.cos(a) * .45, .06, Math.sin(a) * .35).scale.set(1.2, .6, 1); }
  const w = add(g, new CircleGeometry(.4, 18), paint('#5fc4e0', {roughness: .15}), 0, .05, 0);
  w.rotation.x = -Math.PI / 2; w.scale.set(1, .8, 1);
  return g;
}
// Coral heads and a flat fishing rock at the reef edge.
export function reef(seed = 1) {
  const g = new Group(), r = mulberry(seed), colors = ['#ff8fa3', '#ffb36b', '#f46f8e', '#ffd27a'];
  add(g, lumpy(.55, 2, .3, seed + 60), paint('#b9b3a8', {roughness: .95}), 0, .05, 0).scale.set(1.3, .35, 1);
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2, d = .8 + r() * .5, c = paint(colors[i % 4], {roughness: .6}), x = Math.cos(a) * d, z = Math.sin(a) * d;
    add(g, new CylinderGeometry(.05, .08, .4, 6), c, x, -.05, z).rotation.z = (r() - .5) * .6;
    for (let k = 0; k < 3; k++) add(g, new SphereGeometry(.09, 8, 6), c, x + (r() - .5) * .25, .12 + r() * .12, z + (r() - .5) * .2);
  }
  return g;
}
export function bubbles() {
  const g = new Group(), m = paint('#e8fbff', {roughness: .1, opacity: .7});
  for (const [x, y, z, r] of [[0, .1, 0, .16], [.22, .25, .1, .1], [-.15, .35, -.05, .08], [.05, .5, .12, .06]]) add(g, new SphereGeometry(r, 12, 10), m, x, y, z);
  const ring = add(g, new TorusGeometry(.32, .09, 10, 24), paint('#ff7a45', {roughness: .5}), .75, .05, .2);
  ring.rotation.x = Math.PI / 2;
  for (let i = 0; i < 4; i++) add(g, new TorusGeometry(.32, .095, 10, 4, Math.PI / 8), paint('#ffffff', {roughness: .5}), .75, .05, .2).rotation.set(Math.PI / 2, 0, i * Math.PI / 2);
  return g;
}
export function conch() {
  const g = new Group(), m = paint('#f3c9a6', {roughness: .5});
  const body = add(g, new ConeGeometry(.12, .34, 10), m, 0, .1, 0);
  body.rotation.z = Math.PI / 2 + .15;
  for (let i = 0; i < 3; i++) add(g, new TorusGeometry(.1 - i * .025, .025, 6, 14), paint('#e8a98a'), -.06 + i * .07, .1, 0).rotation.y = Math.PI / 2;
  add(g, new SphereGeometry(.09, 8, 6), paint('#ffd9d2', {roughness: .4}), -.13, .08, .03).scale.set(.6, .7, 1);
  return g;
}
export function sandDollar() {
  const g = new Group();
  add(g, new CylinderGeometry(.16, .16, .03, 18), paint('#efe2c4', {roughness: .8}), 0, .02, 0);
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? .03 : .1; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  add(g, new ShapeGeometry(s), paint('#cdb88f', {roughness: .8}), 0, .037, 0).rotation.x = -Math.PI / 2;
  return g;
}
export function coralPiece() {
  const g = new Group(), m = paint('#ff8fa3', {roughness: .6});
  add(g, new CylinderGeometry(.03, .05, .22, 6), m, 0, .11, 0);
  for (const [x, z, a] of [[.07, 0, -.6], [-.06, .03, .7], [0, -.06, .3]]) add(g, new CylinderGeometry(.02, .03, .16, 5), m, x, .2, z).rotation.z = a;
  return g;
}
export function shellItem(item: string | undefined) {
  if (item === 'conch') return conch();
  if (item === 'sandDollar') return sandDollar();
  if (item === 'coral') return coralPiece();
  return shell('#f6b7a8');
}
// The camp flag beside the tent, in the camp colour the players picked (2D drawFire flag).
export function campFlag(color: string) {
  const g = new Group();
  add(g, new CylinderGeometry(.035, .045, 1.75, 8), bark(), 0, .87, 0);
  add(g, new SphereGeometry(.06, 8, 6), paint('#f2cf6a', {roughness: .3}), 0, 1.78, 0);
  const s = new Shape(); s.moveTo(0, 0); s.quadraticCurveTo(.35, -.05, .62, -.2); s.lineTo(0, -.42); s.closePath();
  add(g, new ExtrudeGeometry(s, {depth: .02, bevelEnabled: false}), paint(color, {roughness: .8}), .02, 1.72, 0);
  return g;
}
const FLOWER: Record<string, string> = {hibiscus: '#e8402f', plumeria: '#fff4d6', pinkHibiscus: '#ff8fbf'};
// A garden bed: soil in a log frame; sprouts, buds, then three flowers as the stage grows (−1 = empty).
export function gardenBed(stage: number, flower: string, wet: boolean) {
  const g = new Group(), frame = bark();
  add(g, new BoxGeometry(.78, .08, .62), paint(wet ? '#5e4330' : '#86613f', {roughness: 1}), 0, .05, 0);
  for (const [x, z, w, d] of [[0, -.33, .9, .08], [0, .33, .9, .08], [-.43, 0, .08, .62], [.43, 0, .08, .62]]) add(g, new BoxGeometry(w, .14, d), frame, x, .07, z);
  const spots = [[-.2, -.12], [.18, -.1], [0, .14]];
  if (stage === 0) for (const [x, z] of spots) add(g, new SphereGeometry(.05, 6, 4), paint('#8fd464'), x, .12, z).scale.set(1.3, .5, .8);
  if (stage === 1 || stage === 2) for (const [x, z] of spots) {
    add(g, new CylinderGeometry(.012, .016, .18 + stage * .08, 5), paint('#4e9a3a'), x, .18, z);
    for (const s of [-1, 1]) add(g, new SphereGeometry(.06, 6, 4), paint('#5fae45'), x + s * .05, .14, z).scale.set(1.3, .3, .6);
    if (stage === 2) add(g, new SphereGeometry(.045, 6, 5), paint(FLOWER[flower] ?? FLOWER.hibiscus), x, .32, z).scale.set(.8, 1.2, .8);
  }
  if (stage >= 3) for (const [x, z] of spots) { const f = hibiscus(FLOWER[flower] ?? FLOWER.hibiscus, 1.15); f.position.set(x, .06, z); f.rotation.y = x * 7; g.add(f); }
  return g;
}
// A low fern: a rosette of small serrated fronds (palm frond shape, v7 colours).
export function fern(seed = 1) {
  const g = new Group(), r = mulberry(seed), m = paint('#ffffff', {double: true, roughness: .7});
  for (let k = 0; k < 7; k++) { const f = add(g, frond(.85 + r() * .25, .34, .42 + r() * .15), m, 0, .04, 0); f.rotation.set(0, k / 7 * Math.PI * 2 + r() * .4, .55 + r() * .3, 'YZX'); }
  return g;
}
// A sun-bleached drift log half sunk in the sand, with ring ends and a broken branch stub.
export function driftLog(length = 2.2) {
  const g = new Group(), rings = paint('#ffffff', {map: 'ring', roughness: .9});
  add(g, new CylinderGeometry(.26, .29, length, 14), bark(), 0, .2, 0).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) add(g, new CircleGeometry(.26, 18), rings, s * (length / 2 + .005), .2, 0).rotation.y = s * Math.PI / 2;
  add(g, new CylinderGeometry(.06, .09, .5, 8), bark(), length * .18, .45, .05).rotation.set(.3, 0, -.6);
  return g;
}
// A broad-leaved tropical plant (the big leaves of the 2D jungle foreground): leaves fanning out at several tilts.
export function tropicalPlant(seed = 1) {
  const g = new Group(), r = mulberry(seed), leaf = new Shape();
  leaf.moveTo(0, 0); leaf.bezierCurveTo(.3, .06, .38, .44, 0, .66); leaf.bezierCurveTo(-.38, .44, -.3, .06, 0, 0);
  const geo = new ShapeGeometry(leaf, 6), dark = paint('#3c8a37', {double: true, roughness: .7}), light = paint('#5aad46', {double: true, roughness: .7});
  for (let k = 0; k < 7; k++) {
    const a = k / 7 * Math.PI * 2 + r() * .5, tilt = k === 6 ? 1.25 : .35 + r() * .45, l = add(g, geo, k % 2 ? dark : light, Math.cos(a) * .05, .06, Math.sin(a) * .05);
    l.rotation.set(Math.PI / 2 - tilt, Math.PI / 2 - a, 0, 'YXZ');
    l.scale.setScalar(.9 + r() * .45);
  }
  return g;
}
export {starfish};
