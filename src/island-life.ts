// Island life: Animal Crossing–inspired living content layered on the survival game.
// Systems: bug catching with a net, beachcombing shells, daily buried spots (fossils / clay / old coins),
// shaking fruit trees, a flower garden with a watering can, the nature museum (donation, fossil appraisal,
// encyclopedia), island miles (achievements, daily tasks, exchange board) and a daily message bottle.
// Everything here is plain data + pure functions so the browser (solo) and the server (co-op) run the
// exact same rules. Timings are tuned to the 300-second day and are this game's own design values.

import type {World, Player, Item, Landmark} from './shared';
import {nearestGround, canStand, shore} from './terrain';
import {frontierTrees} from './world-layout';

const DAY = 300;

export type LifeItem = 'bugNet' | 'wateringCan' | 'butterfly' | 'dragonfly' | 'cicada' | 'beetle' | 'firefly' | 'hermitCrab'
  | 'conch' | 'scallop' | 'coral' | 'sandDollar' | 'fossil' | 'clay' | 'oldCoin' | 'mango' | 'flowerSeed' | 'hibiscus' | 'plumeria'
  // Second wave: diving, hybrid flower, clothes, friendship keepsakes and event prizes.
  | 'wetsuit' | 'seaUrchin' | 'seaStar' | 'octopus' | 'abalone' | 'seaCucumber' | 'pinkHibiscus'
  | 'strawHat' | 'flowerCrown' | 'bandana' | 'tropicalShirt' | 'stripedShirt' | 'friendPhoto' | 'fishTrophy' | 'bugTrophy' | 'starFragment'
  | 'stagBeetle' | 'grandDragonfly' | 'goldBeetle' | 'glassButterfly';

export const lifeItems: LifeItem[] = ['bugNet', 'wateringCan', 'butterfly', 'dragonfly', 'cicada', 'beetle', 'firefly', 'hermitCrab',
  'conch', 'scallop', 'coral', 'sandDollar', 'fossil', 'clay', 'oldCoin', 'mango', 'flowerSeed', 'hibiscus', 'plumeria',
  'wetsuit', 'seaUrchin', 'seaStar', 'octopus', 'abalone', 'seaCucumber', 'pinkHibiscus',
  'strawHat', 'flowerCrown', 'bandana', 'tropicalShirt', 'stripedShirt', 'friendPhoto', 'fishTrophy', 'bugTrophy', 'starFragment',
  'stagBeetle', 'grandDragonfly', 'goldBeetle', 'glassButterfly'];

export const lifeItemNames: Record<LifeItem, string> = {
  bugNet: '곤충망', wateringCan: '물뿌리개', butterfly: '호랑나비', dragonfly: '고추잠자리', cicada: '참매미', beetle: '장수풍뎅이',
  firefly: '반딧불이', hermitCrab: '소라게', conch: '소라 껍데기', scallop: '가리비', coral: '산호 조각', sandDollar: '연잎성게',
  fossil: '감정 전 화석', clay: '점토', oldCoin: '옛날 동전', mango: '망고', flowerSeed: '꽃씨', hibiscus: '히비스커스', plumeria: '플루메리아',
  wetsuit: '잠수복', seaUrchin: '성게', seaStar: '불가사리', octopus: '문어', abalone: '전복', seaCucumber: '해삼', pinkHibiscus: '분홍 히비스커스',
  strawHat: '밀짚모자', flowerCrown: '꽃 화관', bandana: '탐험 두건', tropicalShirt: '꽃무늬 셔츠', stripedShirt: '줄무늬 셔츠',
  friendPhoto: '여름이의 사진', fishTrophy: '낚시 대회 트로피', bugTrophy: '곤충 대회 트로피', starFragment: '별 조각',
  stagBeetle: '사슴벌레', grandDragonfly: '왕잠자리', goldBeetle: '금풍뎅이', glassButterfly: '유리나비',
};

// Clothing slots. Hats sit on the head; shirts use the torso overlay layer (same place as the vest).
export const hats: LifeItem[] = ['strawHat', 'flowerCrown', 'bandana'];
export const shirts: LifeItem[] = ['tropicalShirt', 'stripedShirt'];
export const seaCreatures: LifeItem[] = ['seaUrchin', 'seaStar', 'octopus', 'abalone', 'seaCucumber'];

export const lifeItemUse: Partial<Record<LifeItem, string>> = {
  bugNet: '천천히 걸어 다가가 곤충 잡기', wateringCan: '꽃밭에 물 주기', fossil: '자연관에서 감정 · 기증',
  oldCoin: '자연관 교환대에서 마일리지로 바꾸기', flowerSeed: '캠프 꽃밭에 심기', clay: '제작 재료',
  wetsuit: '가방에 있으면 바다로 걸어 들어가 헤엄 · 물방울에서 잠수', strawHat: '옷장: 머리에 쓰기', flowerCrown: '옷장: 머리에 쓰기',
  bandana: '옷장: 머리에 쓰기', tropicalShirt: '옷장: 입기', stripedShirt: '옷장: 입기', friendPhoto: '베스트 프렌드 기념품',
  starFragment: '별똥별 밤에 소원을 빌어 얻은 조각 · 매점에서 비싸게 팔려요', pinkHibiscus: '빨강·하양 꽃을 이웃해 물 주면 피는 교배종',
};

export const lifeRecipes: Partial<Record<LifeItem, Partial<Record<string, number>>>> = {
  bugNet: {wood: 2, fiber: 3},
  wateringCan: {stone: 2, wood: 2, fiber: 1},
  wetsuit: {hide: 2, fiber: 4},
  flowerCrown: {hibiscus: 2, plumeria: 1},
  bandana: {fiber: 5},
};

export const lifeFoods: Partial<Record<LifeItem, {food: number; water: number}>> = {mango: {food: 18, water: 8}};

export const lifeTools: LifeItem[] = ['bugNet', 'wateringCan'];

// Korean particle helper: picks 을/를, 이/가, 은/는, 과/와 from the last syllable of a word.
export function josa(word: string, pair: '을/를' | '이/가' | '은/는' | '과/와') {
  const code = word.charCodeAt(word.length - 1) - 0xac00;
  const batchim = code >= 0 && code <= 11171 && code % 28 !== 0;
  const [withB, without] = pair.split('/');
  return word + (batchim ? withB : without);
}

// ---------- Time helpers (mirror shared.ts so this module has no runtime import cycle) ----------

