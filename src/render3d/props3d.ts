// Props in the approved v7 look, ported from design/20261008-3d-art-spike/scene-v7.js, plus a few new ones the game
// needs (workbench, shop stall, jungle arch, cave mouth). Every builder returns a group in its own frame: base on the
// ground at the origin, front toward +z. Meshes carry paint3d looks; props-layout.ts places them, batch3d.ts merges them.
import {BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, PlaneGeometry, SRGBColorSpace, Shape, ShapeGeometry, SphereGeometry, TorusGeometry, Vector3, type BufferGeometry, type Material, type Object3D, type Texture} from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {lumpy, mulberry} from './look';
import {paint} from './paint3d';

const at = <T extends Object3D>(o: T, x: number, y: number, z: number) => { o.position.set(x, y, z); return o; };
const add = (g: Group, geo: BufferGeometry, mat: Material, x = 0, y = 0, z = 0) => { const m = at(new Mesh(geo, mat), x, y, z); g.add(m); return m; };
const wood = () => paint('#ffffff', {map: 'bark', roughness: .9});
// Window glass: faint teal by day, warm light after dark.
export const GLASS = {roughness: .15, emissive: '#2a4a55', glow: .15, night: '#ffc874'} as const;
const rings = () => paint('#ffffff', {map: 'ring', roughness: .9});

