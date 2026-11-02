import {IslandController} from './island-controller';
import type {Bridge} from './scene';
import type {IslandView} from './island-view';
import type {Speaker} from './voice';
import type {Island3D} from './render3d/island3d';

// The 3D view as main.ts sees it: control works at once, drawing starts when the three.js chunk has loaded.
export class View3D implements IslandView {
  control: IslandController;
  private island?: Island3D;
  private speech?: {speaker: Speaker; text: string};
  // Called by the slow-device watchdog after sustained low frame rates.
  onSlow?: () => void;

  constructor(private bridge: Bridge) { this.control = new IslandController(bridge); }

  async start(host: HTMLElement) {
    const {Island3D} = await import('./render3d/island3d');
    this.island = new Island3D(host, this.bridge, this.control);
    this.island.onSlow = () => this.onSlow?.();
    if (this.speech) this.island.setSpeech(this.speech.speaker, this.speech.text);
  }
  goTo(x: number, y: number) { this.control.goTo(x, y); }
  interactWith(id: string) { this.control.interactWith(id); }
  snapToPlayer() { this.island?.snapToPlayer(); }
  setSpeech(speaker: Speaker | undefined, text = '') {
    this.speech = speaker ? {speaker, text} : undefined;
    this.island?.setSpeech(speaker, text);
  }
  project(x: number, y: number, height = 0) { return this.island?.project(x, y, height) ?? {x: NaN, y: NaN}; }
  stats() { return this.island?.stats() ?? {fps: 0, calls: 0, rendered: 0, sounds: 0}; }
}
