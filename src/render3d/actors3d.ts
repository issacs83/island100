import {CanvasTexture, CircleGeometry, InstancedMesh, LinearMipmapLinearFilter, Matrix4, Mesh, MeshBasicMaterial, NearestFilter, SphereGeometry, Sprite, SpriteMaterial, SRGBColorSpace, type Color, type Scene, type Texture} from 'three';
import {landmarks, type World, type Player} from '../shared';
import type {Speaker} from '../voice';
import {UNIT, bendY} from './space';
import {curvify, std} from './look';

export type ActorArt = 'hajun' | 'yeoreum';
type Sheet = {url: string; cols: number; rows: number; rowEdges: readonly number[]};
export const SHEETS: Record<ActorArt, Sheet> = {
  hajun: {url: '/art/hajun-summer-v1.png', cols: 8, rows: 3, rowEdges: [0, 295, 543, 768]},
  yeoreum: {url: '/art/yeoreum-v2.png', cols: 8, rows: 3, rowEdges: [0, 274, 516, 768]},
};
// Character cells rebuilt like the 2D makeTextures(): 88×100, feet on row 98, figures 90 px tall.
export const CELL = {w: 88, h: 100, feet: 98, figure: 90};
const NATURE_URL = '/art/wildlife-trees-v1.png', BLOB_CAPACITY = 64;

// Frame like the 2D scene: mouth shapes while voiced, walk cycle 8–15 while moving, an occasional blink.
export function actorFrame(walk: number, moving: boolean, now: number, seed: number, amplitude: number | undefined): number {
  if (amplitude !== undefined) return amplitude > .04 ? 2 : amplitude > .008 ? 3 : 0;
  if (moving) return 8 + Math.floor(walk) % 8;
  return (now + seed * .9) % 4.1 < .14 ? 1 : 0;
}
// UV window of one frame in an atlas of cols × rows cells (textures have v = 0 at the bottom). Facing left mirrors
// the window in UV space: three.js sprites ignore a negative scale, unlike Phaser's setFlipX.
export function frameWindow(frame: number, cols: number, rows: number, flip = false) {
  const col = frame % cols, row = Math.floor(frame / cols);
  return {repeatX: (flip ? -1 : 1) / cols, repeatY: 1 / rows, offsetX: (col + (flip ? 1 : 0)) / cols, offsetY: (rows - row - 1) / rows};
}
// Standing height in scene units: Hajun's art at 1.62 like v7; Yeoreum's art 0.877 of that like the 2D actorScale.
export const actorHeight = (color: number) => color % 2 === 1 ? 1.42 : 1.62;
// Nature sheet frames 0/1 rabbit and 2/3 boar alternate at 7 Hz while moving, as in 2D.
export const animalFrame = (species: string, moving: boolean, now: number) => (species === 'boar' ? 2 : 0) + (moving ? Math.floor(now * 7) % 2 : 0);
export const animalHeight = (species: string) => species === 'boar' ? .85 : .6;

export type Actor = {id: string; art: ActorArt; name: string; x: number; y: number; face: number; walk: number; moving: boolean; swimming: boolean; color: number; speaker?: Speaker; me: boolean};
// Who stands outdoors: online players not indoors, the solo companion, and registered friends nobody is playing.
export function listActors(w: World, me: Player): Actor[] {
  const out: Actor[] = [];
  for (const p of Object.values(w.players)) {
    if (!p.online || p.room) continue;
    out.push({id: p.id, art: p.color % 2 ? 'yeoreum' : 'hajun', name: p.name, x: p.x, y: p.y, face: p.face, walk: p.walk, moving: !!p.moving, swimming: !!p.swimming, color: p.color, speaker: p.name === '김여름' ? 'yeoreum' : p.id === me.id ? 'hajun' : undefined, me: p.id === me.id});
  }
  // Like 2D: Yeoreum walks with the solo companion, otherwise stands at her spot by the camp, unless an online
  // player is named 김여름; friends hide only behind an online player of the same name.
  const online = Object.values(w.players).filter(p => p.online).map(p => p.name), c = w.companion, spot = landmarks.find(l => l.kind === 'friend');
  if (!online.includes('김여름')) out.push({id: 'npc-yeoreum', art: 'yeoreum', name: '김여름', x: c?.x ?? spot?.x ?? 1050, y: c?.y ?? spot?.y ?? 545, face: c?.face ?? 1, walk: c?.walk ?? 0, moving: !!c?.moving, swimming: false, color: 1, speaker: 'yeoreum', me: false});
  w.friends.forEach((f, i) => {
    if (!online.includes(f.name)) out.push({id: `friend-${i}`, art: f.color % 2 ? 'yeoreum' : 'hajun', name: f.name, x: 1180 + (i % 4) * 50, y: 655 + Math.floor(i / 4) * 50, face: 1, walk: 0, moving: false, swimming: false, color: f.color, me: false});
  });
  return out;
}

