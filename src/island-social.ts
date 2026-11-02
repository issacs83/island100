// Social island life: friendship with 여름, registered friends and island villagers (talk, gifts with
// tastes, daily requests, friendship levels with keepsake rewards), the island shop (sell finds for
// bells, buy goods), the wardrobe (hats and shirts) and seasonal events (bug-off, fishing tourney,
// shooting-star night).

import type {World, Player, Landmark, Item} from './shared';
import {josa, withRewards, setLifeEventHook, life, lifeEvent, lifeItemNames, hats, shirts, hash01, dayOf, hourOf, type LifeItem, type Friendship, villagersOf, villagerHome, unlockRandomRecipe, recipeName, seasonOf, seasonNames, weatherOf, weatherNames, isTurnipDay, turnipBuyPrice, turnipSellPrice, turnipWeek} from './island-life';

const YEOREUM = '김여름';
export const SHOP = {id: 'shop', x: 1180, y: 492};
export const CAMP_POINT = {x: 1260, y: 660};

function announce(p: Player, text: string) {
  p.notice = text;
  p.noticeSeq = (p.noticeSeq || 0) + 1;
}
function give(p: Player, item: Item, n = 1) {
  p.bag[item] = (p.bag[item] || 0) + n;
  (p.collected ??= {})[item] = (p.collected?.[item] || 0) + n;
  p.reward = {item, n, seq: (p.reward?.seq || 0) + 1};
}
function take(p: Player, item: Item, n = 1) {
  if ((p.bag[item] || 0) < n) return false;
  p.bag[item] = (p.bag[item] || 0) - n;
  if (p.equipped === item && !p.bag[item]) p.equipped = undefined;
  if (p.hat === item && !p.bag[item]) p.hat = undefined;
  if (p.top === item && !p.bag[item]) p.top = undefined;
  return true;
}

// ---------- Friendship ----------

export const friendLevels = [
  {min: 0, name: '새 친구'}, {min: 5, name: '친한 친구'}, {min: 15, name: '단짝'}, {min: 30, name: '베스트 프렌드'},
];
export function friendLevel(points: number) {
  let level = 0;
  friendLevels.forEach((l, i) => { if (points >= l.min) level = i; });
  return level;
}
// Gifts handed out when a friendship level is first reached.
export const levelRewards: Array<{give: Partial<Record<Item, number>>; text: string}> = [
  {give: {}, text: ''},
  {give: {flowerSeed: 3}, text: '꽃씨 3봉지'},
  {give: {strawHat: 1}, text: '직접 엮은 밀짚모자'},
  {give: {friendPhoto: 1}, text: '둘이 찍은 사진'},
];

type Taste = {loves: Item[]; likes: Item[]; dislikes: Item[]; note: string};
const TASTE_GROUPS: Record<string, Item[]> = {
  bugs: ['butterfly', 'dragonfly', 'cicada', 'beetle', 'firefly', 'hermitCrab'],
  flowers: ['hibiscus', 'plumeria', 'pinkHibiscus', 'flowerCrown'],
  fruit: ['mango', 'coconut'],
  sea: ['seaUrchin', 'seaStar', 'octopus', 'abalone', 'seaCucumber', 'reefFish', 'rawFish'],
  shells: ['conch', 'scallop', 'coral', 'sandDollar'],
};
const GROUP_NAMES: Record<string, string> = {bugs: '곤충', flowers: '꽃', fruit: '과일', sea: '바다 생물', shells: '조개'};
export function tasteOf(name: string): Taste {
  if (name === YEOREUM) return {loves: ['hermitCrab', 'mango', 'coral', 'octopus', 'pinkHibiscus'], likes: [...TASTE_GROUPS.bugs, ...TASTE_GROUPS.shells, ...TASTE_GROUPS.fruit], dislikes: ['clay', 'stone', 'worm'], note: '소라게·망고·산호·문어를 아주 좋아해요'};
  const keys = Object.keys(TASTE_GROUPS);
  const love = keys[Math.floor(hash01('taste', name) * keys.length)];
  const like = keys[(keys.indexOf(love) + 1 + Math.floor(hash01('taste2', name) * (keys.length - 1))) % keys.length];
  return {loves: TASTE_GROUPS[love], likes: TASTE_GROUPS[like], dislikes: ['clay', 'worm'], note: `${GROUP_NAMES[love]}을(를) 아주 좋아하고 ${GROUP_NAMES[like]}도 좋아해요`};
}

