// Browser checks for the 3D view: keyboard buttons, tall-object clicks, ground clicks, resize and indoor pause.
// Usage: BASE=http://127.0.0.1:8787 node qa/click3d-play.mjs   (needs qa/fixtures/camp.island.json from qa/region-fixtures.ts)
import {chromium} from 'playwright';
const base = process.env.BASE || 'http://127.0.0.1:8787';
const browser = await chromium.launch({...(process.env.CHROME ? {executablePath: process.env.CHROME} : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
const results = [];
const check = (name, ok, detail) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
const debug = (fn, arg) => page.evaluate(fn, arg);
const stop = async () => { await page.keyboard.down('ArrowDown'); await page.waitForTimeout(250); await page.keyboard.up('ArrowDown'); await page.waitForTimeout(400); };
await page.goto(base + '/?qa&render=3d', {waitUntil: 'networkidle'});
await page.waitForTimeout(1500);
// Software rendering compiles the 3D shaders for ~20 s before the page answers clicks; wait, then retry once.
let chooser;
for (let attempt = 0; attempt < 2 && !chooser; attempt++) chooser = await Promise.all([page.waitForEvent('filechooser', {timeout: 60000}), page.click('#load-save-start', {timeout: 60000})]).then(([c]) => c, () => undefined);
if (!chooser) throw new Error('the save file chooser never opened');
await chooser.setFiles('qa/fixtures/camp.island.json');
await page.waitForTimeout(6000);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(1500);
const stats = await debug(() => window.__islandDebug.stats());
check('3d renders', !!stats && stats.calls > 0 && stats.rendered > 0, JSON.stringify(stats));

// Keyboard: Tab focus lands on a world button; Enter picks that landmark.
await page.focus('.world-item[aria-label^="떠밀려 온 가방"]');
await page.keyboard.press('Enter');
await page.waitForTimeout(400);
const viaKeyboard = await debug(() => window.__islandDebug.pending());
check('keyboard button', viaKeyboard === 'bag', `pending=${viaKeyboard}`);
await stop();

// A click high on the beach palm's crown picks the palm, not the ground behind it.
const crown = await debug(() => window.__islandDebug.project(1465, 645, 2.6));
await page.mouse.click(crown.x, crown.y);
await page.waitForTimeout(400);
const viaCrown = await debug(() => window.__islandDebug.pending());
check('canopy click', viaCrown === 'tree-beach', `pending=${viaCrown} at ${Math.round(crown.x)},${Math.round(crown.y)}`);
await stop();

// A click on open ground south-east of the hero walks there.
const before = await debug(() => window.__islandDebug.me());
const ground = await debug(([x, y]) => window.__islandDebug.project(x, y), [before.x + 200, before.y + 120]);
await page.mouse.click(ground.x, ground.y);
await page.waitForTimeout(3000);
const after = await debug(() => window.__islandDebug.me());
check('ground click', after.x - before.x > 60, `moved ${Math.round(after.x - before.x)} px east`);
await stop();

// Rotating to a portrait phone keeps the hero centred and the canvas sized to the window.
await page.setViewportSize({width: 390, height: 844});
await page.waitForTimeout(2500);
const meNow = await debug(() => window.__islandDebug.me());
const centre = await debug(([x, y]) => window.__islandDebug.project(x, y), [meNow.x, meNow.y]);
const canvas = await page.evaluate(() => { const c = document.querySelector('#game canvas'); return c ? [c.clientWidth, c.clientHeight] : null; });
check('resize', Math.abs(centre.x - 195) < 40 && centre.y > 0 && centre.y < 844 && canvas?.[0] === 390 && canvas?.[1] === 844, `hero at ${Math.round(centre.x)},${Math.round(centre.y)} canvas ${canvas}`);
await page.setViewportSize({width: 1280, height: 720});
await page.waitForTimeout(1500);

// Indoors: drawing stops but the island clock keeps running; leaving draws again.
await page.evaluate(() => document.body.classList.add('in-home'));
await page.waitForTimeout(500);
const st0 = await debug(() => window.__islandDebug.stats()), r0 = st0.rendered, s0 = st0.sounds, e0 = await debug(() => window.__islandDebug.world().elapsed);
await page.waitForTimeout(2500);
const st1 = await debug(() => window.__islandDebug.stats()), r1 = st1.rendered, s1 = st1.sounds, e1 = await debug(() => window.__islandDebug.world().elapsed);
await page.evaluate(() => document.body.classList.remove('in-home'));
await page.waitForTimeout(1500);
const r2 = (await debug(() => window.__islandDebug.stats())).rendered;
check('indoor pause', r1 === r0 && e1 - e0 > .5 && r2 > r1 && s1 > s0, `frames ${r0}->${r1}->${r2}, clock +${(e1 - e0).toFixed(2)} s, sound updates ${s0}->${s1}`);

// Typing in a text field must not walk the hero.
await page.evaluate(() => { const input = document.createElement('input'); input.id = 'qa-typing'; input.style.cssText = 'position:fixed;left:10px;top:10px'; document.body.append(input); input.focus(); });
const t0 = await debug(() => window.__islandDebug.me());
await page.keyboard.down('d'); await page.waitForTimeout(1200); await page.keyboard.up('d');
const t1 = await debug(() => window.__islandDebug.me());
await page.evaluate(() => document.getElementById('qa-typing')?.remove());
check('typing field', Math.abs(t1.x - t0.x) < 2, `moved ${Math.round(t1.x - t0.x)} px while typing`);

// If the 3D chunk cannot load, the game falls back to the 2D view and says so.
const broken = await browser.newPage({viewport: {width: 1280, height: 720}});
await broken.route(/island3d-.*\.js$/, route => route.abort());
await broken.goto(base + '/?qa&render=3d', {waitUntil: 'networkidle'});
await broken.waitForFunction(() => !document.body.classList.contains('render-3d'), null, {timeout: 30000}).catch(() => {});
const fallback = await broken.evaluate(() => ({render3d: document.body.classList.contains('render-3d'), canvas: !!document.querySelector('#game canvas'), stats: window.__islandDebug.stats() ?? null, toast: document.querySelector('#toast')?.textContent || ''}));
check('3d load failure falls back to 2D', !fallback.render3d && fallback.canvas && fallback.stats === null && /2D/.test(fallback.toast), JSON.stringify(fallback));
await broken.close();

check('3d no errors', !errors.length, errors.join('|') || 'none');
console.log(results.join('\n'));
await browser.close();
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