function loadImage(url: string) {
  return new Promise<HTMLImageElement>((ok, fail) => { const image = new Image(); image.onload = () => ok(image); image.onerror = () => fail(new Error(`could not load ${url}`)); image.src = url; });
}
function pixels(image: HTMLImageElement) {
  const c = document.createElement('canvas'); c.width = image.width; c.height = image.height;
  const g = c.getContext('2d')!; g.drawImage(image, 0, 0);
  return g.getImageData(0, 0, c.width, c.height).data;
}
function opaqueBox(data: Uint8ClampedArray, stride: number, ox: number, oy: number, w: number, h: number, threshold: number) {
  let x0 = w, y0 = h, x1 = 0, y1 = 0;
  for (let y = 0; y < Math.floor(h); y++) for (let x = 0; x < Math.floor(w); x++) if (data[((oy + y) * stride + ox + x) * 4 + 3] > threshold) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return {x0, y0, w: x1 - x0 + 1, h: y1 - y0 + 1};
}
function pixelTexture(canvas: HTMLCanvasElement) {
  const t = new CanvasTexture(canvas); t.colorSpace = SRGBColorSpace; t.magFilter = NearestFilter; t.minFilter = LinearMipmapLinearFilter;
  return t;
}
// Character atlas laid out like the source sheet, each cell cut to its opaque box and rows scaled to a shared height.
function actorAtlas(image: HTMLImageElement, sheet: Sheet) {
  const data = pixels(image), cw = image.width / sheet.cols;
  const boxes = Array.from({length: sheet.cols * sheet.rows}, (_, i) => {
    const row = Math.floor(i / sheet.cols), ox = Math.floor(i % sheet.cols * cw), oy = sheet.rowEdges[row];
    return {ox, oy, ...opaqueBox(data, image.width, ox, oy, cw, sheet.rowEdges[row + 1] - oy, 140)};
  });
  const atlas = document.createElement('canvas'); atlas.width = CELL.w * sheet.cols; atlas.height = CELL.h * sheet.rows;
  const g = atlas.getContext('2d')!; g.imageSmoothingEnabled = false;
  boxes.forEach((b, i) => {
    const row = Math.floor(i / sheet.cols), scale = CELL.figure / Math.max(...boxes.slice(row * sheet.cols, row * sheet.cols + sheet.cols).map(v => v.h));
    g.drawImage(image, b.ox + b.x0, b.oy + b.y0, b.w, b.h, (i % sheet.cols) * CELL.w + (CELL.w - b.w * scale) / 2, row * CELL.h + CELL.feet - b.h * scale, b.w * scale, b.h * scale);
  });
  return pixelTexture(atlas);
}
// Nature sheet frames (4 columns, rows split at 43.5% like the 2D scene), each cropped to its opaque box.
function natureFrames(image: HTMLImageElement) {
  const data = pixels(image), cw = Math.floor(image.width / 4), split = Math.floor(image.height * .435);
  return Array.from({length: 8}, (_, i) => {
    const ox = (i % 4) * cw, oy = i < 4 ? 0 : split, b = opaqueBox(data, image.width, ox, oy, cw, i < 4 ? split : image.height - split, 128);
    const c = document.createElement('canvas'); c.width = b.w; c.height = b.h;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = false;
    g.drawImage(image, ox + b.x0, oy + b.y0, b.w, b.h, 0, 0, b.w, b.h);
    const t = pixelTexture(c); t.userData.aspect = b.w / b.h;
    return t;
  });
}
// The same frames mirrored, for animals facing left.
function mirrored(frames: CanvasTexture[]) {
  return frames.map(t => {
    const source = t.image as HTMLCanvasElement, c = document.createElement('canvas');
    c.width = source.width; c.height = source.height;
    const g = c.getContext('2d')!; g.imageSmoothingEnabled = false; g.translate(c.width, 0); g.scale(-1, 1); g.drawImage(source, 0, 0);
    const m = pixelTexture(c); m.userData.aspect = t.userData.aspect;
    return m;
  });
}