export const requestPool: Array<{item: Item; n: number}> = [
  {item: 'mango', n: 2}, {item: 'scallop', n: 1}, {item: 'fish', n: 1}, {item: 'wood', n: 5}, {item: 'hibiscus', n: 1},
  {item: 'butterfly', n: 1}, {item: 'coconut', n: 2}, {item: 'seaStar', n: 1}, {item: 'conch', n: 1}, {item: 'fiber', n: 4},
];
export const requestGifts: Array<Partial<Record<Item, number>>> = [{ration: 1}, {flowerSeed: 2}, {arrow: 3}, {worm: 3}, {water: 1}];
export function todaysRequest(name: string, day: number) {
  return requestPool[Math.floor(hash01('request', name, day) * requestPool.length)];
}

export function friendNames(w: World) {
  return [YEOREUM, ...w.friends.map(f => f.name), ...villagersOf(w).map(v => v.name)];
}
export function friendship(w: World, name: string): Friendship {
  const L = life(w);
  return (L.friendship[name] ??= {points: 0, talkDay: 0, giftDay: 0, requestDay: 0, rewarded: 0});
}
// 여름 walks around as the companion in solo; registered friends and villagers live at fixed spots.
export function friendPosition(w: World, name: string) {
  if (name === YEOREUM) return w.companion ? {x: w.companion.x, y: w.companion.y} : {x: 1050, y: 545};
  const villager = villagersOf(w).find(v => v.name === name);
  if (villager) return villagerHome(villager.id);
  return CAMP_POINT;
}
function near(w: World, p: Player, name: string) {
  const at = friendPosition(w, name);
  return Math.hypot(p.x - at.x, p.y - at.y) <= (name === YEOREUM ? 170 : 230);
}
const lines: Record<number, string[]> = {
  0: ['하준아, 이 섬 생각보다 넓다! 같이 둘러보자.', '배고프면 망고 나무를 흔들어 봐. 나 망고 진짜 좋아해!', '바닷가에 소라게 봤어? 걔네 집 들고 다니는 거 귀엽지.'],
  1: ['너랑 있으니까 무인도도 캠프 같아.', '오늘 부탁 들어줘서 고마워. 내일도 같이 하자!', '밤에 반딧불이 보러 갈래?'],
  2: ['우리 둘이면 100일도 금방일 거야.', '밀짚모자 잘 어울린다! 내가 만든 거라 더 그래.', '나중에 구조되면 이 섬 얘기 다 해 줄 거야.'],
  3: ['하준아, 넌 내 베스트 프렌드야. 진짜로.', '사진 아직 갖고 있지? 나도 하나 갖고 있어.', '무슨 일이 있어도 같이 돌아가자.'],
};
// Villager neighbours speak with their own voice; {n} becomes their name.
const villagerLines: Record<number, string[]> = {
  0: ['{n}: 안녕! 바다 건너에서 이사를 왔어. 잘 부탁해!', '{n}: 이 섬 냄새 참 좋다. 씨앗이랑 열매도 많대?', '{n}: 네가 하준이구나! 여름이가 미리 얘기했어.'],
  1: ['{n}: 오늘 부탁 들어줘서 고마워. 은혜는 갚는 거야!', '{n}: 비 오는 날엔 물고기 입질이 빨라. 해봐, 진짜야!', '{n}: 우리 집 앞 꽃이 피면 자랑하러 올게.'],
  2: ['{n}: 이제 우리 단짝이지? 여기가 제2의 고향이야.', '{n}: 네가 준 선물, 매일 보고 있어. 진짜야!', '{n}: 나중에 이 섬 얘기, 온 세상에 소문낼 거야.'],
  3: ['{n}: 하준, 넌 내 베스트 프렌드야! 동물 약속!', '{n}: 구조되는 날에도 우리는 계속 친구야.', '{n}: 이 섬에 온 게 인생 최고의 행운이야.'],
};
function villagerLine(name: string, level: number, seed: string) {
  const pool = villagerLines[level] ?? villagerLines[0];
  return pool[Math.floor(hash01('vtalk', name, seed) * pool.length)].replaceAll('{n}', name);
}

