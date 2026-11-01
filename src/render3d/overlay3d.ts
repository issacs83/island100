import type {IslandController} from '../island-controller';
import {boxBounds, type ScreenBox} from './space';

export type Tag = {id: string; text: string; x: number; y: number};

// DOM layer over the 3D canvas: keyboard-focusable hit buttons, name tags, the speech bubble and the ?qa stats.
export class Overlay3D {
  private buttons = new Map<string, HTMLButtonElement>();
  private tags = new Map<string, HTMLSpanElement>();
  private hits = document.createElement('div');
  private tagLayer = document.createElement('div');
  private bubble = document.createElement('div');
  private stats?: HTMLDivElement;

  constructor(private control: IslandController, qa: boolean) {
    const ui = document.getElementById('ui')!;
    this.hits.id = 'world-items';
    this.tagLayer.id = 'tags-3d';
    this.bubble.className = 'bubble-3d';
    this.bubble.hidden = true;
    this.tagLayer.append(this.bubble);
    ui.prepend(this.tagLayer);
    ui.prepend(this.hits);
    if (qa) { this.stats = document.createElement('div'); this.stats.id = 'qa-stats'; ui.append(this.stats); }
  }

  // One button per landmark, animal and monster, sized to the object on screen. Pointer clicks go to the canvas
  // in 3D (CSS turns pointer events off here), so these buttons serve the keyboard: Tab, then Enter.
  placeButtons(targets: readonly {id: string; name: string}[], boxes: ReadonlyMap<string, ScreenBox>, width: number, height: number, blocked: boolean) {
    const seen = new Set<string>();
    for (const t of targets) {
      seen.add(t.id);
      let b = this.buttons.get(t.id);
      if (!b) {
        b = document.createElement('button');
        b.className = 'world-item';
        b.setAttribute('aria-label', `${t.name} 조사하기`);
        b.title = `${t.name} · 클릭해서 조사`;
        const id = t.id;
        b.onclick = () => this.control.activate(id);
        this.hits.append(b);
        this.buttons.set(t.id, b);
      }
      const box = boxes.get(t.id), r = box && boxBounds(box);
      b.hidden = !r || r.right < 0 || r.left > width || r.bottom < 0 || r.top > height;
      if (r && !b.hidden) {
        b.style.left = `${r.left}px`; b.style.top = `${r.top}px`;
        b.style.width = `${r.right - r.left}px`; b.style.height = `${r.bottom - r.top}px`;
      }
      b.disabled = blocked;
    }
    for (const [id, b] of this.buttons) if (!seen.has(id)) { b.remove(); this.buttons.delete(id); }
  }

  placeTags(tags: readonly Tag[]) {
    const seen = new Set<string>();
    for (const t of tags) {
      seen.add(t.id);
      let span = this.tags.get(t.id);
      if (!span) { span = document.createElement('span'); span.className = 'tag-3d'; this.tagLayer.append(span); this.tags.set(t.id, span); }
      if (span.textContent !== t.text) span.textContent = t.text;
      span.style.left = `${t.x}px`; span.style.top = `${t.y}px`;
    }
    for (const [id, span] of this.tags) if (!seen.has(id)) { span.remove(); this.tags.delete(id); }
  }

  showBubble(text: string | undefined, x = 0, y = 0) {
    this.bubble.hidden = !text;
    if (!text) return;
    if (this.bubble.textContent !== text) this.bubble.textContent = text;
    this.bubble.style.left = `${x}px`; this.bubble.style.top = `${y}px`;
  }

  showStats(fps: number, calls: number) { if (this.stats) this.stats.textContent = `fps ${fps} · draw ${calls}`; }
}