export type Head = {id: string; name: string; x: number; y: number; height: number; speaker?: Speaker; me: boolean};
type Voice = {active?: Speaker; amplitude(): number};

// Billboards for people and animals (the existing 2D art standing in 3D), toy blobs for monsters, shadow discs.
export class Actors3D {
  heads: Head[] = [];
  private atlases?: Record<ActorArt, CanvasTexture>;
  private nature?: {right: CanvasTexture[]; left: CanvasTexture[]};
  private sprites = new Map<string, Sprite>();
  private monsters = new Map<string, Mesh>();
  private blobs: InstancedMesh;
  private matrix = new Matrix4();

  constructor(private scene: Scene) {
    this.blobs = new InstancedMesh(new CircleGeometry(.38, 20).rotateX(-Math.PI / 2).translate(0, .025, 0), curvify(new MeshBasicMaterial({color: '#2b3a1c', transparent: true, opacity: .22, depthWrite: false})), BLOB_CAPACITY);
    this.blobs.count = 0; this.blobs.renderOrder = 1; this.blobs.frustumCulled = false;
    scene.add(this.blobs);
    this.load().catch(error => console.error(error));
  }

  private async load() {
    const [hajun, yeoreum, nature] = await Promise.all([loadImage(SHEETS.hajun.url), loadImage(SHEETS.yeoreum.url), loadImage(NATURE_URL)]);
    this.atlases = {hajun: actorAtlas(hajun, SHEETS.hajun), yeoreum: actorAtlas(yeoreum, SHEETS.yeoreum)};
    const frames = natureFrames(nature);
    this.nature = {right: frames, left: mirrored(frames)};
  }

  // Creates a sprite (and its texture) only the first time an actor appears.
  private sprite(id: string, make: () => Texture) {
    let sprite = this.sprites.get(id);
    if (!sprite) { sprite = new Sprite(new SpriteMaterial({map: make(), alphaTest: .5})); this.sprites.set(id, sprite); this.scene.add(sprite); }
    return sprite;
  }

  private blob(i: number, x: number, y: number, scale: number) {
    if (i >= BLOB_CAPACITY) return;
    this.matrix.makeScale(scale, 1, scale).setPosition(x / UNIT, 0, y / UNIT);
    this.blobs.setMatrixAt(i, this.matrix);
  }