function addPoints(w: World, p: Player, name: string, n: number): string {
  const f = friendship(w, name);
  const before = friendLevel(f.points);
  f.points = Math.min(999, f.points + n);
  const after = friendLevel(f.points);
  if (after > before && after > f.rewarded) {
    f.rewarded = after;
    const reward = levelRewards[after];
    for (const [item, k] of Object.entries(reward.give)) give(p, item as Item, k!);
    return ` · 💛 ${josa(name, '과/와')} ${josa(friendLevels[after].name, '이/가')} 되었어요! ${josa(reward.text, '을/를')} 받았어요.`;
  }
  return '';
}

export function socialAction(w: World, p: Player, action: string, arg: unknown): string {
  return withRewards(() => socialInner(w, p, action, arg));
}
function socialInner(w: World, p: Player, action: string, arg: unknown): string {
  const day = dayOf(w.elapsed);
  if (action === 'social-talk' || action === 'social-gift' || action === 'social-request') {
    const o = (arg && typeof arg === 'object' ? arg : {to: arg}) as {to?: unknown; item?: unknown};
    const name = typeof o.to === 'string' ? o.to : '';
    if (!friendNames(w).includes(name)) return '친구를 선택해요.';
    if (!near(w, p, name)) return name === YEOREUM ? '여름이 곁으로 가서 이야기해요.' : `${josa(name, '은/는')} 캠프에 있어요. 캠프로 가요.`;
    const f = friendship(w, name);
    if (action === 'social-talk') {
      const level = friendLevel(f.points);
      const isVillager = villagersOf(w).some(v => v.name === name);
      const line = isVillager ? villagerLine(name, level, `${day}-${f.points}`)
        : name === YEOREUM ? lines[level][Math.floor(hash01('talk', day, f.points) * lines[level].length)]
        : `${name}: 오늘 섬에서 뭐 찾았어? 나는 ${tasteOf(name).note.split('을(를)')[0]} 구경하는 게 좋아!`;
      if (f.talkDay === day) return name === YEOREUM ? `여름: ${line}` : line;
      f.talkDay = day;
      return `${name === YEOREUM ? '여름: ' : ''}${line}${addPoints(w, p, name, 1)}`;
    }
    if (action === 'social-gift') {
      const item = o.item as Item;
      if (typeof item !== 'string' || !(p.bag[item] || 0)) return '가방에 있는 물건을 골라요.';
      if (f.giftDay === day) return `${name}: 오늘은 벌써 선물 받았어! 마음만 받을게.`;
      if (!take(p, item)) return '가방에 없어요.';
      f.giftDay = day;
      const taste = tasteOf(name);
      const gain = taste.loves.includes(item) ? 4 : taste.likes.includes(item) ? 2 : taste.dislikes.includes(item) ? 0 : 1;
      const reaction = gain >= 4 ? '우와! 이거 내가 제일 좋아하는 거야!' : gain >= 2 ? '고마워! 마음에 들어.' : gain === 1 ? '고마워, 잘 쓸게.' : '음… 고마워. (별로 안 좋아하는 눈치예요)';
      lifeEvent(w, p, 'gift');
      return `${name}: ${reaction} · 우정 +${gain}${addPoints(w, p, name, gain)}`;
    }
    const req = todaysRequest(name, day);
    if (f.requestDay === day) return `${name}: 오늘 부탁은 벌써 들어줬어. 고마워!`;
    if ((p.bag[req.item] || 0) < req.n) return `${name}의 부탁: ${(lifeItemNames as Record<string, string>)[req.item] || req.item} ${req.n}개가 필요해요.`;
    take(p, req.item, req.n);
    f.requestDay = day;
    // Half the time the thank-you gift is a discovered recipe instead of an item.
    const recipe = hash01('req-recipe', name, day) < 0.55 ? unlockRandomRecipe(w, p, `request-${name}-${day}`) : undefined;
    if (!recipe) {
      const gift = requestGifts[Math.floor(hash01('thanks', name, day) * requestGifts.length)];
      for (const [item, n] of Object.entries(gift)) give(p, item as Item, n!);
    }
    life(w).miles += 80;
    lifeEvent(w, p, 'request');
    return `${name}: 정말 고마워! 답례야.${recipe ? ` 이 레시피는 내 비책이야: ${recipeName(recipe)}!` : ''} · +80마일${addPoints(w, p, name, 5)}`;
  }
  if (action === 'shop-sell' || action === 'shop-buy') return shopAction(w, p, action, arg);
  if (action === 'dress') return dress(p, arg);
  if (action === 'wish') return wish(w, p);
  return '알 수 없는 요청이에요.';
}

