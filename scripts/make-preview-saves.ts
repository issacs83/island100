// Season preview saves: let Hajun jump to the first morning of each season.
// Built with the game's own save format so import always validates.
import {emptyWorld, addPlayer} from '../src/shared.ts';
import {life, baseRecipes} from '../src/island-life.ts';
import {encodeSave} from '../src/save-file.ts';
import {writeFileSync, mkdirSync} from 'node:fs';

const bag = {
  shovel: 1, rod: 1, axe: 1, bugNet: 1, wateringCan: 1, bottle: 1, pot: 1, torch: 1,
  wood: 20, stone: 12, fiber: 12, worm: 5, flowerSeed: 3, mango: 3, coconut: 2, ration: 2, water: 2,
};
const SEASONS: Array<[string, number, string]> = [
  ['summer', 26, '26일차 · 여름의 첫 아침'],
  ['autumn', 51, '51일차 · 가을의 첫 아침'],
  ['winter', 76, '76일차 · 겨울의 첫 아침'],
];
mkdirSync('public/previews', {recursive: true});
for (const [name, day, label] of SEASONS) {
  const w = emptyWorld('PREVIEW');
  const p = addPlayer(w, 'solo', '박하준');
  w.elapsed = (day - 1) * 300 + 8;
  w.phase = 4;
  p.ready = true;
  p.looted = true;
  p.quiz = true;
  p.bag = {...bag} as typeof p.bag;
  p.equipped = 'shovel';
  const L = life(w);
  L.bells = 3000;
  L.recipes = [...baseRecipes, 'pickaxe', 'basket', 'bugNet', 'wateringCan', 'stoneKnife', 'arrow', 'ration', 'cookedMeat'];
  // 한 번 구동해 아침 공지·주민 이사를 반영
  for (let i = 0; i < 6; i++) {
    const {step} = await import('../src/shared.ts');
    step(w, .1);
  }
  p.online = true;
  writeFileSync(`public/previews/${name}.island.json`, encodeSave(w, 'solo'));
  console.log(`${label} → public/previews/${name}.island.json`);
}
