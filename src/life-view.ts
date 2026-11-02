// Renders island-life content on the Phaser world layer: bugs, shells, the message bottle, daily X marks,
// fruit on trees (with a shake-and-fall animation), the flower garden and the nature museum pavilion.
// Reads world state only; all rules live in island-life.ts.

import Phaser from 'phaser';
import type {World, Item} from './shared';
import {itemOrder} from './items';
import {seaSpots} from './island-sea';
import {SHOP, starVisible} from './island-social';
import {life, bugInfo, bugActive, shellSpots, buriedToday, dayOf, fruitTrees, gardenPlots, MUSEUM, museumCatalog, hash01, balloonToday} from './island-life';

const key = (item: Item) => `item-${itemOrder.indexOf(item)}`;

export class LifeView {
  scene: Phaser.Scene;
  ground: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
  sprites = new Map<string, Phaser.GameObjects.Image>();
  plotFlowers = new Map<string, Phaser.GameObjects.Image>();
  museumShelf: Phaser.GameObjects.Image[] = [];
  museumLabel: Phaser.GameObjects.Text;
  treeImages: Phaser.GameObjects.Image[];

  constructor(scene: Phaser.Scene, treeImages: Phaser.GameObjects.Image[]) {
    this.scene = scene;
    this.treeImages = treeImages;
    // Ground marks sit just above the terrain and below every standing object.
    this.ground = scene.add.graphics().setDepth(2);
    // Firefly light shines through the night overlay.
    this.glow = scene.add.graphics().setDepth(5001).setBlendMode(Phaser.BlendModes.ADD);
    this.museumLabel = this.buildMuseum();
    this.buildShop();
  }

  // Island shop: a striped-awning market stall with a counter of goods.
  buildShop() {
    const g = this.scene.add.graphics();
    g.fillStyle(0x2c2418, 0.22);
    g.fillEllipse(6, 4, 150, 26);
    // Counter.
    g.fillStyle(0x8a5a34);
    g.fillRect(-62, -40, 124, 36);
    g.fillStyle(0xb07a45);
    g.fillRect(-62, -40, 124, 6);
    // Goods on the counter.
    const goods = [0xe0503f, 0xf4cf4a, 0x58b7e6, 0x5aa04a, 0xf08a3c];
    goods.forEach((c, i) => {
      g.fillStyle(c);
      g.fillCircle(-48 + i * 24, -46, 7);
    });
    // Posts and striped awning.
    g.fillStyle(0x6b4428);
    for (const px of [-60, 54]) g.fillRect(px, -104, 6, 66);
    for (let i = 0; i < 8; i++) {
      g.fillStyle(i % 2 ? 0xfff6e0 : 0xe86a3a);
      g.fillRect(-72 + i * 18, -116, 18, 22);
      g.fillTriangle(-72 + i * 18, -94, -54 + i * 18, -94, -63 + i * 18, -84);
    }
    g.fillStyle(0x8a3a1e);
    g.fillRect(-74, -120, 148, 6);
    // Sign.
    g.fillStyle(0xf4e6c0);
    g.fillRoundedRect(-36, -144, 72, 22, 4);
    g.lineStyle(2, 0x6b4428);
    g.strokeRoundedRect(-36, -144, 72, 22, 4);
    const label = this.scene.add.text(0, -133, '섬 매점', {fontFamily: 'Noto Sans KR,system-ui,sans-serif', fontSize: '11px', color: '#3b2a1f', fontStyle: 'bold'}).setOrigin(0.5);
    this.scene.add.container(SHOP.x, SHOP.y - 36, [g, label]).setScale(1.45).setDepth(SHOP.y - 36);
  }