// ---------- Shop ----------

export const sellPrices: Partial<Record<Item, number>> = {
  butterfly: 160, dragonfly: 180, cicada: 250, beetle: 600, firefly: 300, hermitCrab: 200,
  conch: 120, scallop: 100, coral: 150, sandDollar: 130, clay: 60, oldCoin: 400, mango: 80, coconut: 60,
  hibiscus: 100, plumeria: 100, pinkHibiscus: 400, rawFish: 120, reefFish: 300,
  seaUrchin: 400, seaStar: 200, octopus: 1000, abalone: 800, seaCucumber: 300, starFragment: 1200, ironOre: 250, hide: 150,
};
export const shopStock: Array<{id: string; label: string; price: number; give: Partial<Record<Item, number>>}> = [
  {id: 'seeds', label: '꽃씨 3봉지', price: 200, give: {flowerSeed: 3}},
  {id: 'net', label: '곤충망', price: 400, give: {bugNet: 1}},
  {id: 'can', label: '물뿌리개', price: 500, give: {wateringCan: 1}},
  {id: 'suit', label: '잠수복', price: 1500, give: {wetsuit: 1}},
  {id: 'hat', label: '밀짚모자', price: 800, give: {strawHat: 1}},
  {id: 'tropical', label: '꽃무늬 셔츠', price: 900, give: {tropicalShirt: 1}},
  {id: 'striped', label: '줄무늬 셔츠', price: 700, give: {stripedShirt: 1}},
  {id: 'ration', label: '비상식량 2개', price: 300, give: {ration: 2}},
  {id: 'bait', label: '지렁이 미끼 5개', price: 150, give: {worm: 5}},
];
function shopAction(w: World, p: Player, action: string, arg: unknown): string {
  const L = life(w);
  const day = dayOf(w.elapsed);
  if (Math.hypot(p.x - SHOP.x, p.y - SHOP.y) > 200) return '섬 매점 가까이에서 이용해요.';
  if (action === 'shop-sell') {
    // Turnips sell at the day's market price and rot once a new week starts.
    if (arg === 'turnip') {
      if (!L.turnip.count) return '팔 무가 없어요. 일요일마다 매점에서 사요.';
      const price = turnipSellPrice(day);
      if (price <= 0) return '오늘은 무를 사는 날이에요. 팔 수 있는 날은 내일부터!';
      const n = L.turnip.count;
      L.turnip = {count: 0, week: turnipWeek(day)};
      L.bells += price * n;
      lifeEvent(w, p, 'sell');
      return `무 ${n}개를 개당 ${price}벨, 총 ${price * n}벨에 팔았어요!${price >= 250 ? ' 대박이에요!' : ''}`;
    }
    const o = (arg && typeof arg === 'object' ? arg : {item: arg}) as {item?: unknown; all?: unknown};
    const item = o.item as Item;
    const price = sellPrices[item];
    if (!price) return '매점에서 사지 않는 물건이에요.';
    const n = o.all === true ? p.bag[item] || 0 : 1;
    if (!n || !take(p, item, n)) return '가방에 없어요.';
    L.bells += price * n;
    lifeEvent(w, p, 'sell');
    return `${(lifeItemNames as Record<string, string>)[item] || item} ${n}개를 ${price * n}벨에 팔았어요.`;
  }
  // Turnips are only stocked on turnip day, in bundles of five.
  if (arg === 'turnip') {
    if (!isTurnipDay(day)) return '무는 일요일마다 들어와요. 게시판에서 장사 날을 확인해요.';
    const price = turnipBuyPrice(day) * 5;
    if (L.bells < price) return `${price - L.bells}벨이 부족해요.`;
    const week = turnipWeek(day);
    if (L.turnip.count && L.turnip.week !== week) L.turnip = {count: 0, week};
    L.bells -= price;
    L.turnip = {count: L.turnip.count + 5, week};
    return `무 5개를 ${price}벨에 샀어요! 이번 주 안에 팔아요. (총 ${L.turnip.count}개)`;
  }
  const offer = shopStock.find(o => o.id === arg);
  if (!offer) return '살 물건을 골라요.';
  if (L.bells < offer.price) return `${offer.price - L.bells}벨이 부족해요.`;
  L.bells -= offer.price;
  for (const [item, n] of Object.entries(offer.give)) give(p, item as Item, n!);
  return `${josa(offer.label, '을/를')} 샀어요. -${offer.price}벨`;
}

