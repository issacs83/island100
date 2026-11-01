// Diving: with a wetsuit in the bag, walking into the sea switches the hero to swimming. Bubble spots
// out at sea hide sea creatures; pressing E (or tapping the spot) dives and brings one up.
// Swimming movement and every rule here run in the shared simulation (solo and co-op server alike).

import type {World, Player, Landmark, Item} from './shared';
import {shore, canStand} from './terrain';
import {WORLD_HEIGHT} from './world-layout';
import {life, lifeEvent, lifeItemNames, hash01, withRewards, josa, type LifeItem} from './island-life';

export const SWIM_SPEED = 92;
export const SEA_TOP = 300;
export const SEA_REFILL = 120;

// The open water strip west of the collision shoreline.
export function canSwim(p: {x: number; y: number}) {
  return Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 40 && p.x <= shore(p.y) - 8 && p.y >= SEA_TOP && p.y <= WORLD_HEIGHT - 80;
}

export const seaSpots = [
  {x: 330, y: 520}, {x: 470, y: 760}, {x: 260, y: 1150}, {x: 430, y: 1500},
  {x: 220, y: 1900}, {x: 400, y: 2300}, {x: 270, y: 2750}, {x: 430, y: 3200},
].map((p, i) => ({id: `sea-${i}`, x: Math.min(p.x, shore(p.y) - 90), y: p.y}));

const SEA_WEIGHTS: Array<[LifeItem, number]> = [['seaStar', 0.3], ['seaUrchin', 0.25], ['seaCucumber', 0.2], ['abalone', 0.15], ['octopus', 0.1]];
// What is hiding under a spot depends on the spot and how many times it has refilled.
export function seaCreature(id: string, cycle: number): LifeItem {
  let r = hash01('sea', id, cycle);
  for (const [item, weight] of SEA_WEIGHTS) {
    if (r < weight) return item;
    r -= weight;
  }
  return 'seaStar';
}
export const seaHabitat: Partial<Record<LifeItem, string>> = {
  seaStar: '얕은 바다 물방울', seaUrchin: '바위 근처 물방울', seaCucumber: '모래 바닥 물방울', abalone: '깊은 바다 물방울', octopus: '드문 물방울 · 재빠름',
};

function announce(p: Player, text: string) {
  p.notice = text;
  p.noticeSeq = (p.noticeSeq || 0) + 1;
}

// Called from shared.step before land movement. Returns true when this player's movement was handled.
export function stepSwimmer(w: World, p: Player, dt: number): boolean {
  const wantsWest = p.input.x < -0.3;
  if (!p.swimming) {
    // Entering: pushing west at the water's edge.
    if (wantsWest && p.x <= shore(p.y) + 40 && !p.gesture && !p.swing && !p.activity) {
      if (!p.bag.wetsuit) {
        if (!p.seaHint) {
          p.seaHint = true;
          announce(p, '바다예요. 잠수복이 있으면 헤엄쳐 들어가 물방울 아래를 잠수할 수 있어요.');
        }
        return false;
      }
      const entry = {x: shore(p.y) - 24, y: p.y};
      if (!canSwim(entry)) return false;
      p.x = entry.x;
      p.swimming = true;
      p.equipped = undefined;
      announce(p, '잠수복을 입고 바다로 들어갔어요! 물방울이 보이면 다가가서 E로 잠수해요.');
      return true;
    }
    return false;
  }
  // Swimming: move freely in open water; heading back to land climbs out at the shore.
  p.input.run = false;
  if (p.gesture) {
    p.moving = false;
    return true;
  }
  const dx = p.input.x * SWIM_SPEED * dt;
  const dy = p.input.y * SWIM_SPEED * dt;
  const next = {x: p.x + dx, y: p.y + dy};
  if (canSwim(next)) {
    p.moving = Math.hypot(dx, dy) > 0.01;
    if (Math.abs(dx) > 0.01) p.face = dx < 0 ? -1 : 1;
    p.walk += Math.hypot(dx, dy) / 16;
    p.x = next.x;
    p.y = next.y;
  } else if (p.input.x > 0.3) {
    const land = {x: shore(p.y) + 40, y: p.y};
    if (canStand(land)) {
      p.swimming = false;
      p.x = land.x;
      p.y = land.y;
      p.face = 1;
      announce(p, '바다에서 나왔어요.');
    }
    p.moving = false;
  } else {
    p.moving = false;
  }
  p.stamina = Math.min(100, p.stamina + 6 * dt);
  return true;
}

export function seaTargets(w?: World): Landmark[] {
  if (!w) return [];
  const L = life(w);
  return seaSpots.filter(s => (L.sea[s.id] ?? 0) <= w.elapsed).map(s => ({id: s.id, name: '물방울 · 잠수하기', x: s.x, y: s.y, kind: 'dive'}));
}

export function seaInteract(w: World, p: Player, l: Landmark): string | undefined {
  if (l.kind !== 'dive') return undefined;
  return withRewards(() => diveInner(w, p, l));
}
function diveInner(w: World, p: Player, l: Landmark): string {
  const L = life(w);
  if (!p.swimming) return p.bag.wetsuit ? '물가에서 바다 쪽으로 걸어 들어가 헤엄쳐 오세요.' : '잠수복이 필요해요. 제작대(가죽 2 · 풀줄기 4)나 교환대에서 얻어요.';
  if ((L.sea[l.id] ?? 0) > w.elapsed) return '물방울이 사라졌어요. 다른 물방울을 찾아요.';
  const cycle = Math.floor(L.stats.dive || 0) + Number(l.id.split('-')[1]) * 7;
  const found = seaCreature(l.id, cycle);
  L.sea[l.id] = w.elapsed + SEA_REFILL;
  p.gesture = {kind: 'dive', remaining: 1.5, duration: 1.5, item: found as Item, target: l.id, rewards: {[found]: 1}};
  lifeEvent(w, p, 'dive');
  return `잠수해서 ${josa(lifeItemNames[found], '을/를')} 잡았어요!`;
}

// Save-file safety: a swimmer restored outside open water is moved back to the beach.
export function restoreSwimmer(p: Player) {
  if (p.swimming && !canSwim(p)) p.swimming = false;
  if (p.swimming !== true) p.swimming = undefined;
}