  // Wooden pavilion with a teal roof, a sign, and shelves that fill up as donations arrive.
  // Drawn in local coordinates around the deck centre, then scaled to building size.
  buildMuseum() {
    const {x, y} = MUSEUM;
    const base = y - 32;
    const g = this.scene.add.graphics();
    // Shadow and deck.
    g.fillStyle(0x2c2418, 0.22);
    g.fillEllipse(8, 6, 150, 30);
    g.fillStyle(0x8a5a34);
    g.fillRect(-66, -14, 132, 18);
    g.fillStyle(0xb07a45);
    g.fillRect(-66, -14, 132, 5);
    // Posts.
    g.fillStyle(0x6b4428);
    for (const px of [-58, 52]) g.fillRect(px, -92, 7, 80);
    // Back wall and two display shelves.
    g.fillStyle(0xe9dcb6);
    g.fillRect(-52, -86, 104, 72);
    g.fillStyle(0x9c6b3e);
    g.fillRect(-52, -62, 104, 5);
    g.fillRect(-52, -36, 104, 5);
    // Roof.
    g.fillStyle(0x2f7d74);
    g.fillTriangle(-80, -88, 80, -88, 0, -132);
    g.fillStyle(0x3fa394);
    g.fillTriangle(-70, -92, 70, -92, 0, -126);
    g.fillStyle(0x24625b);
    g.fillRect(-82, -92, 164, 7);
    // Sign board.
    g.fillStyle(0xf4e6c0);
    g.fillRoundedRect(-44, -122, 88, 22, 4);
    g.lineStyle(2, 0x6b4428);
    g.strokeRoundedRect(-44, -122, 88, 22, 4);
    const label = this.scene.add.text(0, -111, '섬 자연관', {fontFamily: 'Noto Sans KR,system-ui,sans-serif', fontSize: '11px', color: '#3b2a1f', fontStyle: 'bold'}).setOrigin(0.5);
    const parts: Phaser.GameObjects.GameObject[] = [g, label];
    // Shelf slots: 8 small icons that light up with donations.
    for (let i = 0; i < 8; i++) {
      const img = this.scene.add.image(-42 + (i % 4) * 28, -68 + Math.floor(i / 4) * 26, key('fossil')).setDisplaySize(22, 22).setVisible(false);
      this.museumShelf.push(img);
      parts.push(img);
    }
    this.scene.add.container(x, base, parts).setScale(1.6).setDepth(base);
    return label;
  }

  sprite(id: string, texture: string, size: number, depth: number) {
    let s = this.sprites.get(id);
    if (!s) {
      s = this.scene.add.image(0, 0, texture).setOrigin(0.5, 1);
      this.sprites.set(id, s);
    }
    s.setTexture(texture).setDisplaySize(size, size).setDepth(depth).setVisible(true).setAlpha(1).setAngle(0);
    return s;
  }