// ---------- Wardrobe ----------

function dress(p: Player, arg: unknown): string {
  const o = (arg && typeof arg === 'object' ? arg : {}) as {slot?: unknown; item?: unknown};
  if (o.slot !== 'hat' && o.slot !== 'top') return '옷 칸을 골라요.';
  if (o.item === 'none') {
    if (o.slot === 'hat') p.hat = undefined;
    else p.top = undefined;
    return o.slot === 'hat' ? '모자를 벗었어요.' : '셔츠를 벗었어요.';
  }
  const item = o.item as LifeItem;
  const list = o.slot === 'hat' ? hats : shirts;
  if (!list.includes(item)) return '그 칸에 입을 수 없는 옷이에요.';
  if (!p.bag[item]) return '가방에 없는 옷이에요.';
  if (o.slot === 'hat') p.hat = item;
  else p.top = item;
  p.gesture = {kind: 'equip', remaining: 0.5, duration: 0.5, item};
  return `${josa(lifeItemNames[item], '을/를')} ${o.slot === 'hat' ? '썼어요.' : '입었어요.'}`;
}

// ---------- Seasonal events ----------

export type IslandEvent = {id: string; name: string; stat?: 'bug' | 'fish'; tiers: Array<{need: number; miles: number; item?: Item}>; intro: string};
export const events: IslandEvent[] = [
  {id: 'bug-off', name: '곤충 대회', stat: 'bug', tiers: [{need: 2, miles: 150}, {need: 5, miles: 300, item: 'bugTrophy'}], intro: '오늘은 곤충 대회! 곤충을 잡을 때마다 대회 점수가 올라요.'},
  {id: 'tourney', name: '낚시 대회', stat: 'fish', tiers: [{need: 2, miles: 150}, {need: 4, miles: 300, item: 'fishTrophy'}], intro: '오늘은 낚시 대회! 물고기를 낚을 때마다 대회 점수가 올라요.'},
  {id: 'meteor', name: '별똥별 밤', tiers: [], intro: '오늘 밤 별똥별이 떨어져요! 밤하늘에 별이 지나가면 소원 빌기 버튼을 눌러요.'},
];
// Island calendar: day 1 is the arrival, events start from day 2.
export function eventOn(day: number): IslandEvent | undefined {
  if (day < 2) return undefined;
  if (day % 7 === 3) return events[0];
  if (day % 7 === 6) return events[1];
  if (day % 5 === 4) return events[2];
  return undefined;
}
export function eventProgress(w: World) {
  const L = life(w);
  const day = dayOf(w.elapsed);
  if (L.event.day !== day) L.event = {day, points: 0, claimed: []};
  return L.event;
}
// Called by gameplay hooks after a bug or fish is caught.
export function eventCatch(w: World, p: Player, stat: 'bug' | 'fish') {
  const ev = eventOn(dayOf(w.elapsed));
  if (!ev || ev.stat !== stat) return;
  const prog = eventProgress(w);
  prog.points++;
  ev.tiers.forEach((t, i) => {
    if (prog.points >= t.need && !prog.claimed.includes(i)) {
      prog.claimed.push(i);
      life(w).miles += t.miles;
      if (t.item) give(p, t.item);
      announce(p, `${ev.name} ${t.need}마리 달성! +${t.miles}마일${t.item ? ` · ${lifeItemNames[t.item as LifeItem]}` : ''}`);
    }
  });
}
// Bug catches feed the bug-off (fish are hooked directly in shared.step).
setLifeEventHook((w, p, stat) => {
  if (stat === 'bug' && p) eventCatch(w, p, 'bug');
});