export function flower(col: string, s = 1) {
  const g = new Group(), petal = new SphereGeometry(.075, 5, 3), pm = paint(col, {roughness: .6});
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; add(g, petal, pm, Math.cos(a) * .075, .2, Math.sin(a) * .075).scale.set(1, .38, 1); }
  add(g, new SphereGeometry(.045, 4, 3), paint('#ffd23a'), 0, .22, 0);
  for (const a of [.4, 2.5, 4.4]) { const l = add(g, new SphereGeometry(.09, 4, 3), paint('#4e9a3a'), Math.cos(a) * .1, .08, Math.sin(a) * .1); l.scale.set(1.4, .3, .7); l.rotation.y = -a; }
  g.scale.setScalar(s);
  return g;
}
export function hibiscus(col: string, s = 1) {
  const g = new Group(), pm = paint(col, {roughness: .55});
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, p = add(g, new SphereGeometry(.09, 6, 3), pm, Math.cos(a) * .088, .28, Math.sin(a) * .088); p.scale.set(1.3, .3, .82); p.rotation.set(0, -a, .42); }
  add(g, new SphereGeometry(.04, 5, 4), paint('#7a1f2a'), 0, .3, 0);
  add(g, new CylinderGeometry(.008, .008, .15, 5), paint('#ffe36a'), -.01, .37, 0).rotation.z = .3;
  add(g, new SphereGeometry(.022, 6, 4), paint('#ffcf2e'), -.035, .44, 0);
  for (const a of [.3, 2.4, 4.3]) { const l = add(g, new SphereGeometry(.11, 4, 3), paint('#3f8f36'), Math.cos(a) * .13, .12, Math.sin(a) * .13); l.scale.set(1.5, .28, .7); l.rotation.y = -a; }
  g.scale.setScalar(s);
  return g;
}
export function tulip(col: string, s = 1) {
  const g = new Group(), pm = paint(col, {roughness: .5});
  add(g, new CylinderGeometry(.012, .016, .32, 6), paint('#4e9a3a'), 0, .16, 0);
  for (let i = 0; i < 3; i++) { const a = i / 3 * Math.PI * 2, p = add(g, new SphereGeometry(.062, 5, 4), pm, Math.cos(a) * .032, .38, Math.sin(a) * .032); p.scale.set(.78, 1.32, .58); p.rotation.y = -a; }
  for (const sgn of [-1, 1]) { const l = add(g, new SphereGeometry(.08, 8, 6), paint('#4fa13c'), sgn * .05, .13, 0); l.scale.set(.36, 1.7, .2); l.rotation.z = sgn * .45; }
  g.scale.setScalar(s);
  return g;
}
export function flowerPatch(col: string, n = 8, seed = 1) {
  const g = new Group(), r = mulberry(seed);
  for (let i = 0; i < n; i++) { const a = r() * Math.PI * 2, d = Math.sqrt(r()) * .75, f = (i % 2 ? hibiscus : flower)(col, .95 + r() * .2); f.position.set(Math.cos(a) * d, 0, Math.sin(a) * d * .7); f.rotation.y = r() * 6; g.add(f); }
  return g;
}
export function bush(flowerCol: string | null, seed = 1) {
  const g = new Group(), r = mulberry(seed), leaves = paint('#ffffff', {map: 'leaf', roughness: .9});
  for (let i = 0; i < 6; i++) add(g, lumpy(.38 + r() * .14, 2, .25, seed + i), leaves, (r() - .5) * .9, .35 + r() * .25, (r() - .5) * .6);
  if (flowerCol) for (let i = 0; i < 7; i++) { const f = flower(flowerCol, 1.5), a = r() * Math.PI; f.position.set(Math.cos(a) * .45, .35 + r() * .3, Math.sin(a) * .35 + .15); f.rotation.x = .6; g.add(f); }
  return g;
}
export function rock(s = 1, seed = 1) {
  const g = new Group(), m = add(g, lumpy(.55, 2, .35, seed), paint('#b9b3a8', {roughness: .95}), 0, .22 * s, 0);
  m.scale.set(1.25 * s, .72 * s, s);
  g.rotation.y = seed;
  return g;
}
function ropeBetween(g: Group, a: Vector3, b: Vector3, mat: Material, r = .013) {
  const m = add(g, new CylinderGeometry(r, r, a.distanceTo(b), 5), mat);
  m.position.copy(a).lerp(b, .5);
  m.quaternion.setFromUnitVectors(new Vector3(0, 1, 0), b.clone().sub(a).normalize());
}
// A boulder for rock clusters: textured lumpy stone in one of three warm greys; jungle boulders wear a moss cap.
const STONE = ['#aaa396', '#9c958a', '#b5ae9f'];
export function boulder(seed = 1, moss = false) {
  const g = new Group(), body = add(g, lumpy(.55, 2, .42, seed), paint(STONE[seed % 3], {map: 'stone', roughness: .95}), 0, .22, 0);
  body.scale.set(1.25, .72, 1);
  if (moss) add(g, lumpy(.42, 2, .35, seed + 9), paint('#5b8f41', {roughness: .95}), .06, .5, -.08).scale.set(.95, .42, .8);
  g.rotation.y = seed;
  return g;
}
export function tent() {
  const g = new Group(), V = (a: number, b: number, c: number) => new Vector3(a, b, c), rope = paint('#e6d6ad', {roughness: .9});
  const shape = new Shape(); shape.moveTo(-1.35, 0); shape.quadraticCurveTo(-.55, .86, 0, 1.95); shape.quadraticCurveTo(.55, .86, 1.35, 0); shape.closePath();
  const geo = new ExtrudeGeometry(shape, {depth: 2.5, bevelEnabled: true, bevelThickness: .05, bevelSize: .05, bevelSegments: 3, curveSegments: 10}); geo.translate(0, 0, -1.25);
  add(g, geo, paint('#78b85a', {map: 'tent', roughness: .95}));
  for (const sx of [-1, 1]) add(g, new BoxGeometry(.07, .15, 2.6), paint('#f0e3c0', {roughness: .9}), sx * 1.31, .07, 0).rotation.z = sx * .5;
  const ds = new Shape(); ds.moveTo(-.5, 0); ds.quadraticCurveTo(-.22, .7, 0, 1.25); ds.quadraticCurveTo(.22, .7, .5, 0); ds.closePath();
  add(g, new ShapeGeometry(ds, 8), paint('#2f4f23'), 0, .01, 1.31);
  for (const sx of [-1, 1]) {
    add(g, new CylinderGeometry(.11, .13, .62, 12), paint('#86c066', {map: 'tent', roughness: .95}), sx * .46, .42, 1.34).rotation.z = sx * -.36;
    add(g, new TorusGeometry(.125, .02, 6, 14), rope, sx * .46, .42, 1.34).rotation.set(Math.PI / 2, 0, sx * -.36);
  }
  add(g, new CylinderGeometry(.04, .04, 2.95, 8), wood(), 0, 1.99, 0).rotation.x = Math.PI / 2;
  for (const pz of [1.38, -1.38]) add(g, new CylinderGeometry(.04, .045, 2.0, 8), wood(), 0, 1.0, pz);
  // Pegs drawn in closer than v7's so the guy ropes stay inside the camp's ground (barrel and stall stand right behind).
  const pegs = [V(0, .04, 2.1), V(0, .04, -1.75), V(-1.55, .04, 1.2), V(1.55, .04, 1.2), V(-1.55, .04, -1.2), V(1.55, .04, -1.2)];
  for (const p of pegs) add(g, new CylinderGeometry(.035, .035, .22, 6), wood(), p.x, p.y, p.z);
  ropeBetween(g, V(0, 1.98, 1.42), pegs[0], rope); ropeBetween(g, V(0, 1.98, -1.42), pegs[1], rope);
  for (const sx of [-1, 1]) for (const pz of [1, -1]) ropeBetween(g, V(sx * .62, .95, pz * 1.1), V(sx * 1.55, .04, pz * 1.2), rope);
  add(g, new RoundedBoxGeometry(.18, .24, .18, 2, .04), paint('#ffd27a', {emissive: '#ffb340', glow: .6, roughness: .4}), 0, 1.55, 1.5);
  add(g, new CylinderGeometry(.01, .01, .3, 4), paint('#555555'), 0, 1.8, 1.45);
  return g;
}
export function campfire() {
  const g = new Group(), stone = paint('#a39e95', {roughness: .95});
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2; add(g, lumpy(.17, 1, .3, i), stone, Math.cos(a) * .58, .08, Math.sin(a) * .58).scale.set(1.15, .7, 1); }
  for (let i = 0; i < 4; i++) add(g, new CylinderGeometry(.07, .085, 1.0, 8), wood(), 0, .22, 0).rotation.set(Math.PI / 2 - .5, i / 4 * Math.PI * 2 + .3, 0, 'YXZ');
  add(g, new CircleGeometry(.42, 20), paint('#3a2a20', {roughness: 1}), 0, .02, 0).rotation.x = -Math.PI / 2;
  return g;
}
export function logBench() {
  const g = new Group();
  add(g, new CylinderGeometry(.27, .27, 2.0, 16), wood(), 0, .42, 0).rotation.z = Math.PI / 2;
  for (const s of [-1, 1]) { add(g, new CircleGeometry(.26, 20), rings(), s * 1.005, .42, 0).rotation.y = s * Math.PI / 2; add(g, new CylinderGeometry(.16, .18, .3, 10), wood(), s * .65, .15, 0); }
  return g;
}
export function stump() {
  const g = new Group();
  add(g, new CylinderGeometry(.48, .58, .5, 18), wood(), 0, .25, 0);
  add(g, new CircleGeometry(.48, 24), rings(), 0, .505, 0).rotation.x = -Math.PI / 2;
  add(g, new CylinderGeometry(.09, .08, .16, 12), paint('#e9e2d2', {roughness: .4}), .15, .59, .05);
  return g;
}
export function barrel() {
  const g = new Group();
  add(g, new CylinderGeometry(.42, .38, 1.0, 20), paint('#a8743f', {map: 'bark'}), 0, .5, 0);
  for (const y of [.18, .82]) add(g, new TorusGeometry(.415, .03, 8, 24), paint('#5d5852', {roughness: .5, metalness: .3}), 0, y, 0).rotation.x = Math.PI / 2;
  add(g, new CircleGeometry(.38, 24), paint('#5fc4e0', {roughness: .2}), 0, .96, 0).rotation.x = -Math.PI / 2;
  return g;
}
export function bucket() {
  const g = new Group();
  add(g, new CylinderGeometry(.24, .19, .36, 16, 1, true), paint('#9a6a3c', {double: true}), 0, .18, 0);
  add(g, new TorusGeometry(.23, .015, 6, 20, Math.PI), paint('#666666'), 0, .36, 0);
  return g;
}
export function firewood() {
  const g = new Group();
  for (const [n, y] of [[3, .09], [2, .25], [1, .41]]) for (let i = 0; i < n; i++) {
    const x = (i - (n - 1) / 2) * .19;
    add(g, new CylinderGeometry(.09, .09, .6, 10), wood(), x, y, 0).rotation.x = Math.PI / 2;
    add(g, new CircleGeometry(.088, 12), rings(), x, y, .301);
  }
  return g;
}
export function backpack() {
  const g = new Group();
  add(g, new RoundedBoxGeometry(.62, .72, .38, 4, .12), paint('#b07d48', {roughness: .8}), 0, .36, 0);
  add(g, new RoundedBoxGeometry(.5, .32, .1, 3, .05), paint('#c99460'), 0, .36, .2);
  add(g, new SphereGeometry(.04, 8, 6), paint('#f0c552', {roughness: .3}), 0, .4, .26);
  return g;
}
export function shell(col: string, rot = 0) {
  const g = new Group(), m = add(g, new CircleGeometry(.17, 14, Math.PI * .18, Math.PI * .64), paint(col, {roughness: .5, double: true}), 0, .03, 0);
  m.rotation.set(-Math.PI / 2 + .25, 0, rot);
  return g;
}
export function starfish() {
  const s = new Shape();
  for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, r = i % 2 ? .07 : .2; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
  s.closePath();
  const g = new Group(), m = add(g, new ExtrudeGeometry(s, {depth: .03, bevelEnabled: true, bevelSize: .02, bevelThickness: .02, bevelSegments: 2}), paint('#f2864a', {roughness: .6}), 0, .04, 0);
  m.rotation.x = -Math.PI / 2;
  return g;
}
const signMaterial = (text: string) => paint('#ffffff', {map: 'sign:' + text, roughness: .8});
export function museum() {
  const g = new Group(), front = 1.51;
  add(g, new RoundedBoxGeometry(4.2, 2.2, 3.0, 4, .18), paint('#ffffff', {map: 'plank'}), 0, 1.1, 0);
  const roofMesh = add(g, new CylinderGeometry(1.95, 1.95, 4.7, 32, 1, false, 0, Math.PI), paint('#ffffff', {map: 'shingle', double: true}), 0, 2.15, 0);
  roofMesh.rotation.set(0, Math.PI / 2, Math.PI / 2); roofMesh.scale.set(1, 1, .75);
  add(g, new RoundedBoxGeometry(.95, 1.45, .14, 3, .06), paint('#7a4a2a'), 0, .72, front);
  add(g, new SphereGeometry(.05, 8, 6), paint('#f2cf6a', {roughness: .3}), .3, .72, front + .08);
  for (const wx of [-1.35, 1.35]) { add(g, new TorusGeometry(.34, .07, 10, 24), paint('#8a5a36'), wx, 1.15, front); add(g, new CircleGeometry(.33, 24), paint('#bfe6f2', GLASS), wx, 1.15, front - .01); }
  add(g, new RoundedBoxGeometry(2.1, .62, .12, 3, .08), paint('#8a5a36'), 0, 2.05, front + .02);
  add(g, new PlaneGeometry(1.92, .5), signMaterial('섬 자연관'), 0, 2.05, front + .09);
  for (const s of [-1, 1]) { const w = add(g, new SphereGeometry(.22, 12, 10), paint('#f4a23a', {roughness: .5}), s * .2, 4.12, 0); w.scale.set(1, .25, 1.3); w.rotation.z = s * .5; }
  return g;
}
export function parasol() {
  const g = new Group(), thatch = paint('#ffffff', {map: 'thatch', roughness: 1, double: true});
  add(g, new CylinderGeometry(.06, .075, 2.5, 10), wood(), 0, 1.25, 0);
  add(g, new ConeGeometry(1.45, .85, 22, 3, true), thatch, 0, 2.68, 0);
  add(g, new CylinderGeometry(1.42, 1.5, .22, 26, 1, true), thatch, 0, 2.17, 0);
  add(g, new SphereGeometry(.09, 10, 8), wood(), 0, 3.12, 0);
  return g;
}
export function lounger(cushion: string) {
  const g = new Group(), frame = paint('#a8794a', {map: 'bark'}), cm = paint(cushion, {roughness: .8});
  add(g, new RoundedBoxGeometry(.62, .1, 1.5, 2, .04), frame, 0, .32, .1);
  for (const [lx, lz] of [[-.25, -.55], [.25, -.55], [-.25, .72], [.25, .72]]) add(g, new CylinderGeometry(.035, .035, .3, 6), frame, lx, .15, lz);
  add(g, new RoundedBoxGeometry(.56, .08, 1.0, 2, .04), cm, 0, .41, .35);
  add(g, new RoundedBoxGeometry(.56, .08, .62, 2, .04), cm, 0, .58, -.42).rotation.x = .75;
  return g;
}
export function tikiTorch() {
  const g = new Group();
  for (let i = 0; i < 4; i++) add(g, new CylinderGeometry(.05, .055, .4, 8), paint(i % 2 ? '#c9a463' : '#a8823f'), 0, .2 + i * .4, 0);
  add(g, new CylinderGeometry(.12, .07, .18, 10), paint('#6b4a2c'), 0, 1.68, 0);
  return g;
}
// A wooden pier running from the origin toward −x (out to sea), with a moored rowing boat.
export function pier(length: number) {
  const g = new Group(), deck = paint('#ffffff', {map: 'deck', roughness: .9}), post = paint('#7a5634', {map: 'bark'});
  add(g, new BoxGeometry(length, .14, 1.6), deck, -length / 2, .38, 0);
  for (let i = 0; i <= Math.round(length / 1.6); i++) for (const side of [-.82, .82]) { add(g, new CylinderGeometry(.09, .1, 2.4, 10), post, -i * 1.6, -.62, side); add(g, new CylinderGeometry(.1, .1, .5, 10), post, -i * 1.6, .66, side); }
  for (const side of [-.82, .82]) add(g, new CylinderGeometry(.02, .02, length, 6), paint('#e3d2a8'), -length / 2, .82, side).rotation.z = Math.PI / 2;
  add(g, new RoundedBoxGeometry(1.9, .42, .8, 3, .18), paint('#c8743f', {roughness: .7}), -length + .4, .02, 1.45);
  add(g, new RoundedBoxGeometry(1.6, .1, .55, 2, .05), paint('#8a5432'), -length + .4, .2, 1.45);
  add(g, new BoxGeometry(.12, .06, .62), deck, -length + .4, .26, 1.45);
  return g;
}
// Cottage with porch, shutters and flower boxes (v7 cottage2): the camp once the house is built.
export function cottage() {
  const g = new Group(), trim = paint('#ffffff', {roughness: .6}), wallTop = 2.25, rm = paint('#ffffff', {map: 'roof-red', roughness: .7}), wall = paint('#ffffff', {map: 'siding-white'}), wallDouble = paint('#ffffff', {map: 'siding-white', double: true}), doorCol = '#3e9fb5';
  add(g, new BoxGeometry(3.8, .25, 3.0), paint('#b6aa98'), 0, .12, 0);
  add(g, new RoundedBoxGeometry(3.6, 2.0, 2.8, 3, .06), wall, 0, 1.25, 0);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) add(g, new BoxGeometry(.14, 2.0, .14), trim, sx * 1.78, 1.25, sz * 1.38);
  add(g, new BoxGeometry(3.74, .12, 2.94), trim, 0, wallTop, 0);
  for (const sgn of [1, -1]) add(g, new BoxGeometry(2.55, .16, 3.5), rm, sgn * 1.02, wallTop + .74, 0).rotation.z = -sgn * .62;
  const tri = new Shape(); tri.moveTo(-1.8, 0); tri.lineTo(1.8, 0); tri.lineTo(0, 1.3); tri.closePath();
  for (const sz of [1.41, -1.41]) add(g, new ShapeGeometry(tri), wallDouble, 0, wallTop + .06, sz);
  for (const sgn of [1, -1]) add(g, new BoxGeometry(2.6, .14, .1), trim, sgn * 1.02, wallTop + .8, 1.76).rotation.z = -sgn * .62;
  add(g, new TorusGeometry(.2, .05, 8, 20), trim, 0, wallTop + .55, 1.45);
  add(g, new RoundedBoxGeometry(.38, .9, .38, 2, .05), paint('#c47b5a'), -.9, wallTop + 1.15, -.6);
  const deck = paint('#ffffff', {map: 'deck'});
  add(g, new BoxGeometry(3.3, .2, 1.45), deck, 0, .1, 2.12);
  add(g, new BoxGeometry(1.2, .1, .4), deck, 0, .05, 3.03);
  for (const cx of [-.95, .95]) { add(g, new CylinderGeometry(.08, .09, 1.95, 12), trim, cx, 1.17, 2.7); add(g, new BoxGeometry(.24, .08, .24), trim, cx, 2.18, 2.7); }
  for (const sgn of [1, -1]) add(g, new BoxGeometry(1.25, .1, 1.6), rm, sgn * .56, 2.48, 2.1).rotation.z = -sgn * .55;
  const ptri = new Shape(); ptri.moveTo(-1.1, 0); ptri.lineTo(1.1, 0); ptri.lineTo(0, .62); ptri.closePath();
  add(g, new ShapeGeometry(ptri), trim, 0, 2.2, 2.9);
  for (const sx of [-1.55, 1.55]) { for (let k = 0; k < 5; k++) add(g, new BoxGeometry(.05, .5, .05), trim, sx, .45, 1.55 + k * .3); add(g, new BoxGeometry(.08, .07, 1.35), trim, sx, .72, 2.15); }
  add(g, new RoundedBoxGeometry(.82, 1.4, .1, 3, .05), paint(doorCol, {roughness: .6}), 0, .95, 1.43);
  const glass = paint('#bfe6f2', GLASS);
  add(g, new PlaneGeometry(.42, .32), glass, 0, 1.32, 1.485);
  add(g, new SphereGeometry(.045, 8, 6), paint('#f2cf6a', {roughness: .3}), .28, .92, 1.5);
  for (const wx of [-1.08, 1.08]) {
    add(g, new RoundedBoxGeometry(.82, .78, .08, 2, .03), trim, wx, 1.5, 1.42);
    add(g, new PlaneGeometry(.68, .64), glass, wx, 1.5, 1.465);
    add(g, new BoxGeometry(.04, .64, .03), trim, wx, 1.5, 1.475); add(g, new BoxGeometry(.68, .04, .03), trim, wx, 1.5, 1.475);
    for (const sx of [-.52, .52]) add(g, new RoundedBoxGeometry(.22, .8, .06, 2, .02), paint(doorCol), wx + sx, 1.5, 1.44);
    add(g, new RoundedBoxGeometry(.84, .16, .2, 2, .03), paint('#9a6a3c'), wx, 1.04, 1.53);
    ['#e8402f', '#ffd23f', '#ff8fbf'].forEach((c, k) => { const f = flower(c, .75); f.position.set(wx - .26 + k * .26, 1.0, 1.53); g.add(f); });
  }
  for (const px of [-1.35, 1.35]) {
    add(g, new CylinderGeometry(.2, .15, .32, 14), paint('#c46a44', {roughness: .7}), px, .36, 2.55);
    for (let k = 0; k < 6; k++) { const a = k / 6 * Math.PI * 2, leaf = add(g, new SphereGeometry(.19, 10, 8), paint('#3f9a3c'), px + Math.cos(a) * .19, .66 + (k % 2) * .1, 2.55 + Math.sin(a) * .19); leaf.scale.set(1.2, .25, .55); leaf.rotation.set(.5 * Math.sin(a), -a, .5 * Math.cos(a)); }
  }
  return g;
}
export function steppingStone(seed = 1) {
  const r = mulberry(seed), g = new Group(), st = add(g, new CylinderGeometry(.34, .37, .08, 14), paint('#cfc6b4', {roughness: .95}), 0, .03, 0);
  st.scale.set(1 + (r() - .5) * .25, 1, 1 + (r() - .5) * .25);
  g.rotation.y = r() * 3;
  return g;
}
// New props for game objects the test scene did not have.
export function workbench() {
  const g = new Group(), legs = wood();
  add(g, new RoundedBoxGeometry(1.5, .14, .8, 2, .04), paint('#ffffff', {map: 'plank'}), 0, .78, 0);
  for (const [x, z] of [[-.62, -.3], [.62, -.3], [-.62, .3], [.62, .3]]) add(g, new CylinderGeometry(.06, .07, .74, 8), legs, x, .37, z);
  add(g, new BoxGeometry(.5, .02, .16), paint('#c9ced3', {roughness: .3, metalness: .6}), -.25, .86, .05).rotation.y = .3;
  add(g, new BoxGeometry(.12, .05, .08), paint('#8a5a34'), -.53, .87, -.03);
  add(g, new CylinderGeometry(.07, .07, .22, 10), paint('#9a6a42'), .35, .92, -.05).rotation.z = Math.PI / 2;
  add(g, new CylinderGeometry(.02, .02, .32, 6), legs, .35, .87, .12).rotation.x = Math.PI / 2;
  return g;
}
export function board() {
  const g = new Group(), legs = wood();
  for (const x of [-.55, .55]) add(g, new CylinderGeometry(.06, .07, 1.3, 8), legs, x, .65, 0);
  add(g, new RoundedBoxGeometry(1.5, .85, .1, 2, .04), paint('#b98a52', {map: 'plank'}), 0, 1.05, 0);
  add(g, new BoxGeometry(1.6, .09, .14), paint('#e86a3a'), 0, 1.52, 0);
  add(g, new BoxGeometry(.5, .38, .02), paint('#fdf8e6'), -.32, 1.05, .07).rotation.z = .04;
  add(g, new BoxGeometry(.5, .38, .02), paint('#fdf8e6'), .32, 1.03, .07).rotation.z = -.05;
  return g;
}
export function stall() {
  const g = new Group(), post = wood();
  add(g, new RoundedBoxGeometry(2.2, .9, .7, 2, .05), paint('#ffffff', {map: 'plank'}), 0, .45, .2);
  add(g, new BoxGeometry(2.3, .08, .8), paint('#c99766'), 0, .94, .2);
  for (const x of [-1.05, 1.05]) for (const z of [-.15, .55]) add(g, new CylinderGeometry(.05, .06, 2.0, 8), post, x, 1.0, z);
  add(g, new BoxGeometry(2.6, .06, 1.25), paint('#ffffff', {map: 'awning', roughness: .8, double: true}), 0, 2.02, .25).rotation.x = .25;
  for (let i = 0; i < 9; i++) add(g, new SphereGeometry(.15, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), paint(i % 2 ? '#fff4e2' : '#f05a4a', {double: true}), -1.2 + i * .3, 1.86, .87).rotation.x = Math.PI;
  for (const [x, c] of [[-.7, '#f5a12c'], [-.5, '#f5a12c'], [-.6, '#ffd23f']] as [number, string][]) add(g, new SphereGeometry(.11, 12, 10), paint(c, {roughness: .35}), x, 1.06, .25);
  add(g, new CylinderGeometry(.1, .1, .26, 12), paint('#bfe6f2', {roughness: .1, opacity: .7}), .4, 1.11, .2);
  add(g, new RoundedBoxGeometry(.5, .12, .22, 2, .05), paint('#5fa8c9', {roughness: .4}), .8, 1.04, .3);
  return g;
}
export function jungleArch() {
  const g = new Group(), post = wood(), vine = paint('#4f9d40', {roughness: .9});
  for (const x of [-1.1, 1.1]) add(g, new CylinderGeometry(.11, .13, 2.6, 10), post, x, 1.3, 0);
  add(g, new CylinderGeometry(.1, .1, 2.6, 10), post, 0, 2.5, 0).rotation.z = Math.PI / 2;
  add(g, new RoundedBoxGeometry(1.5, .45, .1, 2, .05), paint('#8a5a36'), 0, 2.1, .05);
  add(g, new PlaneGeometry(1.36, .36), signMaterial('정글 입구'), 0, 2.1, .11);
  for (let i = 0; i < 9; i++) add(g, new SphereGeometry(.13, 8, 6), vine, -1.15 + i * .29, 2.55 + Math.sin(i * 1.7) * .06, .1).scale.set(1, .7, .6);
  return g;
}
export function caveMouth() {
  const g = new Group(), stone = paint('#8d877c', {roughness: .95});
  add(g, new CircleGeometry(1, 24, 0, Math.PI), paint('#1d1a17', {roughness: 1}), 0, 0, 0).scale.set(1.1, 1.3, 1);
  for (let i = 0; i < 9; i++) { const a = i / 8 * Math.PI; add(g, lumpy(.45, 2, .35, i + 40), stone, Math.cos(a) * 1.35, Math.sin(a) * 1.5, -.1).scale.set(1, .9, .8); }
  return g;
}
// A washing line between two posts (v7), length along x, with a shirt pair and a towel.
export function clothesline(length = 2.6) {
  const g = new Group(), post = wood(), a = new Vector3(-length / 2, 1.6, 0), b = new Vector3(length / 2, 1.6, 0);
  for (const x of [a.x, b.x]) add(g, new CylinderGeometry(.05, .06, 1.7, 8), post, x, .85, 0);
  ropeBetween(g, a, b, paint('#efe7d8'), .01);
  const shirt = new Shape(); shirt.moveTo(-.22, 0); shirt.lineTo(.22, 0); shirt.lineTo(.22, -.3); shirt.lineTo(.36, -.22); shirt.lineTo(.42, -.36); shirt.lineTo(.26, -.46); shirt.lineTo(.26, -.86); shirt.lineTo(-.26, -.86); shirt.lineTo(-.26, -.46); shirt.lineTo(-.42, -.36); shirt.lineTo(-.36, -.22); shirt.lineTo(-.22, -.3); shirt.closePath();
  for (const [t, col, shaped] of [[.22, '#f6d23c', true], [.5, '#f08a3c', true], [.78, '#ffffff', false]] as [number, string, boolean][]) {
    const geo = shaped ? new ShapeGeometry(shirt) : new PlaneGeometry(.5, .7).translate(0, -.35, 0);
    add(g, geo, paint(col, {double: true, roughness: .9}), a.x + (b.x - a.x) * t, 1.6, 0);
  }
  return g;
}
// Fire textures (props-scene3d.ts animates the flames): a teardrop flame and a warm radial glow.
let flame: Texture | undefined, glow: Texture | undefined;
export function flameTexture() {
  if (flame) return flame;
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d')!;
  g.beginPath(); g.moveTo(64, 4); g.bezierCurveTo(86, 40, 118, 62, 106, 98); g.bezierCurveTo(98, 124, 30, 124, 22, 98); g.bezierCurveTo(10, 62, 42, 40, 64, 4); g.closePath();
  const gr = g.createRadialGradient(64, 104, 4, 64, 86, 82); gr.addColorStop(0, '#fff9c0'); gr.addColorStop(.28, '#ffd64c'); gr.addColorStop(.56, '#ff8a26'); gr.addColorStop(.86, '#ee441d'); gr.addColorStop(1, 'rgba(230,50,20,0)');
  g.fillStyle = gr; g.fill();
  flame = new CanvasTexture(c); flame.colorSpace = SRGBColorSpace;
  return flame;
}
export function glowTexture() {
  if (glow) return glow;
  const c = document.createElement('canvas'); c.width = c.height = 128; const s = c.getContext('2d')!, gr = s.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,190,110,.9)'); gr.addColorStop(.4, 'rgba(255,150,70,.35)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  s.fillStyle = gr; s.fillRect(0, 0, 128, 128);
  glow = new CanvasTexture(c); glow.colorSpace = SRGBColorSpace;
  return glow;
}
