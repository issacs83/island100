import type {Landmark} from './shared';

// World-space reach of a click, measured from a target's label point just above its base.
export const CLICK_RADIUS = 65;
const LABEL_LIFT = 25;

// One rule for every click path (canvas, art sprites, invisible hit buttons): the nearest target in reach wins.
// `owner` is the target whose own hit area received the click; it is kept only when nothing is in reach,
// so a static hit box can no longer swallow a click meant for a bug or animal right next to it.
export function pickClickTarget(point: {x: number; y: number}, targets: readonly Landmark[], owner: string): string;
export function pickClickTarget(point: {x: number; y: number}, targets: readonly Landmark[], owner?: string): string | undefined;
export function pickClickTarget(point: {x: number; y: number}, targets: readonly Landmark[], owner?: string): string | undefined {
  let best: string | undefined;
  let bestDistance = CLICK_RADIUS;
  for (const l of targets) {
    const d = Math.hypot(point.x - l.x, point.y - (l.y - LABEL_LIFT));
    if (d < bestDistance) {
      best = l.id;
      bestDistance = d;
    }
  }
  return best ?? owner;
}