  update(w: World, me: Player, now: number, focusZ: number, tint: Color, voice: Voice) {
    const seen = new Set<string>();
    let blobs = 0;
    this.heads = [];
    for (const a of listActors(w, me)) {
      this.heads.push({id: a.id, name: a.name, x: a.x, y: a.y, height: actorHeight(a.color) + .25, speaker: a.speaker, me: a.me});
      if (!a.swimming) this.blob(blobs++, a.x, a.y, 1);
      if (!this.atlases) continue;
      seen.add(a.id);
      const atlas = this.atlases[a.art], sheet = SHEETS[a.art], sprite = this.sprite(a.id, () => atlas.clone()), map = sprite.material.map!;
      const speaking = !!a.speaker && voice.active === a.speaker, cell = frameWindow(actorFrame(a.walk, a.moving, now, a.color, speaking ? voice.amplitude() : undefined), sheet.cols, sheet.rows, a.face < 0);
      map.repeat.set(cell.repeatX, cell.repeatY); map.offset.set(cell.offsetX, cell.offsetY);
      const height = actorHeight(a.color) * CELL.h / CELL.figure, Z = a.y / UNIT;
      // Swimmers sink to the waterline so the translucent sea covers their lower half, like the 2D crop.
      sprite.center.set(.5, a.swimming ? .44 : (CELL.h - CELL.feet) / CELL.h);
      sprite.scale.set(height * CELL.w / CELL.h, height, 1);
      sprite.position.set(a.x / UNIT, bendY(a.swimming ? -.05 : 0, Z, focusZ), Z);
      sprite.material.color.copy(tint);
      sprite.visible = true;
    }
    for (const animal of w.animals || []) {
      const fade = animal.hp > 0 ? 1 : Math.max(0, 1 - (w.elapsed - (animal.hitAt ?? -100)) / .5);
      if (fade <= 0) continue;
      this.blob(blobs++, animal.x, animal.y, animal.species === 'boar' ? 1.4 : .9);
      if (!this.nature) continue;
      seen.add(animal.id);
      const texture = (animal.face < 0 ? this.nature.left : this.nature.right)[animalFrame(animal.species, animal.moving, now)], sprite = this.sprite(animal.id, () => texture), height = animalHeight(animal.species);
      const hop = animal.moving ? Math.abs(Math.sin(now * (animal.species === 'rabbit' ? 9 : 7))) * (animal.species === 'rabbit' ? .09 : .02) : 0, Z = animal.y / UNIT;
      sprite.material.map = texture; sprite.material.opacity = fade; sprite.material.transparent = true; sprite.material.color.copy(tint);
      sprite.center.set(.5, 0);
      sprite.scale.set(height * (texture.userData.aspect as number), height, 1);
      sprite.position.set(animal.x / UNIT, bendY(hop, Z, focusZ), Z);
      sprite.visible = true;
    }
    for (const [id, sprite] of this.sprites) if (!seen.has(id)) sprite.visible = false;
    blobs = this.updateMonsters(w, now, blobs);
    this.blobs.count = Math.min(blobs, BLOB_CAPACITY);
    this.blobs.instanceMatrix.needsUpdate = true;
  }

  // Slimes are squashy green blobs, shadows tall violet ones; both pulse while winding up an attack.
  private updateMonsters(w: World, now: number, blobs: number) {
    const alive = new Set<string>();
    for (const m of w.monsters || []) {
      if (m.hp <= 0) continue;
      alive.add(m.id);
      let mesh = this.monsters.get(m.id);
      if (!mesh) {
        mesh = new Mesh(new SphereGeometry(.5, 18, 12), m.species === 'slime' ? std('#7fd957', {emissive: '#2c6b1c', emissiveIntensity: .35, roughness: .4}) : std('#3b2c5a', {emissive: '#6b3bd1', emissiveIntensity: .45, roughness: .6}));
        mesh.castShadow = true; this.monsters.set(m.id, mesh); this.scene.add(mesh);
      }
      const bounce = Math.abs(Math.sin(now * 5 + m.x)), pulse = m.windup > 0 ? 1 + .15 * Math.sin(now * 30) : 1;
      if (m.species === 'slime') mesh.scale.set(.9 * pulse, .62 * (1 - bounce * .15), .9 * pulse); else mesh.scale.set(.75 * pulse, 1.25, .75 * pulse);
      mesh.position.set(m.x / UNIT, (m.species === 'slime' ? .3 : .65) + bounce * .08, m.y / UNIT);
      this.blob(blobs++, m.x, m.y, 1.2);
    }
    for (const [id, mesh] of this.monsters) if (!alive.has(id)) { this.scene.remove(mesh); mesh.geometry.dispose(); this.monsters.delete(id); }
    return blobs;
  }
}
