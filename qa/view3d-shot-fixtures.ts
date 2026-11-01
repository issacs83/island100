import {mkdirSync, writeFileSync} from 'node:fs';
import {emptyWorld, addPlayer} from '../src/shared';
import {reveal} from '../src/exploration';
import {frontierRegions} from '../src/world-layout';
import {encodeSave} from '../src/save-file';
import {SHOT_SPOTS} from './shot-spots';

// Same save shape as qa/region-fixtures.ts, one per comparison spot, plus the spot list for the browser script.
mkdirSync('qa/fixtures', {recursive: true});
for (const s of SHOT_SPOTS) {
  const w = emptyWorld(), p = addPlayer(w, 'solo', '박하준');
  p.x = s.x; p.y = s.y; p.ready = true; p.looted = true; p.quiz = true; w.phase = 4;
  p.bag = {axe: 1, pickaxe: 1, rod: 1, worm: 10, wood: 50, fiber: 50, stone: 50, bottle: 1, water: 5, ration: 5};
  p.equipped = 'axe';
  for (const r of frontierRegions) w.explored = reveal(w.explored, r, 340);
  writeFileSync(`qa/fixtures/shot-${s.key}.island.json`, encodeSave(w, p.id));
}
writeFileSync('qa/fixtures/shot-spots.json', JSON.stringify(SHOT_SPOTS));
console.log(`shot fixtures written: ${SHOT_SPOTS.length}`);
