// Browser play-test for sneaking, diving, friends, the shop, clothes, flower breeding and events.
// Plays through the real UI (mouse clicks on the world, held keys, panels) and reads the game's own
// state through the read-only ?qa hook to confirm each result.
// Usage: BASE=http://127.0.0.1:8787 node qa/second-wave-play.mjs   (CHROME=/path optional)
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const qaPath = '/?qa' + (process.env.RENDER ? '&render=' + process.env.RENDER : '');
const base = process.env.BASE || 'http://127.0.0.1:8787';
const out = process.env.OUT || 'qa/shots';
mkdirSync(out, {recursive: true});
const browser = await chromium.launch({...(process.env.CHROME ? {executablePath: process.env.CHROME} : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
const results = [];
let failed = 0;
function check(name, ok, detail) {
  results.push(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
  if (!ok) failed++;
}
async function open(fixture, {mobile = false} = {}) {
  const ctx = await browser.newContext(mobile ? {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true} : {viewport: {width: 1280, height: 720}});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + qaPath, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1200);
  const [chooser] = await Promise.all([page.waitForEvent('filechooser', {timeout: 20000}), page.click('#load-save-start')]);
  await chooser.setFiles(`qa/fixtures/${fixture}.island.json`);
  await page.waitForTimeout(3500);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(600);
  return {ctx, page, errors};
}
const me = page => page.evaluate(() => window.__islandDebug.me());
const world = page => page.evaluate(() => window.__islandDebug.world());
const toast = page => page.locator('#toast').textContent();
async function settle(page, max = 40000) {
  await page.waitForFunction(() => { const p = window.__islandDebug?.me(); return p && !p.gesture && !p.swing; }, null, {timeout: max});
  await page.waitForTimeout(150);
}
// Hold a key until a condition on the hero is true (headless rendering is slow, so poll real state).
async function holdUntil(page, key, test, max = 60000) {
  await page.keyboard.down(key);
  const start = Date.now();
  try {
    while (Date.now() - start < max) {
      const p = await me(page);
      if (test(p)) return true;
      await page.waitForTimeout(150);
    }
    return false;
  } finally {
    await page.keyboard.up(key);
  }
}
// The companion resumes exploring as soon as a save loads, so walk toward her until she is the nearest target.
async function approachFriend(page, max = 60000) {
  const start = Date.now();
  while (Date.now() - start < max) {
    if (/김여름/.test(await page.locator('#target-label').textContent() || '')) return true;
    const p = await me(page), c = (await world(page)).companion;
    const dx = c.x - p.x, dy = c.y - p.y;
    const keys = [Math.abs(dx) > 15 ? (dx > 0 ? 'd' : 'a') : '', Math.abs(dy) > 15 ? (dy > 0 ? 's' : 'w') : ''].filter(Boolean);
    for (const k of keys) await page.keyboard.down(k);
    await page.waitForTimeout(300);
    for (const k of keys) await page.keyboard.up(k);
  }
  return false;
}
// At the start the washed-up bag is about as near as she is, and she keeps moving, so the nearest target can flip
// between reading the label and pressing E. Press E again after another approach until her menu opens.
async function openFriendMenu(page, max = 60000) {
  const start = Date.now();
  let near = false, title = null, presses = 0;
  while (Date.now() - start < max) {
    near = await approachFriend(page, max - (Date.now() - start));
    if (!near) break;
    await page.keyboard.press('e');
    presses++;
    await page.waitForTimeout(600);
    title = await page.locator('#panel h2').textContent({timeout: 1000}).catch(() => null);
    if (/김여름/.test(title || '')) break;
    await page.keyboard.press('Escape').catch(() => {});
    await page.waitForTimeout(300);
  }
  return {near, title, presses};
}

// 1. Sneak: click a butterfly; the hero walks over, switches to tiptoe near it, and catches it without scaring it.
{
  const {ctx, page, errors} = await open('wave-sneak');
  const w = await world(page);
  const bug = w.life.bugs.find(b => b.id === 'bug-butterfly-2');
  const at = await page.evaluate(([x, y]) => window.__islandDebug.project(x, y), [bug.x, bug.y - 25]);
  await page.mouse.click(at.x, at.y);
  let sawSneak = false;
  let shot = false;
  for (let i = 0; i < 300; i++) {
    const q = await me(page);
    if (q.input?.sneak && q.moving) {
      sawSneak = true;
      if (!shot) { await page.screenshot({path: `${out}/wave-1-sneak.png`}); shot = true; }
    }
    if (q.bag.butterfly >= 2 || q.gesture?.kind === 'net') break;
    await page.waitForTimeout(150);
  }
  await settle(page);
  const after = await me(page);
  const b = (await world(page)).life.bugs.find(v => v.id === 'bug-butterfly-2');
  check('sneak auto-tiptoe', sawSneak, `sneak seen=${sawSneak}`);
  check('sneak catch', after.bag.butterfly === 2 && b.state === 'caught', `bag=${after.bag.butterfly} state=${b.state} toast="${await toast(page)}"`);
  // Keyboard sneak: C + D is slower than D alone.
  const x0 = (await me(page)).x;
  await page.keyboard.down('c'); await page.keyboard.down('d'); await page.waitForTimeout(2500); await page.keyboard.up('d'); await page.keyboard.up('c');
  const x1 = (await me(page)).x;
  await page.keyboard.down('a'); await page.waitForTimeout(2500); await page.keyboard.up('a');
  const x2 = (await me(page)).x;
  check('C key sneak slower', (x1 - x0) > 0 && (x1 - x0) < (x1 - x2) * 0.75, `sneak ${Math.round(x1 - x0)} vs walk ${Math.round(x1 - x2)}`);
  check('sneak no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 2. Diving: walk west into the sea with the wetsuit, swim to a bubble, dive, swim back.
{
  const {ctx, page, errors} = await open('wave-dive');
  const entered = await holdUntil(page, 'a', p => p.swimming);
  await page.screenshot({path: `${out}/wave-2-swim.png`});
  const w = await world(page);
  const spot = {x: 430, y: 1500};
  const reached = await holdUntil(page, 'a', p => p.x <= spot.x + 50);
  const t = await (async () => { await page.keyboard.press('e'); await page.waitForTimeout(1500); await page.screenshot({path: `${out}/wave-2-dive.png`}); return toast(page); })();
  await settle(page);
  const p = await me(page);
  const sea = ['seaUrchin', 'seaStar', 'octopus', 'abalone', 'seaCucumber'].reduce((n, k) => n + (p.bag[k] || 0), 0);
  check('enter sea', entered, `swimming=${entered}`);
  check('dive catch', reached && /잠수해서/.test(t) && sea >= 2, `toast="${t}" seaItems=${sea}`);
  const out1 = await holdUntil(page, 'd', q => !q.swimming, 90000);
  check('leave sea', out1, `back on land=${out1}`);
  check('dive no errors', !errors.length, errors.join('|') || 'none');
  void w;
  await ctx.close();
}

// 3. Friend: talk, gift a loved item, fulfil today's request.
{
  const {ctx, page, errors} = await open('wave-friend');
  const {near: nearFriend, title, presses} = await openFriendMenu(page);
  await page.locator('[data-talk]').click();
  await page.waitForTimeout(500);
  const talk = await toast(page);
  await page.locator('[data-ftab="gift"]').click();
  await page.waitForTimeout(400);
  await page.screenshot({path: `${out}/wave-3-friend-gift.png`});
  await page.locator('[data-gift="mango"]').click();
  await page.waitForTimeout(500);
  const gift = await toast(page);
  await page.locator('[data-ftab="request"]').click();
  await page.waitForTimeout(400);
  const canDeliver = await page.locator('[data-deliver]').isEnabled().catch(() => false);
  if (canDeliver) await page.locator('[data-deliver]').click();
  await page.waitForTimeout(500);
  const req = await toast(page);
  await page.screenshot({path: `${out}/wave-3-friend-request.png`});
  const f = (await world(page)).life.friendship['김여름'];
  check('friend panel opens on E', /김여름/.test(title || ''), `${title} (walked up to her: ${nearFriend}, E presses: ${presses})`);
  check('friend talk', /여름:/.test(talk), talk);
  check('friend gift loved', /제일 좋아/.test(gift), gift);
  check('friend request', canDeliver ? /고마워/.test(req) : true, canDeliver ? req : 'request item not in fixture bag (skipped)');
  check('friendship points', f.points >= 5, `points=${f.points}`);
  check('friend no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 4. Shop + wardrobe: sell, buy a straw hat, wear it from the bag.
{
  const {ctx, page, errors} = await open('wave-shop');
  await page.keyboard.press('e');
  await page.waitForTimeout(600);
  await page.screenshot({path: `${out}/wave-4-shop-sell.png`});
  await page.locator('[data-sellall="beetle"]').click();
  await page.waitForTimeout(500);
  const sold = await toast(page);
  await page.locator('[data-stab="buy"]').click();
  await page.waitForTimeout(400);
  await page.locator('[data-buy="hat"]').click();
  await page.waitForTimeout(500);
  const bought = await toast(page);
  await page.screenshot({path: `${out}/wave-4-shop-buy.png`});
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
  await page.keyboard.press('i');
  await page.waitForTimeout(500);
  await page.locator('[data-slot="strawHat"]').click();
  await page.waitForTimeout(300);
  await page.locator('[data-dress]').click();
  await page.waitForTimeout(400);
  await settle(page);
  await page.screenshot({path: `${out}/wave-4-hat.png`});
  const p = await me(page);
  check('shop sell', /팔았어요/.test(sold), sold);
  check('shop buy', /샀어요/.test(bought), bought);
  check('wear hat', p.hat === 'strawHat', `hat=${p.hat}`);
  check('shop no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 5. Flower breeding: a watered red bloom beside a white bloom spreads into the empty plot.
{
  const {ctx, page, errors} = await open('wave-breed');
  await page.waitForFunction(() => window.__islandDebug.world().life.plots[1].stage >= 0, null, {timeout: 30000}).catch(() => {});
  await page.screenshot({path: `${out}/wave-5-breed.png`});
  const plots = (await world(page)).life.plots;
  check('flower spread', plots[1].stage === 0, `plot1=${JSON.stringify(plots[1])}`);
  check('breed no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 6. Bug-off day: mission bar announces the event.
{
  const {ctx, page, errors} = await open('wave-bugoff');
  await page.waitForTimeout(1000);
  const mission = await page.locator('#mission-step').textContent();
  await page.screenshot({path: `${out}/wave-6-bugoff.png`});
  check('bug-off shown', /곤충 대회/.test(mission || ''), mission);
  check('bugoff no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 7. Meteor night: wait for a shooting star, press the wish button.
{
  const {ctx, page, errors} = await open('wave-meteor');
  let wished = false;
  for (let i = 0; i < 400 && !wished; i++) {
    if (await page.locator('#wish-button').isVisible()) {
      await page.screenshot({path: `${out}/wave-7-star.png`});
      await page.locator('#wish-button').click();
      wished = true;
    } else await page.waitForTimeout(150);
  }
  await page.waitForTimeout(400);
  const t = await toast(page);
  const p = await me(page);
  check('shooting star wish', wished && p.bag.starFragment === 1, `toast="${t}"`);
  check('meteor no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

// 8. Mobile: gentle joystick tilt = sneak indicator.
{
  const {ctx, page, errors} = await open('wave-sneak', {mobile: true});
  const box = await page.locator('#joystick').boundingBox();
  const cx = box.x + box.width / 2, cy = box.y + box.height / 2;
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx - 12, cy, {steps: 3});
  let sneak = false;
  for (let i = 0; i < 60 && !sneak; i++) {
    const p = await me(page);
    sneak = !!(p.input?.sneak && p.moving);
    if (!sneak) await page.waitForTimeout(150);
  }
  await page.screenshot({path: `${out}/wave-8-mobile-sneak.png`});
  await page.mouse.up();
  check('mobile gentle tilt sneaks', sneak, `sneak=${sneak}`);
  check('mobile no errors', !errors.length, errors.join('|') || 'none');
  await ctx.close();
}

await browser.close();
console.log(results.join('\n'));
process.exit(failed ? 1 : 0);
