// Two-browser co-op play-test. Browser A creates an island, browser B joins with the invite code.
// Both play through the real UI; each browser's own copy of the world (synced from the server) is read
// through the ?qa hook to confirm the other player's actions arrived.
// Usage: BASE=http://127.0.0.1:8787 node qa/coop-play.mjs   (CHROME=/path optional)
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
async function player(name, mobile = false) {
  const ctx = await browser.newContext(mobile ? {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true} : {viewport: {width: 1280, height: 720}});
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(base + qaPath, {waitUntil: 'networkidle'});
  await page.waitForTimeout(1000);
  await page.fill('#player-name', name);
  return {ctx, page, errors};
}
const world = page => page.evaluate(() => window.__islandDebug.world());
const myId = page => page.evaluate(() => window.__islandDebug.me().id);
const toast = page => page.locator('#toast').textContent();
async function waitFor(page, fn, arg, max = 30000) {
  try {
    await page.waitForFunction(fn, arg, {timeout: max});
    return true;
  } catch {
    return false;
  }
}
async function closePanels(page) {
  // The arrival story card is dismissed by its own button, like a player would.
  const story = page.locator('#panel button', {hasText: '둘러보기'});
  if (await story.count() && await story.first().isVisible()) {
    await story.first().click();
    await page.waitForTimeout(500);
  }
  for (let i = 0; i < 4 && !(await page.locator('#overlay').isHidden()); i++) {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
}

const A = await player('하준');
await A.page.click('#create-room');
const aJoined = await waitFor(A.page, () => window.__islandDebug?.world()?.code && window.__islandDebug.world().code !== 'SOLO');
await closePanels(A.page);
const code = (await world(A.page)).code;
check('A creates island', aJoined && /^[A-Z0-9]{6}$/.test(code), `code=${code}`);

const B = await player('여름', true);
await B.page.fill('#room-code', code);
await B.page.click('#join-room');
const bJoined = await waitFor(B.page, c => window.__islandDebug?.world()?.code === c, code);
await closePanels(B.page);
const aId = await myId(A.page), bId = await myId(B.page);
const bothOnline = await waitFor(A.page, () => Object.values(window.__islandDebug.world().players).filter(p => p.online).length === 2);
check('B joins with code', bJoined && bothOnline, `A sees ${Object.values((await world(A.page)).players).filter(p => p.online).length} online`);
await A.page.waitForTimeout(1500);
await A.page.screenshot({path: `${out}/coop-a-start.png`});
await B.page.screenshot({path: `${out}/coop-b-start.png`});

// A walks right; B must see A move.
const beforeX = (await world(B.page)).players[aId].x;
await A.page.keyboard.down('d');
await A.page.waitForTimeout(2500);
await A.page.keyboard.up('d');
const moved = await waitFor(B.page, ([id, x]) => window.__islandDebug.world().players[id].x > x + 30, [aId, beforeX]);
check('movement syncs A→B', moved, `B sees A x ${Math.round(beforeX)} → ${Math.round((await world(B.page)).players[aId].x)}`);

// B (on a phone) taps the action button; whatever B picked up must show identically in A's world.
const bBefore = JSON.stringify((await world(B.page)).players[bId].bag);
await B.page.locator('#interact').tap();
await B.page.waitForTimeout(600);
const bToast = await toast(B.page);
const bChanged = await waitFor(B.page, ([id, before]) => JSON.stringify(window.__islandDebug.world().players[id].bag) !== before, [bId, bBefore], 40000);
const bBag = JSON.stringify((await world(B.page)).players[bId].bag);
const aSeesB = await waitFor(A.page, ([id, bag]) => JSON.stringify(window.__islandDebug.world().players[id].bag) === bag, [bId, bBag], 20000);
check('B acts on phone, A sees result', bChanged && aSeesB, `B toast="${bToast}" bag=${bBag}`);
await B.page.screenshot({path: `${out}/coop-b-action.png`});

// A talks to 여름 from the friends panel; friendship is island-wide, so B sees it.
await closePanels(A.page);
await A.page.click('#friends');
await A.page.waitForTimeout(800);
await A.page.locator('[data-friend="김여름"]').click();
await A.page.waitForTimeout(400);
await A.page.locator('[data-talk]').click();
await A.page.waitForTimeout(800);
const talkToast = await toast(A.page);
await A.page.screenshot({path: `${out}/coop-a-talk.png`});
await closePanels(A.page);
const friendSynced = await waitFor(B.page, () => (window.__islandDebug.world().life?.friendship?.['김여름']?.points || 0) >= 1, null, 20000);
check('A talks to 여름, B sees friendship', friendSynced, `toast="${talkToast}"`);

// Shared island resources: A clicks the nearest shell on the beach; it disappears for B as well.
const aw = await world(A.page);
const shellSpot = [['shell-0', 900, 690], ['shell-1', 820, 640], ['shell-2', 860, 790]].find(([id]) => aw.life.shells[id]?.item);
const before = Object.values((await world(B.page)).life.shells).filter(v => v.item).length;
const shellAt = await A.page.evaluate(([x, y]) => window.__islandDebug.project(x, y), [shellSpot[1], shellSpot[2] - 25]);
await A.page.mouse.click(shellAt.x, shellAt.y);
const picked = await waitFor(B.page, id => !window.__islandDebug.world().life.shells[id].item, shellSpot[0], 60000);
const after = Object.values((await world(B.page)).life.shells).filter(v => v.item).length;
check('A picks a shell, B sees it gone', picked && after === before - 1, `shells B sees ${before}→${after} · A toast="${await toast(A.page)}"`);

await A.page.screenshot({path: `${out}/coop-a-end.png`});
await B.page.screenshot({path: `${out}/coop-b-end.png`});
check('A no errors', !A.errors.length, A.errors.join('|') || 'none');
check('B no errors', !B.errors.length, B.errors.join('|') || 'none');
await browser.close();
console.log(results.join('\n'));
process.exit(failed ? 1 : 0);
