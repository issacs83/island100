import type {IslandController} from './island-controller';
import type {Speaker} from './voice';

// What main.ts needs from whichever renderer draws the outdoor island (2D Phaser scene or 3D view).
export interface IslandView {
  control: IslandController;
  goTo(x: number, y: number): void;
  interactWith(id: string): void;
  snapToPlayer(): void;
  setSpeech(speaker: Speaker | undefined, text?: string): void;
  project(x: number, y: number, height?: number): {x: number; y: number};
}
// ?render=3d asks for the three.js view; browsers without WebGL2 stay on the 2D view.
export const wantsRender3d = (search: string, hasWebgl2: () => boolean) => {
  const r = new URLSearchParams(search).get('render');
  if (r === '2d') return false;
  if (r === '3d') return hasWebgl2();
  // 3D is the default look on capable devices; ?render=2d opts out.
  return hasWebgl2();
};
export function webgl2Available() {
  try { return !!document.createElement('canvas').getContext('webgl2'); } catch { return false; }
}