  update(w: World, now: number, night: number) {
    const L = life(w);
    const day = dayOf(w.elapsed);
    const g = this.ground;
    const glow = this.glow;
    g.clear();
    glow.clear();
    const used = new Set<string>();

    // Bugs.
    for (const b of L.bugs) {
      const fledFor = w.elapsed - (b.respawnAt - 45);
      const visible = bugActive(b.species, w.elapsed) && (b.state === 'idle' || (b.state === 'fled' && fledFor < 1.4));
      if (!visible) continue;
      const info = bugInfo[b.species];
      const lift = info.onTree ? 58 : b.species === 'hermitCrab' ? 0 : 34 + Math.sin(now * 3 + b.homeX) * 8;
      const size = b.species === 'hermitCrab' ? 30 : info.onTree ? 26 : 30;
      const s = this.sprite(b.id, key(b.species), size, b.y + 1);
      s.setPosition(b.x, b.y - lift);
      s.setFlipX(b.face < 0);
      if (b.species === 'butterfly') s.setScale(s.scaleX * (0.45 + Math.abs(Math.sin(now * 13 + b.homeY)) * 0.55), s.scaleY);
      if (b.species === 'dragonfly') s.setAngle(Math.sin(now * 20 + b.homeX) * 4);
      if (b.species === 'hermitCrab') s.setY(b.y - Math.abs(Math.sin(now * 8 + b.homeX)) * 2);
      if (b.state === 'fled') s.setAlpha(Math.max(0, 1 - fledFor / 1.4));
      // Small shadow under flyers, a soft glow for fireflies at night.
      if (!info.onTree) {
        g.fillStyle(0x24301d, 0.18);
        g.fillEllipse(b.x, b.y, size * 0.7, 6);
      }
      if (b.species === 'firefly') {
        const pulse = 0.5 + 0.5 * Math.sin(now * 4 + b.homeX);
        glow.fillStyle(0xfff27a, (0.15 + night * 0.35) * pulse);
        glow.fillCircle(b.x, b.y - lift - 8, 16 + pulse * 10);
      }
      used.add(b.id);
    }

    // Shells waiting on the sand.
    for (const sp of shellSpots) {
      const item = L.shells[sp.id]?.item;
      if (!item) continue;
      const s = this.sprite(sp.id, key(item), 30, sp.y);
      s.setPosition(sp.x, sp.y + 4);
      if (Math.sin(now * 2 + sp.x) > 0.96) {
        g.fillStyle(0xffffff, 0.8);
        g.fillCircle(sp.x + 10, sp.y - 18, 2);
      }
      used.add(sp.id);
    }

    // Today's message bottle on the shore.
    if (L.bottleDay !== day) {
      const spot = shellSpots[Math.floor(hash01('bottle', day) * shellSpots.length)];
      const s = this.sprite('message-bottle', key('bottle'), 38, spot.y + 10);
      s.setPosition(spot.x + 28, spot.y + 16).setAngle(72 + Math.sin(now * 1.5) * 4);
      g.fillStyle(0xfff6d8, 0.95);
      g.fillRect(spot.x + 20, spot.y - 4, 10, 6);
      used.add('message-bottle');
    }

    // Daily X marks: a cracked cross in the soil.
    for (const b of buriedToday(day)) {
      if (L.dug.includes(`${day}:${b.id}`)) continue;
      g.fillStyle(0x6b4a2c, 0.35);
      g.fillEllipse(b.x, b.y - 2, 40, 16);
      g.lineStyle(4, 0x4a2f1b, 0.9);
      g.lineBetween(b.x - 11, b.y - 9, b.x + 11, b.y + 5);
      g.lineBetween(b.x - 11, b.y + 5, b.x + 11, b.y - 9);
      g.lineStyle(1.5, 0xe9cf9a, 0.8);
      g.lineBetween(b.x - 10, b.y - 10, b.x + 10, b.y + 4);
    }

    // Fruit on trees, and fruit falling while someone shakes the tree.
    const shaking = new Map<string, number>();
    for (const p of Object.values(w.players)) {
      const ge = p.gesture;
      if (ge?.kind === 'shake' && ge.target) shaking.set(ge.target, 1 - ge.remaining / (ge.duration || 1));
    }
    for (const t of fruitTrees) {
      const f = L.fruit[t.id];
      const tree = this.treeImages[t.treeIndex];
      const shake = shaking.get(t.id);
      if (tree && shake !== undefined) tree.setAngle(Math.sin(shake * 40) * 4 * (1 - shake));
      const crownY = t.y - 22 - (tree ? tree.displayHeight * 0.62 : 140);
      const fruitItem: Item = t.palm ? 'coconut' : 'mango';
      // Fruit stays on the crown until shaken; during a shake the dropped fruit falls and bounces.
      const pending = shake !== undefined ? Object.values(w.players).find(p => p.gesture?.target === t.id)?.gesture?.rewards?.[fruitItem] || 0 : 0;
      const n = Math.max(f?.count || 0, pending);
      for (let i = 0; i < n; i++) {
        const id = `${t.id}-fruit-${i}`;
        const s = this.sprite(id, key(fruitItem), 24, t.y + 2);
        const ox = (i - (n - 1) / 2) * 26;
        if (pending && shake !== undefined) {
          const fall = Math.min(1, Math.max(0, (shake - 0.25 - i * 0.08) / 0.5));
          const bounce = fall >= 1 ? Math.abs(Math.sin((shake - 0.75) * 20)) * 6 * (1 - shake) : 0;
          s.setPosition(t.x + ox * (1 + fall * 0.6), Phaser.Math.Linear(crownY + (i % 2) * 14, t.y + 18, fall * fall) - bounce);
        } else {
          s.setPosition(t.x + ox, crownY + (i % 2) * 14);
          s.setDepth(t.y + 5);
        }
        used.add(id);
      }
    }

    // Garden plots beside the camp.
    gardenPlots.forEach((pl, i) => {
      const plot = L.plots[i];
      g.fillStyle(plot?.wet ? 0x4a3221 : 0x6e4c30, 0.95);
      g.fillEllipse(pl.x, pl.y, 46, 20);
      g.lineStyle(2, 0x3d2a1b, 0.8);
      g.strokeEllipse(pl.x, pl.y, 46, 20);
      if (!plot || plot.stage < 0) return;
      if (plot.stage === 0) {
        g.fillStyle(0xe8d29a);
        for (const dx of [-8, 0, 8]) g.fillCircle(pl.x + dx, pl.y - 2, 2);
      } else if (plot.stage < 3) {
        const h = plot.stage === 1 ? 12 : 22;
        const sway = Math.sin(now * 2 + i) * 2;
        g.lineStyle(3, 0x4f8a3a);
        g.lineBetween(pl.x, pl.y - 2, pl.x + sway, pl.y - h);
        g.fillStyle(0x6fb24a);
        g.fillEllipse(pl.x - 6 + sway, pl.y - h + 6, 10, 5);
        g.fillEllipse(pl.x + 6 + sway, pl.y - h + 8, 10, 5);
        if (plot.stage === 2) {
          g.fillStyle(plot.flower === 'hibiscus' ? 0xe0503f : 0xfff6e0);
          g.fillCircle(pl.x + sway, pl.y - h - 2, 4);
        }
      } else {
        const s = this.sprite(pl.id, key(plot.flower), 36, pl.y + 1);
        s.setPosition(pl.x + Math.sin(now * 2 + i) * 1.5, pl.y - 2);
        used.add(pl.id);
      }
      if (plot.wet) {
        g.fillStyle(0x9be3e0, 0.5);
        g.fillCircle(pl.x - 14, pl.y + 2, 2);
        g.fillCircle(pl.x + 12, pl.y + 3, 2);
      }
    });

    // Water drops while someone waters.
    for (const p of Object.values(w.players)) {
      if (p.gesture?.kind !== 'water' || p.room) continue;
      const t = 1 - p.gesture.remaining / (p.gesture.duration || 1);
      for (let k = 0; k < 6; k++) {
        const u = (t * 3 + k / 6) % 1;
        g.fillStyle(0x7fd0f0, 0.85 * (1 - u));
        g.fillCircle(p.x + p.face * (58 + k * 3), p.y - 40 + u * 38, 2.5);
      }
    }

    // Swimmers: ripples around the waterline, bubbles while diving; bubble spots out at sea.
    for (const sp of seaSpots) {
      if ((L.sea[sp.id] ?? 0) > w.elapsed) continue;
      for (let k = 0; k < 4; k++) {
        const u = (now * 0.6 + k / 4 + sp.y * 0.001) % 1;
        g.fillStyle(0xeaffff, 0.55 * (1 - u));
        g.fillCircle(sp.x + Math.sin(k * 2.1 + now) * 10, sp.y - u * 22, 3 + k % 2);
      }
      g.lineStyle(2, 0xeaffff, 0.25 + 0.15 * Math.sin(now * 2 + sp.x));
      g.strokeEllipse(sp.x, sp.y, 46, 14);
    }
    for (const p of Object.values(w.players)) {
      if (!p.swimming || !p.online) continue;
      const r = 1 + 0.08 * Math.sin(now * 3 + p.x);
      g.lineStyle(2, 0xf2ffff, 0.6);
      g.strokeEllipse(p.x, p.y - 4, 70 * r, 18 * r);
      g.lineStyle(1.5, 0xf2ffff, 0.3);
      g.strokeEllipse(p.x, p.y - 4, 96 * r, 26 * r);
      if (p.gesture?.kind === 'dive') {
        const t = 1 - p.gesture.remaining / (p.gesture.duration || 1);
        for (let k = 0; k < 7; k++) {
          const u = (t * 2.5 + k / 7) % 1;
          g.fillStyle(0xffffff, 0.7 * (1 - u));
          g.fillCircle(p.x + Math.sin(k * 1.7) * 14, p.y - 10 - u * 50, 2 + (k % 3));
        }
      }
    }

    // Daily balloon gift hovering above its spot (pop it with a weapon).
    const bl = balloonToday(w);
    if (bl) {
      const bob = Math.sin(now * 2.2) * 5;
      const box = this.sprite('balloon-gift', key('ration'), 36, bl.y + 1);
      box.setPosition(bl.x, bl.y - 26 + bob * .4);
      g.fillStyle(0xe8564a, 1);
      g.fillEllipse(bl.x, bl.y - 74 + bob, 42, 52);
      g.fillStyle(0xffffff, .35);
      g.fillEllipse(bl.x - 8, bl.y - 88 + bob, 9, 13);
      g.lineStyle(2, 0xfff6d8, .8);
      g.lineBetween(bl.x, bl.y - 48 + bob, bl.x, bl.y - 12 + bob * .4);
      used.add('balloon-gift');
    }

    // Shooting star across the night sky on meteor nights.
    if (starVisible(w)) {
      const view = this.scene.cameras.main.worldView;
      const u = (w.elapsed % 12) / 3;
      const hx = view.x + view.width * (0.2 + 0.6 * u);
      const hy = view.y + view.height * (0.1 + 0.12 * u);
      for (let k = 0; k < 10; k++) {
        glow.fillStyle(0xfff6c8, 0.9 * (1 - k / 10));
        glow.fillCircle(hx - k * 14, hy - k * 3, 4 - k * 0.3);
      }
    }

    // Museum shelves show what has been donated.
    const donated = museumCatalog.filter(e => L.museum.includes(e.key));
    this.museumShelf.forEach((img, i) => {
      const e = donated[i];
      if (!e) {
        img.setVisible(false);
        return;
      }
      img.setTexture(key((e.item || 'fossil') as Item)).setVisible(true);
    });
    this.museumLabel.setText(`섬 자연관 ${donated.length}/${museumCatalog.length}`);

    for (const [id, s] of this.sprites) if (!used.has(id)) s.setVisible(false);
  }
}