// Shooting stars: on meteor nights after 20:00, a star crosses the sky for 3 seconds out of every 12.
export function starVisible(w: World) {
  const ev = eventOn(dayOf(w.elapsed));
  const h = hourOf(w.elapsed);
  if (ev?.id !== 'meteor' || !(h >= 20 || h < 4)) return false;
  return (w.elapsed % 12) < 3;
}
function wish(w: World, p: Player): string {
  const L = life(w);
  if (!starVisible(w)) return '별똥별이 지나갈 때 소원을 빌어요.';
  const window = Math.floor(w.elapsed / 12);
  if (L.wishAt === window) return '이번 별에는 이미 소원을 빌었어요.';
  L.wishAt = window;
  give(p, 'starFragment');
  lifeEvent(w, p, 'wish');
  return '✨ 소원을 빌었어요! 해변에 별 조각이 떨어졌어요. (가방에 넣었어요)';
}
// Morning announcement of today's event.
export function stepSocial(w: World, players: Player[]) {
  const day = dayOf(w.elapsed);
  const ev = eventOn(day);
  for (const p of players) {
    if (ev && p.eventDay !== day) {
      p.eventDay = day;
      announce(p, `📅 ${ev.intro}`);
    }
  }
}

// ---------- Plaza bulletin board ----------

// One friendly summary of today's island: season, weather, event, turnip market and neighbours.
export function boardNews(w: World): Array<{icon: string; text: string}> {
  const day = dayOf(w.elapsed);
  const season = seasonOf(day), weather = weatherOf(day);
  const ev = eventOn(day);
  const news = [
    {icon: seasonNames[season].icon, text: `오늘의 계절: ${seasonNames[season].name}`},
    {icon: weatherNames[weather].icon, text: `날씨: ${weatherNames[weather].name}${weather === 'rain' || weather === 'storm' ? ' · 꽃밭에 물을 줄 필요 없어요' : ''}`},
  ];
  if (ev) news.push({icon: '📅', text: ev.intro});
  if (isTurnipDay(day)) news.push({icon: '🥬', text: `오늘은 무 장사하는 날! 매점에서 무 5개 ${turnipBuyPrice(day)}벨에 구매`});
  else if (turnipSellPrice(day) > 0) news.push({icon: '🥬', text: `무 판매가: 개당 ${turnipSellPrice(day)}벨${turnipSellPrice(day) >= 250 ? ' · 대박 시세!' : ''}`});
  const villagers = villagersOf(w);
  if (villagers.length) news.push({icon: '🏝', text: `섬 이웃: ${villagers.map(v => v.name).join(', ')}`});
  else news.push({icon: '🏝', text: '조만간 새로운 이웃이 이사를 올 거예요.'});
  const L = life(w);
  if (L.turnip.count > 0) news.push({icon: '📦', text: `보유 무: ${L.turnip.count}개 (구매가 ${turnipBuyPrice(L.turnip.week * 7 + 1)}벨)`});
  return news;
}

// ---------- Targets ----------

export function socialTargets(w?: World): Landmark[] {
  const out: Landmark[] = [{id: SHOP.id, name: '섬 매점 · 팔기/사기', x: SHOP.x, y: SHOP.y, kind: 'shop'}];
  // Villager neighbours stand at their little homes; their landmark id is their name.
  if (w) for (const v of villagersOf(w)) {
    const home = villagerHome(v.id);
    out.push({id: v.name, name: `${v.name} · 이웃`, x: home.x, y: home.y, kind: 'friend'});
  }
  return out;
}
export function socialInteract(_w: World, _p: Player, l: Landmark): string | undefined {
  if (l.kind === 'shop') return '섬 매점: 찾은 물건을 팔고, 옷과 도구를 살 수 있어요.';
  return undefined;
}

// Save-file safety for clothes: only wearable items that are actually in the bag.
export function restoreClothes(p: Player) {
  if (p.hat && (!hats.includes(p.hat as LifeItem) || !p.bag[p.hat])) p.hat = undefined;
  if (p.top && (!shirts.includes(p.top as LifeItem) || !p.bag[p.top])) p.top = undefined;
}