export function hourOf(elapsed: number) {
  return (7.333 + (elapsed % DAY) * 24 / DAY) % 24;
}
export function dayOf(elapsed: number) {
  return Math.floor(elapsed / DAY) + 1;
}
// Deterministic 0..1 hash so every client and the server agree on daily randomness.
export function hash01(...parts: Array<string | number>) {
  let h = 2166136261;
  for (const ch of parts.join('|')) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ---------- Bugs ----------

export type BugSpecies = 'butterfly' | 'dragonfly' | 'cicada' | 'beetle' | 'firefly' | 'hermitCrab' | 'stagBeetle' | 'grandDragonfly' | 'goldBeetle' | 'glassButterfly';
type Time = 'day' | 'night' | 'any';
export const bugInfo: Record<BugSpecies, {time: Time; flee: number; wander: number; onTree?: boolean; habitat: string}> = {
  butterfly: {time: 'day', flee: 40, wander: 70, habitat: '꽃이 많은 초원 · 낮'},
  dragonfly: {time: 'day', flee: 60, wander: 90, habitat: '샘과 물가 · 낮'},
  cicada: {time: 'day', flee: 35, wander: 0, onTree: true, habitat: '나무 기둥 · 낮'},
  beetle: {time: 'night', flee: 30, wander: 0, onTree: true, habitat: '나무 기둥 · 밤'},
  firefly: {time: 'night', flee: 45, wander: 55, habitat: '물가 풀숲 · 밤'},
  hermitCrab: {time: 'any', flee: 50, wander: 40, habitat: '모래 해변 · 언제나'},
  stagBeetle: {time: 'night', flee: 32, wander: 0, onTree: true, habitat: '나무 기둥 · 밤'},
  grandDragonfly: {time: 'day', flee: 70, wander: 110, habitat: '넓은 물가 · 낮'},
  goldBeetle: {time: 'night', flee: 28, wander: 0, onTree: true, habitat: '깊은 숲 나무 · 밤'},
  glassButterfly: {time: 'day', flee: 45, wander: 80, habitat: '꽃밭 근처 · 낮'},
};
// Running inside this radius scares every bug; walking only scares inside each bug's own flee radius.
export const RUN_SCARE = 190;

export type Bug = {id: string; species: BugSpecies; x: number; y: number; homeX: number; homeY: number; state: 'idle' | 'fled' | 'caught'; respawnAt: number; face: number};

const g = (x: number, y: number) => nearestGround({x, y});
// Tree-dwelling bugs sit on decorative trees; find the tree closest to a wish point.
const treeNear = (x: number, y: number) => {
  const t = [...frontierTrees].sort((a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y))[0];
  return {x: t.x, y: t.y + 26};
};
export const bugSpots: Array<{id: string; species: BugSpecies; x: number; y: number}> = [
  {id: 'bug-butterfly-1', species: 'butterfly', ...g(2380, 1760)},
  {id: 'bug-butterfly-2', species: 'butterfly', ...g(2560, 3150)},
  {id: 'bug-butterfly-3', species: 'butterfly', ...g(1560, 900)},
  {id: 'bug-dragonfly-1', species: 'dragonfly', ...g(2300, 600)},
  {id: 'bug-dragonfly-2', species: 'dragonfly', ...g(1150, 1420)},
  {id: 'bug-cicada-1', species: 'cicada', ...treeNear(4150, 2050)},
  {id: 'bug-cicada-2', species: 'cicada', ...treeNear(2200, 1250)},
  {id: 'bug-beetle-1', species: 'beetle', ...treeNear(4400, 2300)},
  {id: 'bug-beetle-2', species: 'beetle', ...treeNear(2700, 1500)},
  {id: 'bug-firefly-1', species: 'firefly', ...g(2380, 640)},
  {id: 'bug-firefly-2', species: 'firefly', ...g(2450, 3300)},
  {id: 'bug-hermit-1', species: 'hermitCrab', ...g(930, 760)},
  {id: 'bug-hermit-2', species: 'hermitCrab', ...g(760, 1900)},
  {id: 'bug-hermit-3', species: 'hermitCrab', ...g(760, 3000)},
  {id: 'bug-stag-1', species: 'stagBeetle', ...treeNear(3400, 1700)},
  {id: 'bug-grand-1', species: 'grandDragonfly', ...g(2900, 800)},
  {id: 'bug-gold-1', species: 'goldBeetle', ...treeNear(4800, 1150)},
  {id: 'bug-glass-1', species: 'glassButterfly', ...g(1550, 1000)},
];

export function bugActive(species: BugSpecies, elapsed: number) {
  const h = hourOf(elapsed);
  const day = h >= 6 && h < 18.5;
  const t = bugInfo[species].time;
  return t === 'any' || (t === 'day' ? day : !day);
}

// ---------- Beachcombing, buried spots, fruit trees, garden, museum ----------

const SHELLS: LifeItem[] = ['scallop', 'conch', 'sandDollar', 'coral'];
const SHELL_WEIGHTS = [0.35, 0.3, 0.2, 0.15];
export const shellSpots = [
  {x: 900, y: 690}, {x: 820, y: 640}, {x: 860, y: 790}, {x: 740, y: 1150}, {x: 735, y: 1480},
  {x: 760, y: 1820}, {x: 735, y: 2200}, {x: 750, y: 2580}, {x: 735, y: 2950}, {x: 760, y: 3350},
].map((p, i) => ({id: `shell-${i}`, ...nearestGround({x: Math.max(p.x, shore(p.y) + 45), y: p.y})}));

function pickShell(seed: string): LifeItem {
  let r = hash01(seed);
  for (let i = 0; i < SHELLS.length; i++) {
    if (r < SHELL_WEIGHTS[i]) return SHELLS[i];
    r -= SHELL_WEIGHTS[i];
  }
  return SHELLS[0];
}

// Candidate places for the daily "X" marks: open sand and grass all over the connected island.
export const buriedCandidates = [
  {x: 1000, y: 560}, {x: 1400, y: 780}, {x: 1900, y: 690}, {x: 2600, y: 600}, {x: 1300, y: 1150}, {x: 1800, y: 1350},
  {x: 2450, y: 1950}, {x: 3100, y: 1700}, {x: 3600, y: 1250}, {x: 4200, y: 900}, {x: 4900, y: 1400}, {x: 5500, y: 2000},
  {x: 4600, y: 2600}, {x: 3800, y: 2900}, {x: 2900, y: 3300}, {x: 2000, y: 2700}, {x: 1300, y: 2300}, {x: 1000, y: 3100},
  {x: 5900, y: 3200}, {x: 6300, y: 2500},
].map((p, i) => ({id: `buried-${i}`, ...nearestGround(p)}));
export const BURIED_PER_DAY = 4;
export function buriedToday(day: number) {
  return [...buriedCandidates].sort((a, b) => hash01(day, a.id) - hash01(day, b.id)).slice(0, BURIED_PER_DAY);
}
export function buriedFind(day: number, id: string): LifeItem {
  const r = hash01('find', day, id);
  return r < 0.5 ? 'fossil' : r < 0.8 ? 'clay' : 'oldCoin';
}

// Fruit trees are existing decorative trees (they already have trunk collision). Palms drop coconuts.
export const fruitTrees = [{x: 4150, y: 2100}, {x: 4500, y: 2250}, {x: 2350, y: 1700}, {x: 2600, y: 1950}, {x: 1500, y: 1500}, {x: 2500, y: 3100}]
  .map((wish, i) => {
    const index = frontierTrees.map((t, j) => ({t, j})).sort((a, b) => Math.hypot(a.t.x - wish.x, a.t.y - wish.y) - Math.hypot(b.t.x - wish.x, b.t.y - wish.y))[0];
    return {id: `fruit-${i}`, x: index.t.x, y: index.t.y + 22, palm: index.j % 4 === 0, treeIndex: index.j};
  });
export const FRUIT_REGROW = 240;

// Garden plots beside the camp.
export const gardenPlots = [{x: 1395, y: 805}, {x: 1450, y: 805}, {x: 1505, y: 805}, {x: 1450, y: 852}].map((p, i) => ({id: `plot-${i}`, ...p}));
export const GROW_SECONDS = 40;

export const MUSEUM = {id: 'museum', x: 1612, y: 668};
// Plaza bulletin board between the camp and the museum: today's season, weather, event, turnip prices
// and neighbour news in one read (the news text itself is assembled in island-social).
export const BOARD = {id: 'plaza-board', x: 1420, y: 560};

export type MuseumCategory = 'fish' | 'bug' | 'shell' | 'fossil' | 'sea';
export const museumCatalog: Array<{key: string; name: string; cat: MuseumCategory; item?: Item}> = [
  {key: 'rawFish', name: '작은 물고기', cat: 'fish', item: 'rawFish'},
  {key: 'reefFish', name: '산호 물고기', cat: 'fish', item: 'reefFish'},
  ...(['butterfly', 'dragonfly', 'cicada', 'beetle', 'firefly', 'hermitCrab', 'stagBeetle', 'grandDragonfly', 'goldBeetle', 'glassButterfly'] as const).map(k => ({key: k, name: lifeItemNames[k], cat: 'bug' as const, item: k as Item})),
  ...(['conch', 'scallop', 'coral', 'sandDollar'] as const).map(k => ({key: k, name: lifeItemNames[k], cat: 'shell' as const, item: k as Item})),
  ...(['seaUrchin', 'seaStar', 'octopus', 'abalone', 'seaCucumber'] as const).map(k => ({key: k, name: lifeItemNames[k], cat: 'sea' as const, item: k as Item})),
  {key: 'ammonite', name: '암모나이트', cat: 'fossil'}, {key: 'trilobite', name: '삼엽충', cat: 'fossil'},
  {key: 'sharkTooth', name: '상어 이빨', cat: 'fossil'}, {key: 'amber', name: '호박 속 곤충', cat: 'fossil'},
  {key: 'fern', name: '고사리 화석', cat: 'fossil'}, {key: 'footprint', name: '공룡 발자국', cat: 'fossil'},
];
export const DONATE_MILES = 50;

// ---------- Miles: achievements, daily tasks, exchange ----------

export type LifeStat = 'bug' | 'shell' | 'shake' | 'fruit' | 'dig' | 'fossil' | 'donate' | 'plant' | 'water' | 'harvest' | 'fish' | 'chop' | 'message'
  | 'dive' | 'gift' | 'request' | 'sell' | 'wish' | 'hybrid';
export const achievements: Array<{id: string; label: string; stat: LifeStat; n: number; miles: number}> = [
  {id: 'bug-1', label: '첫 곤충 채집', stat: 'bug', n: 1, miles: 100},
  {id: 'bug-5', label: '곤충 채집가', stat: 'bug', n: 5, miles: 200},
  {id: 'shell-1', label: '첫 조개 줍기', stat: 'shell', n: 1, miles: 50},
  {id: 'shell-10', label: '해변 산책가', stat: 'shell', n: 10, miles: 200},
  {id: 'shake-1', label: '나무 흔들기', stat: 'shake', n: 1, miles: 50},
  {id: 'dig-1', label: '보물 찾기', stat: 'dig', n: 1, miles: 80},
  {id: 'fossil-1', label: '첫 화석', stat: 'fossil', n: 1, miles: 100},
  {id: 'donate-1', label: '자연관 첫 기증', stat: 'donate', n: 1, miles: 100},
  {id: 'donate-10', label: '자연관 후원자', stat: 'donate', n: 10, miles: 300},
  {id: 'plant-1', label: '첫 씨앗 심기', stat: 'plant', n: 1, miles: 50},
  {id: 'water-5', label: '부지런한 정원사', stat: 'water', n: 5, miles: 100},
  {id: 'harvest-1', label: '첫 꽃 피우기', stat: 'harvest', n: 1, miles: 150},
  {id: 'fish-3', label: '낚시 입문', stat: 'fish', n: 3, miles: 150},
  {id: 'chop-1', label: '나무꾼 입문', stat: 'chop', n: 1, miles: 100},
  {id: 'message-1', label: '병 속의 편지', stat: 'message', n: 1, miles: 50},
  {id: 'dive-1', label: '첫 잠수', stat: 'dive', n: 1, miles: 100},
  {id: 'dive-5', label: '바다 탐험가', stat: 'dive', n: 5, miles: 200},
  {id: 'gift-1', label: '마음을 담은 선물', stat: 'gift', n: 1, miles: 50},
  {id: 'request-3', label: '믿음직한 친구', stat: 'request', n: 3, miles: 200},
  {id: 'sell-1', label: '첫 거래', stat: 'sell', n: 1, miles: 50},
  {id: 'hybrid-1', label: '새로운 꽃 색', stat: 'hybrid', n: 1, miles: 200},
  {id: 'wish-1', label: '별에게 소원을', stat: 'wish', n: 1, miles: 100},
];
export const dailyPool: Array<{id: string; label: string; stat: LifeStat; n: number}> = [
  {id: 'd-bug', label: '곤충 2마리 잡기', stat: 'bug', n: 2},
  {id: 'd-shell', label: '조개 3개 줍기', stat: 'shell', n: 3},
  {id: 'd-shake', label: '과일나무 1번 흔들기', stat: 'shake', n: 1},
  {id: 'd-water', label: '꽃에 물 2번 주기', stat: 'water', n: 2},
  {id: 'd-fish', label: '물고기 1마리 낚기', stat: 'fish', n: 1},
  {id: 'd-dig', label: 'X 표시 1곳 파기', stat: 'dig', n: 1},
  {id: 'd-donate', label: '자연관에 1번 기증하기', stat: 'donate', n: 1},
  {id: 'd-chop', label: '나무 1그루 베기', stat: 'chop', n: 1},
  {id: 'd-dive', label: '바다에서 1번 잠수하기', stat: 'dive', n: 1},
  {id: 'd-gift', label: '친구에게 선물하기', stat: 'gift', n: 1},
  {id: 'd-request', label: '친구 부탁 들어주기', stat: 'request', n: 1},
];
export const DAILY_MILES = 100;
export function dailyTasks(day: number) {
  return [...dailyPool].sort((a, b) => hash01('daily', day, a.id) - hash01('daily', day, b.id)).slice(0, 3);
}
export const exchangeOffers: Array<{id: string; label: string; cost: number; give: Partial<Record<Item, number>>}> = [
  {id: 'seeds', label: '꽃씨 3봉지', cost: 60, give: {flowerSeed: 3}},
  {id: 'bait', label: '지렁이 미끼 3개', cost: 40, give: {worm: 3}},
  {id: 'arrows', label: '화살 5개', cost: 50, give: {arrow: 5}},
  {id: 'ration', label: '비상식량 2개', cost: 80, give: {ration: 2}},
  {id: 'net-kit', label: '목재 3 · 풀줄기 3', cost: 60, give: {wood: 3, fiber: 3}},
  {id: 'can', label: '물뿌리개', cost: 150, give: {wateringCan: 1}},
  {id: 'suit', label: '잠수복', cost: 250, give: {wetsuit: 1}},
  {id: 'recipe', label: '수수께끼 레시피', cost: 120, give: {}},
];
export const COIN_MILES = 80;

export const bottleTips = [
  '바다 냄새가 나는 쪽지: “조개는 파도가 밀려온 뒤 다시 모래 위에 올라와요.”',
  '젖은 쪽지: “나비는 뛰어오면 날아가요. 천천히 걸어서 다가가요.”',
  '오래된 쪽지: “X 표시는 매일 새로 생겨요. 삽으로 파 보세요.”',
  '구겨진 쪽지: “꽃은 물을 줄 때마다 한 단계씩 자라요.”',
  '연필 쪽지: “밤에는 나무 기둥에 장수풍뎅이가, 물가에는 반딧불이가 나와요.”',
  '파란 쪽지: “자연관에 처음 기증하면 마일리지를 받아요.”',
  '물방울 그림 쪽지: “잠수복을 입고 바다로 걸어가면 헤엄칠 수 있어요. 물방울 아래에 바다 생물이 있어요.”',
  '꽃잎 쪽지: “빨간 꽃과 하얀 꽃을 나란히 두고 물을 주면 새로운 색이 필 수도 있어요.”',
  '하트 쪽지: “친구에게 좋아하는 선물을 주면 더 친해져요.”',
];

// ---------- Weather (deterministic per day, no save field needed) ----------

export type Weather = 'sunny' | 'cloudy' | 'rain' | 'storm';
export const weatherNames: Record<Weather, {name: string; icon: string}> = {
  sunny: {name: '맑음', icon: '☀️'}, cloudy: {name: '흐림', icon: '☁️'}, rain: {name: '비', icon: '🌧️'}, storm: {name: '폭풍', icon: '⛈️'},
};
// Day 1 is always sunny (the arrival tutorial). Later days roll a fixed hash so every
// client and reload see the same sky without storing anything.
export function weatherOf(day: number): Weather {
  if (day <= 1) return 'sunny';
  const r = hash01('weather', day);
  return r < 0.5 ? 'sunny' : r < 0.78 ? 'cloudy' : r < 0.94 ? 'rain' : 'storm';
}
// Fish bite sooner in the rain (our own design value for the 300-second day).
export function fishingWaitFactor(day: number) {
  const w = weatherOf(day);
  return w === 'storm' ? 0.5 : w === 'rain' ? 0.6 : 1;
}

// ---------- Seasons: four quarters across the 100-day island year ----------

export type Season = 'spring' | 'summer' | 'autumn' | 'winter';
export const seasonNames: Record<Season, {name: string; icon: string; hello: string}> = {
  spring: {name: '봄', icon: '🌸', hello: '🌸 봄이 찾아왔어요! 꽃 피는 계절이에요.'},
  summer: {name: '여름', icon: '🌊', hello: '🌊 여름이에요! 바다가 반짝여요.'},
  autumn: {name: '가을', icon: '🍁', hello: '🍁 가을이 왔어요! 낙엽이 색을 낼 거예요.'},
  winter: {name: '겨울', icon: '❄️', hello: '❄️ 겨울이에요! 눈이 내리는 섬이 돼요.'},
};
// Days 1-25 spring, 26-50 summer, 51-75 autumn, 76-100 winter (the 100-day arc is one island year).
export function seasonOf(day: number): Season {
  return (['spring', 'summer', 'autumn', 'winter'] as Season[])[Math.max(0, Math.floor((day - 1) / 25)) % 4];
}
// Gardens grow slower in the cold (our own design value).
export function growSecondsFor(day: number) {
  return GROW_SECONDS * (seasonOf(day) === 'winter' ? 1.5 : 1);
}

// ---------- Turnip market: buy once a week, sell through the week, rot on Monday ----------

// Turnips arrive on days 8, 15, 22 … (day % 7 === 1, never on arrival day 1).
export function isTurnipDay(day: number) {
  return day > 1 && day % 7 === 1;
}
export function turnipBuyPrice(day: number) {
  return 90 + Math.floor(hash01('turnip-buy', Math.floor((day - 1) / 7)) * 21);
}
// Weekday selling price: usually 60-140 bells, with an occasional spike to 250-600.
export function turnipSellPrice(day: number) {
  if (!isTurnipDay(day) && day % 7 !== 1 && day > 1) {
    if (hash01('turnip-spike', day) < 0.22) return 250 + Math.floor(hash01('turnip-spike2', day) * 351);
    return 60 + Math.floor(hash01('turnip-sell', day) * 81);
  }
  return 0;
}
export const turnipWeek = (day: number) => Math.floor((day - 1) / 7);

// ---------- Money rock: hit it while the sparkle lasts, up to 8 times a day ----------

export const MONEY_ROCK_HITS = 8, MONEY_ROCK_GAP = 4;
export function moneyRockHit(w: World, p: Player): string {
  const L = life(w);
  const day = dayOf(w.elapsed);
  if (L.moneyRock.day !== day) L.moneyRock = {day, hits: 0, lastAt: 0};
  const rock = L.moneyRock;
  if (rock.hits >= MONEY_ROCK_HITS) return '오늘은 바위가 다 빛을 잃었어요. 내일 다시! (하루 8번)';
  // Hitting quickly keeps the streak alive; slow down and the counter restarts.
  if (rock.hits > 0 && w.elapsed - rock.lastAt > MONEY_ROCK_GAP) rock.hits = 0;
  rock.hits++;
  rock.lastAt = w.elapsed;
  const bells = rock.hits * 100;
  L.bells += bells;
  lifeEvent(w, p, 'sell');
  p.gesture = {kind: 'mine', remaining: .9, duration: .9, item: p.equipped || 'axe', target: 'money-rock'};
  return `콩! 벨 ${bells}개가 튀어나왔어요! (${rock.hits}/${MONEY_ROCK_HITS})${rock.hits === MONEY_ROCK_HITS ? ' 마지막 금화까지 찾았어요!' : ' 빨리 다시 두드려요!'}`;
}

// ---------- Balloon gift: one floating present a day — pop it with a weapon ----------

export const balloonSpots = [
  {x: 1000, y: 760}, {x: 1420, y: 700}, {x: 1800, y: 640}, {x: 1500, y: 900}, {x: 2200, y: 760},
].map((p, i) => ({id: `balloon-${i}`, ...g(p.x, p.y)}));
export function balloonToday(w: World): {x: number; y: number} | undefined {
  const L = life(w);
  const day = dayOf(w.elapsed);
  if (day < 2 || L.balloon.day !== day || L.balloon.shot) return undefined;
  const spot = balloonSpots[Math.floor(hash01('balloon', day) * balloonSpots.length)];
  return {x: spot.x, y: spot.y - 60};
}
export const balloonRewards: Array<{give: Partial<Record<Item, number>>; text: string}> = [
  {give: {flowerSeed: 3}, text: '꽃씨 3봉지'},
  {give: {worm: 5}, text: '지렁이 미끼 5개'},
  {give: {ration: 1}, text: '비상식량 1개'},
  {give: {arrow: 10}, text: '화살 10개'},
  {give: {ironOre: 2}, text: '철광석 2개'},
];
export function popBalloon(w: World, p: Player): string {
  const L = life(w);
  const day = dayOf(w.elapsed);
  if (L.balloon.day !== day || L.balloon.shot) return '오늘의 풍선은 이미 사라졌어요.';
  L.balloon.shot = true;
  const reward = balloonRewards[Math.floor(hash01('balloon-gift', day) * balloonRewards.length)];
  for (const [item, n] of Object.entries(reward.give)) giveItem(p, item as Item, n!);
  let extra = '';
  if (hash01('balloon-recipe', day) < 0.3) {
    const key = unlockRandomRecipe(w, p, `balloon-${day}`);
    if (key) extra = ` 그리고 ${recipeName(key)} 레시피도!`;
  }
  lifeEvent(w, p, 'message');
  p.gesture = {kind: 'pickup', remaining: 1, duration: 1, item: Object.keys(reward.give)[0] as Item, rewards: {...reward.give}};
  return `풍선을 격추했어요! 떨어진 상자 안에는 ${reward.text}${extra}이(가) 들어 있었어요!`;
}

// ---------- Crafting recipes, discovery and tool durability ----------

// Full workbench recipe book. Lives here so both this module and shared.ts (which re-exports it
// as `recipes`) share one table without an import cycle.
export const craftRecipes: Partial<Record<string, Partial<Record<string, number>>>> = {
  ...lifeRecipes,
  leatherVest: {hide: 3, fiber: 2}, shovel: {wood: 2, stone: 2, fiber: 1}, torch: {wood: 2, fiber: 1},
  arrow: {wood: 1, stone: 1}, cookedMeat: {rawMeat: 1, wood: 1}, rod: {wood: 3, fiber: 2},
  woodKnife: {wood: 2}, woodSpear: {wood: 3}, bow: {wood: 3, fiber: 3}, stoneKnife: {stone: 2, fiber: 1},
  stoneSpear: {stone: 2, wood: 2, fiber: 2}, axe: {stone: 3, wood: 2, fiber: 2}, pickaxe: {stone: 3, wood: 3, fiber: 2},
  bottle: {coconut: 1, fiber: 2}, pot: {stone: 4, wood: 2}, basket: {fiber: 4, wood: 1}, worm: {fiber: 2},
  shrimp: {rawFish: 1}, ration: {coconut: 2}, fish: {rawFish: 1, wood: 1}, grilledReef: {reefFish: 1, wood: 1}, water: {rawWater: 1, wood: 1},
};
// Recipes known from the first morning: survival water, basic gathering and one cutting tool.
// Everything else is discovered from bottle letters, friend requests and the museum exchange.
export const baseRecipes: string[] = ['bottle', 'pot', 'water', 'torch', 'shovel', 'rod', 'woodKnife', 'axe', 'worm', 'ration'];
// Display names for craftables that are not life items (lifeItemNames covers the rest).
export const craftNames: Partial<Record<string, string>> = {
  shovel: '삽', rod: '낚싯대', torch: '횃불', woodKnife: '나무칼', stoneKnife: '돌칼', woodSpear: '나무창', stoneSpear: '돌창',
  axe: '돌도끼', pickaxe: '돌곡괭이', bow: '활', arrow: '화살', bottle: '물병', pot: '냄비', basket: '바구니',
  water: '안전한 물', ration: '비상식량', worm: '지렁이 미끼', shrimp: '새우 미끼', rawMeat: '생고기',
  cookedMeat: '구운 고기', grilledReef: '구운 산호 생선', fish: '구운 생선', leatherVest: '가죽 조끼',
};
export function recipeName(key: string) {
  return craftNames[key] || (lifeItemNames as Record<string, string>)[key] || key;
}
export function knowsRecipe(w: World, key: string) {
  return life(w).recipes.includes(key);
}
// Discover one unknown recipe deterministically; returns its display name so the caller's message
// can include it (every call site already runs inside withRewards).
export function unlockRandomRecipe(w: World, p: Player | undefined, seed: string): string | undefined {
  const L = life(w);
  const locked = Object.keys(craftRecipes).filter(k => !L.recipes.includes(k));
  if (!locked.length) return undefined;
  const key = locked[Math.floor(hash01('recipe', seed, L.recipes.length) * locked.length)];
  L.recipes.push(key);
  return key;
}

// Gather tools wear out with use and break at their limit (our own 300-second-day values).
// Weapons and one-off helpers stay unbreakable for now — noted in the plan document.
export const toolDurability: Partial<Record<Item, number>> = {
  shovel: 25, rod: 20, bugNet: 20, wateringCan: 20, axe: 40, pickaxe: 40,
};
export const repairCosts: Partial<Record<Item, Partial<Record<string, number>>>> = {
  shovel: {wood: 1, stone: 1}, rod: {wood: 1, fiber: 1}, bugNet: {wood: 1, fiber: 1},
  wateringCan: {stone: 1, fiber: 1}, axe: {wood: 1, stone: 1}, pickaxe: {stone: 2},
};
export function usesLeft(p: Player, tool: Item) {
  const max = toolDurability[tool];
  if (!max) return Infinity;
  return Math.max(0, max - (p.toolUse?.[tool] || 0));
}
export function wearTool(w: World, p: Player, tool: Item | undefined = p.equipped) {
  if (!tool) return;
  const max = toolDurability[tool];
  if (!max || !(p.bag[tool] || 0)) return;
  const uses = (p.toolUse ??= {});
  uses[tool] = (uses[tool] || 0) + 1;
  if (uses[tool]! < max) return;
  p.bag[tool]!--;
  if (p.equipped === tool && !p.bag[tool]) p.equipped = undefined;
  uses[tool] = 0;
  announce(p, `${josa(recipeName(tool), '은/는')} 망가졌어요! 제작대에서 새로 만들거나 수리해요.`);
}
// Repair a worn (not yet broken) tool back to full durability. The workbench proximity check
// happens in shared.act(); this only validates the tool and its materials.
export function repairTool(w: World, p: Player, arg: unknown): string {
  const tool = (typeof arg === 'string' ? arg : '') as Item;
  if (!toolDurability[tool]) return '수리할 수 있는 도구가 아니에요.';
  if (!(p.bag[tool] || 0)) return '가방에 그 도구가 없어요.';
  const uses = p.toolUse?.[tool] || 0;
  if (!uses) return `${recipeName(tool)}은 아주 튼튼해요. 수리할 필요가 없어요.`;
  const cost = repairCosts[tool] || {};
  for (const [item, n] of Object.entries(cost)) if ((p.bag[item as Item] || 0) < n!) return `${recipeName(item)} 재료가 부족해요.`;
  for (const [item, n] of Object.entries(cost)) takeItem(p, item as Item, n!);
  p.toolUse![tool] = 0;
  p.gesture = {kind: 'craft', remaining: 1.4, duration: 1.4, item: tool, target: 'workbench'};
  return `${recipeName(tool)}을(를) 고쳤어요! 내구도가 가득 찼어요.`;
}

// ---------- Island villagers: neighbours that move in over the days ----------

export type VillagerSpecies = 'rabbit' | 'squirrel' | 'turtle';
export type Villager = {id: string; name: string; species: VillagerSpecies; arrivedDay: number};
export type VillagerCandidate = {id: string; name: string; species: VillagerSpecies; speciesName: string; icon: string; day: number; ear: 'long' | 'tuft' | 'none'; color: number};
export const villagerCandidates: VillagerCandidate[] = [
  {id: 'villager-tosuni', name: '토순이', species: 'rabbit', speciesName: '토끼', icon: '🐰', day: 3, ear: 'long', color: 0xd9c4ad},
  {id: 'villager-darong', name: '다롱이', species: 'squirrel', speciesName: '다람쥐', icon: '🐿️', day: 7, ear: 'tuft', color: 0xc98d5a},
  {id: 'villager-geobuk', name: '거북박사', species: 'turtle', speciesName: '거북이', icon: '🐢', day: 12, ear: 'none', color: 0x7fa865},
];
// Home plots beside the camp; verified standable in tests alongside the other life points.
export const villagerHomes = [{x: 1560, y: 760}, {x: 1690, y: 640}, {x: 1430, y: 890}].map((p, i) => ({id: `villager-home-${i}`, ...g(p.x, p.y)}));
export function villagerHome(id: string) {
  const i = villagerCandidates.findIndex(c => c.id === id);
  return villagerHomes[i] ?? villagerHomes[0];
}
export function villagersOf(w: World): Villager[] {
  return life(w).villagers;
}
// Villager landmarks use the villager's name as their id, so match either field.
export function villagerByName(w: World, nameOrId: string): Villager | undefined {
  return life(w).villagers.find(v => v.name === nameOrId || v.id === nameOrId);
}

export type Flower = 'hibiscus' | 'plumeria' | 'pinkHibiscus';
export type Plot = {stage: number; wet: boolean; stageAt: number; flower: Flower};
export type Friendship = {points: number; talkDay: number; giftDay: number; requestDay: number; rewarded: number};
export type LifeState = {
  bugs: Bug[];
  shells: Record<string, {item?: LifeItem; readyAt: number}>;
  dug: string[];
  fruit: Record<string, {count: number; readyAt: number; shakes: number}>;
  plots: Plot[];
  museum: string[];
  miles: number;
  stats: Partial<Record<LifeStat, number>>;
  achieved: string[];
  daily: {day: number; base: Partial<Record<LifeStat, number>>; done: string[]};
  bottleDay: number;
  // Diving spots: when each bubble spot refills.
  sea: Record<string, number>;
  // Friendship per friend name (김여름 + registered friends).
  friendship: Record<string, Friendship>;
  // Island money earned at the shop.
  bells: number;
  // Seasonal event progress for the current event day.
  event: {day: number; points: number; claimed: number[]};
  // Last game-second window a shooting star wish was used (one wish per star).
  wishAt: number;
  // Data layout version for upgrading older saves/rooms.
  schema?: number;
  // Workbench recipes this island has discovered (always contains baseRecipes).
  recipes: string[];
  // Animal neighbours that have moved in (up to 3, on fixed days).
  villagers: Villager[];
  // Last day the morning weather was announced.
  weatherDay: number;
  // Last day a season change was announced.
  seasonDay: number;
  // Turnip market stock and the week it was bought in (rot when a later week starts).
  turnip: {count: number; week: number};
  // Daily money-rock streak and today's balloon gift.
  moneyRock: {day: number; hits: number; lastAt: number};
  balloon: {day: number; shot: boolean};
};

export function emptyLife(): LifeState {
  return {
    bugs: bugSpots.map(s => ({id: s.id, species: s.species, x: s.x, y: s.y, homeX: s.x, homeY: s.y, state: 'idle', respawnAt: 0, face: 1})),
    shells: Object.fromEntries(shellSpots.map(s => [s.id, {item: pickShell(s.id), readyAt: 0}])),
    dug: [],
    fruit: Object.fromEntries(fruitTrees.map(t => [t.id, {count: t.palm ? 2 : 3, readyAt: 0, shakes: 0}])),
    plots: gardenPlots.map(() => ({stage: -1, wet: false, stageAt: 0, flower: 'hibiscus'})),
    museum: [],
    miles: 0,
    stats: {},
    achieved: [],
    daily: {day: 1, base: {}, done: []},
    bottleDay: 0,
    sea: {},
    friendship: {},
    bells: 0,
    event: {day: 0, points: 0, claimed: []},
    wishAt: -1,
    recipes: [...baseRecipes],
    villagers: [],
    weatherDay: 0,
    seasonDay: 0,
    turnip: {count: 0, week: 0},
    moneyRock: {day: 0, hits: 0, lastAt: 0},
    balloon: {day: 0, shot: false},
    schema: 5,
  };
}

// Bump when LifeState gains fields. Older saves and rooms persisted by an older server are upgraded
// in place by filling every missing field with its default.
export const LIFE_SCHEMA = 5;
export function life(w: World): LifeState {
  const L = (w.life ??= emptyLife());
  if (L.schema !== LIFE_SCHEMA) upgradeLife(L);
  return L;
}
export function upgradeLife(L: LifeState) {
  const defaults = emptyLife() as unknown as Record<string, unknown>;
  const target = L as unknown as Record<string, unknown>;
  for (const [key, value] of Object.entries(defaults)) if (target[key] === undefined || target[key] === null) target[key] = value;
  L.schema = LIFE_SCHEMA;
}

function announce(p: Player, text: string) {
  p.notice = text;
  p.noticeSeq = (p.noticeSeq || 0) + 1;
}
// Same bookkeeping as shared put(): bag, discovery record and the floating reward icon.
function giveItem(p: Player, item: Item, n = 1) {
  p.bag[item] = (p.bag[item] || 0) + n;
  (p.collected ??= {})[item] = (p.collected?.[item] || 0) + n;
  p.reward = {item, n, seq: (p.reward?.seq || 0) + 1};
}
function takeItem(p: Player, item: Item, n = 1) {
  if ((p.bag[item] || 0) < n) return false;
  p.bag[item] = (p.bag[item] || 0) - n;
  if (p.equipped === item && !p.bag[item]) p.equipped = undefined;
  return true;
}

// Other modules (seasonal events) can listen to progress events without an import cycle.
let eventHook: ((w: World, p: Player | undefined, stat: LifeStat) => void) | undefined;
export function setLifeEventHook(hook: typeof eventHook) {
  eventHook = hook;
}

// While an interaction runs, reward texts are collected and appended to its message instead.
let collecting: string[] | undefined;

// Record progress, then pay out achievements and today's tasks exactly once each.
// Returns the reward text. Gameplay hooks outside this module announce it; interactions here append it
// to their own message so the player sees both what happened and what it earned.
export function lifeEvent(w: World, p: Player | undefined, stat: LifeStat, n = 1, announceIt = true): string {
  const L = life(w);
  L.stats[stat] = (L.stats[stat] || 0) + n;
  if (stat === 'bug') eventHook?.(w, p, stat);
  const messages: string[] = [];
  for (const a of achievements) {
    if (a.stat === stat && !L.achieved.includes(a.id) && (L.stats[stat] || 0) >= a.n) {
      L.achieved.push(a.id);
      L.miles += a.miles;
      messages.push(`🏅 ${a.label} +${a.miles}마일`);
    }
  }
  for (const t of dailyTasks(L.daily.day)) {
    if (t.stat === stat && !L.daily.done.includes(t.id) && (L.stats[stat] || 0) - (L.daily.base[stat] || 0) >= t.n) {
      L.daily.done.push(t.id);
      L.miles += DAILY_MILES;
      messages.push(`오늘의 과제 완료: ${t.label} +${DAILY_MILES}마일`);
    }
  }
  const text = messages.join(' · ');
  if (text && collecting) collecting.push(text);
  else if (p && text && announceIt) announce(p, text);
  return text;
}

// ---------- Simulation step ----------

export function stepLife(w: World, outdoors: Player[], dt: number) {
  const L = life(w);
  const day = dayOf(w.elapsed);
  // New day: fresh daily tasks measured from today's starting stats.
  if (L.daily.day !== day) L.daily = {day, base: {...L.stats}, done: []};
  // Morning news bundle: weather, season, rotting turnips and new neighbours announce together
  // so no message overwrites another.
  const morning: string[] = [];
  const weather = weatherOf(day);
  if (L.weatherDay !== day) {
    L.weatherDay = day;
    if (weather === 'rain' || weather === 'storm') morning.push(weather === 'storm' ? '⛈ 오늘은 폭풍우! 밤에는 꼭 캠프 불빛 곁에 있어요.' : '🌧 아침부터 비가 와요. 꽃밭에 물을 줄 필요가 없어요!');
  }
  // Season change greeting on the first morning of each quarter of the 100-day year.
  const season = seasonOf(day);
  if (L.seasonDay !== day && (day - 1) % 25 === 0) {
    L.seasonDay = day;
    morning.push(seasonNames[season].hello);
  }
  // Turnips bought last week rot on the new week's first morning.
  if (L.turnip.count > 0 && turnipWeek(day) > L.turnip.week) {
    L.turnip = {count: 0, week: turnipWeek(day)};
    morning.push('😖 지난주 무가 상했어요… 이번 주엔 일찍 팔아요!');
  }
  if (weather === 'rain' || weather === 'storm') {
    L.plots.forEach(plot => {
      if (plot.stage >= 0 && !plot.wet) {
        plot.wet = true;
        plot.stageAt = w.elapsed;
      }
    });
  }
  // Neighbours move in on their fixed days (deterministic, so saves and co-op rooms agree).
  for (const c of villagerCandidates) {
    if (day >= c.day && !L.villagers.some(v => v.id === c.id)) {
      L.villagers.push({id: c.id, name: c.name, species: c.species, arrivedDay: day});
      morning.push(`🏝 ${josa(c.name, '이/가')} 이 섬에 이사를 왔어요! 캠프 근처 작은 집에서 말을 걸어 보세요.`);
    }
  }
  // Today's balloon gift becomes available every morning (from day 2).
  if (L.balloon.day !== day) L.balloon = {day, shot: false};
  if (morning.length) for (const p of outdoors) announce(p, morning.join('\n'));
  // Forget dig records older than yesterday so the save stays small.
  if (L.dug.length > 40) L.dug = L.dug.filter(k => Number(k.split(':')[0]) >= day - 1);

  for (const b of L.bugs) {
    const info = bugInfo[b.species];
    if (b.state !== 'idle') {
      if (w.elapsed >= b.respawnAt) {
        b.state = 'idle';
        b.x = b.homeX;
        b.y = b.homeY;
      } else if (b.state === 'fled') {
        // A startled bug zips away before vanishing.
        b.x += b.face * 220 * dt;
        b.y -= 60 * dt;
      }
      continue;
    }
    if (!bugActive(b.species, w.elapsed)) continue;
    // Gentle wandering around the home point (flying bugs loop, crabs shuffle along the sand).
    if (info.wander) {
      const t = w.elapsed * (b.species === 'dragonfly' ? 0.9 : 0.55) + hash01(b.id) * 10;
      const nx = b.homeX + Math.cos(t) * info.wander;
      const ny = b.homeY + Math.sin(t * 1.7) * info.wander * (b.species === 'hermitCrab' ? 0.2 : 0.45);
      if (Math.abs(nx - b.x) > 0.01) b.face = nx < b.x ? -1 : 1;
      b.x = nx;
      b.y = ny;
    }
    // Approach rule: running nearby or walking too close startles the bug.
    for (const p of outdoors) {
      const d = Math.hypot(p.x - b.x, p.y - b.y);
      const running = !!p.moving && p.input.run;
      if ((running && d < RUN_SCARE) || (p.moving && !p.input.sneak && d < info.flee)) {
        b.state = 'fled';
        b.respawnAt = w.elapsed + 45;
        b.face = b.x < p.x ? -1 : 1;
        announce(p, `${josa(lifeItemNames[b.species], '이/가')} 놀라서 달아났어요. 다음에는 천천히 걸어서 다가가요.`);
        break;
      }
    }
  }

  for (const s of shellSpots) {
    const state = L.shells[s.id] ??= {item: pickShell(s.id), readyAt: 0};
    if (!state.item && w.elapsed >= state.readyAt) state.item = pickShell(`${s.id}:${Math.floor(w.elapsed)}`);
  }

  for (const t of fruitTrees) {
    const f = L.fruit[t.id] ??= {count: t.palm ? 2 : 3, readyAt: 0, shakes: 0};
    if (!f.count && w.elapsed >= f.readyAt) f.count = t.palm ? 2 : 3;
  }

  L.plots.forEach(plot => {
    if (plot.stage >= 0 && plot.stage < 3 && plot.wet && w.elapsed - plot.stageAt >= growSecondsFor(day)) {
      plot.stage++;
      plot.wet = false;
      plot.stageAt = w.elapsed;
    }
  });
  breedFlowers(w, outdoors);
}

// ---------- Flower breeding ----------

// Plot neighbours in the camp garden: 0-1-2 in a row, 3 below 1.
export const plotNeighbours: number[][] = [[1], [0, 2, 3], [1], [1]];
// A watered bloom that stays wet for GROW_SECONDS spreads a new seedling into an empty neighbour.
// If a bloom of the other colour also borders that empty plot, red + white can give the pink hybrid (50%).
export function breedFlowers(w: World, players: Player[] = []) {
  const L = life(w);
  L.plots.forEach((plot, i) => {
    if (plot.stage < 3 || !plot.wet || w.elapsed - plot.stageAt < GROW_SECONDS) return;
    plot.wet = false;
    plot.stageAt = w.elapsed;
    const empty = plotNeighbours[i].find(j => L.plots[j].stage < 0);
    if (empty === undefined) return;
    // The other parent is any bloom of a different flower that also borders the empty plot.
    const partner = plotNeighbours[empty].map(j => L.plots[j]).find(q => q !== plot && q.stage >= 3 && q.flower !== plot.flower);
    const pair = partner && [plot.flower, partner.flower].sort().join('+') === 'hibiscus+plumeria';
    const child: Flower = pair && hash01('breed', i, Math.floor(w.elapsed)) < 0.5 ? 'pinkHibiscus' : plot.flower;
    L.plots[empty] = {stage: 0, wet: false, stageAt: w.elapsed, flower: child};
    if (child === 'pinkHibiscus') {
      lifeEvent(w, players[0], 'hybrid');
      for (const p of players) announce(p, '꽃밭에 분홍 히비스커스 새싹이 돋았어요! 교배 성공!');
    }
  });
}

// ---------- World targets (clickable / E-key interactions) ----------

export function lifeTargets(w?: World): Landmark[] {
  if (!w) return [{id: MUSEUM.id, name: '섬 자연관 · 마일리지 교환대', x: MUSEUM.x, y: MUSEUM.y, kind: 'museum'}];
  const L = life(w);
  const day = dayOf(w.elapsed);
  const out: Landmark[] = [{id: MUSEUM.id, name: '섬 자연관 · 마일리지 교환대', x: MUSEUM.x, y: MUSEUM.y, kind: 'museum'},
    {id: BOARD.id, name: '광장 게시판 · 오늘의 소식', x: BOARD.x, y: BOARD.y, kind: 'board'}];
  for (const b of L.bugs) if (b.state === 'idle' && bugActive(b.species, w.elapsed)) out.push({id: b.id, name: lifeItemNames[b.species], x: b.x, y: b.y, kind: 'bug'});
  for (const s of shellSpots) {
    const item = L.shells[s.id]?.item;
    if (item) out.push({id: s.id, name: lifeItemNames[item], x: s.x, y: s.y, kind: 'shell'});
  }
  for (const b of buriedToday(day)) if (!L.dug.includes(`${day}:${b.id}`)) out.push({id: b.id, name: '수상한 X 표시 · 삽으로 파기', x: b.x, y: b.y, kind: 'buried'});
  for (const t of fruitTrees) {
    const f = L.fruit[t.id];
    out.push({id: t.id, name: f?.count ? `${t.palm ? '코코넛' : '망고'} 나무 · 흔들기` : '열매가 다시 열리는 중', x: t.x, y: t.y, kind: 'fruit'});
  }
  gardenPlots.forEach((pl, i) => {
    const s = L.plots[i]?.stage ?? -1;
    out.push({id: pl.id, name: s < 0 ? '빈 꽃밭' : s >= 3 ? '활짝 핀 꽃' : `자라는 꽃 ${s + 1}/3`, x: pl.x, y: pl.y, kind: 'plot'});
  });
  if (L.bottleDay !== day) {
    const spot = shellSpots[Math.floor(hash01('bottle', day) * shellSpots.length)];
    out.push({id: 'message-bottle', name: '떠밀려 온 병편지', x: spot.x + 28, y: spot.y + 10, kind: 'message'});
  }
  return out;
}

export const lifeKinds = ['bug', 'shell', 'buried', 'fruit', 'plot', 'museum', 'message'];

// ---------- Interactions ----------

export function lifeInteract(w: World, p: Player, l: Landmark): string | undefined {
  return withRewards(() => interactInner(w, p, l));
}
export function lifeAction(w: World, p: Player, action: string, arg: unknown): string {
  return withRewards(() => actionInner(w, p, action, arg)) || '';
}
export function withRewards<T extends string | undefined>(run: () => T): T {
  collecting = [];
  try {
    const message = run();
    const bonus = collecting.join(' · ');
    return (message && bonus ? `${message} · ${bonus}` : message) as T;
  } finally {
    collecting = undefined;
  }
}

function interactInner(w: World, p: Player, l: Landmark): string | undefined {
  const L = life(w);
  const day = dayOf(w.elapsed);
  switch (l.kind) {
    case 'bug': {
      const b = L.bugs.find(v => v.id === l.id);
      if (!b || b.state !== 'idle') return '곤충이 보이지 않아요.';
      if (p.equipped !== 'bugNet') return p.bag.bugNet ? '가방에서 곤충망을 손에 들어 주세요.' : '제작대에서 곤충망(목재 2 · 풀줄기 3)을 만들어요.';
      b.state = 'caught';
      b.respawnAt = w.elapsed + 90;
      p.face = b.x < p.x ? -1 : 1;
      p.gesture = {kind: 'net', remaining: 0.75, duration: 0.75, item: 'bugNet', target: b.id, rewards: {[b.species]: 1}};
      lifeEvent(w, p, 'bug');
      wearTool(w, p, 'bugNet');
      return `${josa(lifeItemNames[b.species], '을/를')} 잡았다! 자연관에 기증해 보세요.`;
    }
    case 'shell': {
      const s = L.shells[l.id];
      if (!s?.item) return '파도가 새 조개를 밀어 올 때까지 기다려요.';
      const item = s.item;
      s.item = undefined;
      s.readyAt = w.elapsed + 150;
      p.gesture = {kind: 'pickup', remaining: 0.9, duration: 0.9, item, target: l.id, rewards: {[item]: 1}};
      lifeEvent(w, p, 'shell');
      return `${josa(lifeItemNames[item], '을/를')} 주웠어요.`;
    }
    case 'buried': {
      if (p.equipped !== 'shovel') return p.bag.shovel ? '가방에서 삽을 손에 들어 주세요.' : '제작대에서 삽을 만들어 X 표시를 파 보세요.';
      const key = `${day}:${l.id}`;
      if (L.dug.includes(key)) return '이미 파낸 곳이에요.';
      L.dug.push(key);
      const found = buriedFind(day, l.id);
      p.gesture = {kind: 'dig', remaining: 1.3, duration: 1.3, item: 'shovel', target: l.id, rewards: {[found]: 1}};
      lifeEvent(w, p, 'dig');
      wearTool(w, p, 'shovel');
      if (found === 'fossil') lifeEvent(w, p, 'fossil');
      return found === 'fossil' ? '화석이 나왔어요! 자연관에서 감정을 받아요.' : found === 'clay' ? '점토가 나왔어요.' : '반짝이는 옛날 동전을 찾았어요!';
    }
    case 'fruit': {
      const t = fruitTrees.find(v => v.id === l.id);
      const f = L.fruit[l.id];
      if (!t || !f) return '나무를 살펴봤어요.';
      f.shakes++;
      p.face = t.x < p.x ? -1 : 1;
      if (!f.count) {
        p.gesture = {kind: 'shake', remaining: 0.9, duration: 0.9, target: l.id};
        return `열매가 없어요. ${Math.max(1, Math.ceil(f.readyAt - w.elapsed))}초 뒤 다시 열려요.`;
      }
      const fruit: Item = t.palm ? 'coconut' : 'mango';
      const n = f.count;
      f.count = 0;
      f.readyAt = w.elapsed + FRUIT_REGROW;
      p.gesture = {kind: 'shake', remaining: 1.1, duration: 1.1, item: fruit, target: l.id, rewards: {[fruit]: n}};
      lifeEvent(w, p, 'shake');
      lifeEvent(w, p, 'fruit', n);
      // A wasp nest sometimes drops; holding the net lets you swat them away.
      if (hash01('wasp', l.id, f.shakes) < 0.12) {
        if (p.equipped === 'bugNet') return `${lifeItemNames[fruit as LifeItem] || '코코넛'} ${n}개와 벌집이 떨어졌어요! 곤충망으로 벌을 쫓아냈어요.`;
        p.hp = Math.max(1, p.hp - 6);
        p.hurtAt = w.elapsed;
        return `열매 ${n}개와 함께 벌집이 떨어졌어요! 벌에 쏘였어요. 곤충망을 들고 흔들면 막을 수 있어요.`;
      }
      return `나무를 흔들어 ${t.palm ? '코코넛' : '망고'} ${n}개를 얻었어요!`;
    }
    case 'plot': {
      const i = gardenPlots.findIndex(v => v.id === l.id);
      const plot = L.plots[i];
      if (!plot) return '꽃밭을 살펴봤어요.';
      if (plot.stage < 0) {
        if (!takeItem(p, 'flowerSeed')) return '꽃씨가 필요해요. 병편지나 자연관 교환대에서 얻을 수 있어요.';
        plot.stage = 0;
        plot.wet = false;
        plot.stageAt = w.elapsed;
        plot.flower = hash01('flower', i, w.elapsed) < 0.5 ? 'hibiscus' : 'plumeria';
        p.gesture = {kind: 'plant', remaining: 1, duration: 1, item: 'flowerSeed', target: l.id};
        lifeEvent(w, p, 'plant');
        return '꽃씨를 심었어요. 물뿌리개로 물을 주면 자라요.';
      }
      if (plot.stage >= 3 && p.equipped === 'wateringCan') {
        if (plot.wet) return '활짝 핀 꽃이 촉촉해요. 옆 빈칸에 새 꽃이 퍼질지 지켜봐요.';
        plot.wet = true;
        plot.stageAt = w.elapsed;
        p.face = gardenPlots[i].x < p.x ? -1 : 1;
        p.gesture = {kind: 'water', remaining: 1.2, duration: 1.2, item: 'wateringCan', target: l.id};
        lifeEvent(w, p, 'water');
        wearTool(w, p, 'wateringCan');
        return '핀 꽃에 물을 줬어요. 옆 빈칸으로 꽃이 퍼질 수 있어요. 빨강·하양이 이웃하면 새 색이 필지도!';
      }
      if (plot.stage >= 3) {
        const flower = plot.flower;
        plot.stage = -1;
        plot.wet = false;
        p.gesture = {kind: 'pickup', remaining: 0.9, duration: 0.9, item: flower, target: l.id, rewards: {[flower]: 1, flowerSeed: 1}};
        lifeEvent(w, p, 'harvest');
        return `${josa(lifeItemNames[flower], '을/를')} 땄어요! 씨앗 1개도 받았어요.`;
      }
      if (p.equipped !== 'wateringCan') return `새싹 ${plot.stage + 1}/3 단계 · 물뿌리개를 들고 물을 주세요.`;
      if (plot.wet) return `흙이 촉촉해요. ${Math.max(1, Math.ceil(growSecondsFor(day) - (w.elapsed - plot.stageAt)))}초 뒤 자라요.`;
      plot.wet = true;
      plot.stageAt = w.elapsed;
      p.face = gardenPlots[i].x < p.x ? -1 : 1;
      p.gesture = {kind: 'water', remaining: 1.2, duration: 1.2, item: 'wateringCan', target: l.id};
      lifeEvent(w, p, 'water');
      wearTool(w, p, 'wateringCan');
      return '물을 줬어요. 조금 뒤 한 단계 자라요.';
    }
    case 'message': {
      if (L.bottleDay === day) return '오늘의 병편지는 이미 읽었어요.';
      L.bottleDay = day;
      p.gesture = {kind: 'pickup', remaining: 1, duration: 1, item: 'flowerSeed', target: l.id, rewards: {flowerSeed: 2}};
      lifeEvent(w, p, 'message');
      const recipe = unlockRandomRecipe(w, p, `bottle-${day}`);
      return `${bottleTips[(day - 1) % bottleTips.length]} · 꽃씨 2봉지가 들어 있었어요!${recipe ? ` 그리고 접힌 종이에는 ${recipeName(recipe)} 레시피가!` : ''}`;
    }
    case 'museum':
      return '자연관: 기증, 도감, 마일리지 과제와 교환대를 이용할 수 있어요.';
    case 'board':
      return '광장 게시판: 화면을 누르거나 친구 버튼 옆에서 오늘의 소식을 읽어요.';
  }
  return undefined;
}

// Museum and miles actions (sent as 'life-donate' / 'life-exchange' / 'life-sell').
function actionInner(w: World, p: Player, action: string, arg: unknown): string {
  const L = life(w);
  if (Math.hypot(p.x - MUSEUM.x, p.y - MUSEUM.y) > 200) return '자연관 가까이에서 이용해요.';
  if (action === 'life-donate') {
    const item = arg as Item;
    if (item === 'fossil') {
      if (!takeItem(p, 'fossil')) return '감정 전 화석이 없어요.';
      const left = museumCatalog.filter(e => e.cat === 'fossil' && !L.museum.includes(e.key));
      if (!left.length) {
        L.miles += 30;
        return '모든 화석을 전시했어요. 연구비로 30마일을 받았어요.';
      }
      const found = left[Math.floor(hash01('appraise', w.elapsed, L.museum.length) * left.length)];
      L.museum.push(found.key);
      L.miles += DONATE_MILES;
      lifeEvent(w, p, 'donate');
      return `감정 결과: ${found.name}! 자연관에 전시했어요. +${DONATE_MILES}마일`;
    }
    const entry = museumCatalog.find(e => e.item === item);
    if (!entry) return '기증할 수 없는 물건이에요.';
    if (L.museum.includes(entry.key)) return `${josa(entry.name, '은/는')} 이미 전시 중이에요.`;
    if (!takeItem(p, item)) return '가방에 없어요.';
    L.museum.push(entry.key);
    L.miles += DONATE_MILES;
    lifeEvent(w, p, 'donate');
    return `${josa(entry.name, '을/를')} 자연관에 기증했어요! +${DONATE_MILES}마일`;
  }
  if (action === 'life-exchange') {
    const offer = exchangeOffers.find(o => o.id === arg);
    if (!offer) return '교환할 물건을 골라요.';
    if (L.miles < offer.cost) return `마일리지가 ${offer.cost - L.miles} 부족해요.`;
    L.miles -= offer.cost;
    if (offer.id === 'recipe') {
      const key = unlockRandomRecipe(w, p, `exchange-${dayOf(w.elapsed)}-${L.recipes.length}`);
      if (!key) {
        L.miles += offer.cost;
        return '새로운 레시피를 모두 찾았어요. 마일리지는 돌려드렸어요.';
      }
      return `수수께끼 레시피를 펼쳤더니 ${recipeName(key)}! 이제 제작대에서 만들 수 있어요. -${offer.cost}마일`;
    }
    for (const [item, n] of Object.entries(offer.give)) giveItem(p, item as Item, n!);
    return `${josa(offer.label, '을/를')} 받았어요. -${offer.cost}마일`;
  }
  if (action === 'life-sell') {
    if (!takeItem(p, 'oldCoin')) return '옛날 동전이 없어요.';
    L.miles += COIN_MILES;
    return `옛날 동전을 연구용으로 맡기고 ${COIN_MILES}마일을 받았어요.`;
  }
  return '알 수 없는 요청이에요.';
}

// ---------- Save restore ----------

export function restoreLife(source: unknown): LifeState {
  const L = emptyLife();
  if (!source || typeof source !== 'object') return L;
  const s = source as Record<string, any>;
  const num = (v: unknown, lo: number, hi: number, d: number) => typeof v === 'number' && Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : d;
  const catalog = new Set(museumCatalog.map(e => e.key));
  L.miles = Math.floor(num(s.miles, 0, 1e7, 0));
  L.bottleDay = Math.floor(num(s.bottleDay, 0, 1e6, 0));
  if (Array.isArray(s.museum)) L.museum = [...new Set(s.museum.filter((k: unknown) => typeof k === 'string' && catalog.has(k)))] as string[];
  if (Array.isArray(s.achieved)) L.achieved = s.achieved.filter((k: unknown) => typeof k === 'string' && achievements.some(a => a.id === k));
  if (Array.isArray(s.dug)) L.dug = s.dug.filter((k: unknown) => typeof k === 'string' && /^\d+:buried-\d+$/.test(k as string)).slice(-60);
  const statKeys = new Set(['bug', 'shell', 'shake', 'fruit', 'dig', 'fossil', 'donate', 'plant', 'water', 'harvest', 'fish', 'chop', 'message', 'dive', 'gift', 'request', 'sell', 'wish', 'hybrid']);
  L.bells = Math.floor(num(s.bells, 0, 1e9, 0));
  L.wishAt = Math.floor(num(s.wishAt, -1, 1e9, -1));
  if (s.sea && typeof s.sea === 'object') for (const [k, v] of Object.entries(s.sea)) if (/^sea-\d+$/.test(k)) L.sea[k] = num(v, 0, 1e9, 0);
  if (s.friendship && typeof s.friendship === 'object') for (const [name, v] of Object.entries(s.friendship as Record<string, any>).slice(0, 20)) {
    if (typeof name !== 'string' || name.length > 12 || !v || typeof v !== 'object') continue;
    L.friendship[name] = {points: Math.floor(num(v.points, 0, 999, 0)), talkDay: Math.floor(num(v.talkDay, 0, 1e6, 0)), giftDay: Math.floor(num(v.giftDay, 0, 1e6, 0)), requestDay: Math.floor(num(v.requestDay, 0, 1e6, 0)), rewarded: Math.floor(num(v.rewarded, 0, 3, 0))};
  }
  if (s.event && typeof s.event === 'object') L.event = {day: Math.floor(num(s.event.day, 0, 1e6, 0)), points: Math.floor(num(s.event.points, 0, 1000, 0)), claimed: Array.isArray(s.event.claimed) ? s.event.claimed.filter((n: unknown) => n === 0 || n === 1) : []};
  if (s.stats && typeof s.stats === 'object') for (const [k, v] of Object.entries(s.stats)) if (statKeys.has(k)) L.stats[k as LifeStat] = Math.floor(num(v, 0, 1e7, 0));
  if (s.daily && typeof s.daily === 'object') {
    L.daily.day = Math.floor(num(s.daily.day, 1, 1e6, 1));
    if (s.daily.base && typeof s.daily.base === 'object') for (const [k, v] of Object.entries(s.daily.base)) if (statKeys.has(k)) L.daily.base[k as LifeStat] = Math.floor(num(v, 0, 1e7, 0));
    if (Array.isArray(s.daily.done)) L.daily.done = s.daily.done.filter((k: unknown) => typeof k === 'string' && dailyPool.some(t => t.id === k));
  }
  if (Array.isArray(s.plots)) s.plots.slice(0, gardenPlots.length).forEach((v: any, i: number) => {
    if (!v || typeof v !== 'object') return;
    L.plots[i] = {stage: Math.round(num(v.stage, -1, 3, -1)), wet: v.wet === true, stageAt: num(v.stageAt, 0, 1e9, 0), flower: (['hibiscus', 'plumeria', 'pinkHibiscus'] as const).includes(v.flower) ? v.flower : 'hibiscus'};
  });
  if (s.fruit && typeof s.fruit === 'object') for (const t of fruitTrees) {
    const v = s.fruit[t.id];
    if (v && typeof v === 'object') L.fruit[t.id] = {count: Math.round(num(v.count, 0, 3, 0)), readyAt: num(v.readyAt, 0, 1e9, 0), shakes: Math.round(num(v.shakes, 0, 1e6, 0))};
  }
  if (s.shells && typeof s.shells === 'object') for (const sp of shellSpots) {
    const v = s.shells[sp.id];
    if (v && typeof v === 'object') L.shells[sp.id] = {item: lifeItems.includes(v.item) && SHELLS.includes(v.item) ? v.item : undefined, readyAt: num(v.readyAt, 0, 1e9, 0)};
  }
  if (Array.isArray(s.bugs)) for (const b of L.bugs) {
    const v = s.bugs.find((x: any) => x?.id === b.id);
    if (v && ['idle', 'fled', 'caught'].includes(v.state)) {
      b.state = v.state === 'fled' ? 'caught' : v.state;
      b.respawnAt = num(v.respawnAt, 0, 1e9, 0);
    }
  }
  // Discovered recipes: always keep the base set, then add valid unlocked keys.
  if (Array.isArray(s.recipes)) {
    const known = Object.keys(craftRecipes);
    for (const k of s.recipes) if (typeof k === 'string' && known.includes(k)) L.recipes.push(k);
    L.recipes = [...new Set(L.recipes)];
  }
  // Villagers: identities must match the candidate list; homes are derived, never trusted from input.
  if (Array.isArray(s.villagers)) for (const v of s.villagers.slice(0, villagerCandidates.length)) {
    const c = villagerCandidates.find(c => c?.id === v?.id);
    if (c && !L.villagers.some(x => x.id === c.id)) L.villagers.push({id: c.id, name: c.name, species: c.species, arrivedDay: Math.floor(num(v.arrivedDay, 1, 1e6, c.day))});
  }
  L.weatherDay = Math.floor(num(s.weatherDay, 0, 1e6, 0));
  L.seasonDay = Math.floor(num(s.seasonDay, 0, 1e6, 0));
  if (s.turnip && typeof s.turnip === 'object') L.turnip = {count: Math.floor(num(s.turnip.count, 0, 9999, 0)), week: Math.floor(num(s.turnip.week, 0, 1e6, 0))};
  if (s.moneyRock && typeof s.moneyRock === 'object') L.moneyRock = {day: Math.floor(num(s.moneyRock.day, 0, 1e6, 0)), hits: Math.floor(num(s.moneyRock.hits, 0, 99, 0)), lastAt: num(s.moneyRock.lastAt, 0, 1e9, 0)};
  if (s.balloon && typeof s.balloon === 'object') L.balloon = {day: Math.floor(num(s.balloon.day, 0, 1e6, 0)), shot: s.balloon.shot === true};
  return L;
}

// Exposed for tests: every fixed life point must be standable ground.
export function lifePointsStandable() {
  const pts = [...shellSpots, ...buriedCandidates, ...gardenPlots, ...villagerHomes, ...bugSpots.filter(b => !bugInfo[b.species].onTree)];
  return pts.filter(p => !canStand(p));
}
