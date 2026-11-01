// Browser check: the solo island clock keeps real-time pace even when headless rendering is slow,
// and stops while a menu is open.
// Usage: BASE=http://127.0.0.1:8787 node qa/clock-play.mjs   (needs qa/fixtures from qa/second-wave-fixtures.ts)
import {chromium} from 'playwright';
const qaPath = '/?qa' + (process.env.RENDER ? '&render=' + process.env.RENDER : '');
const base = process.env.BASE || 'http://127.0.0.1:8787';
const browser = await chromium.launch({...(process.env.CHROME ? {executablePath: process.env.CHROME} : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
const page = await browser.newPage({viewport: {width: 1280, height: 720}});
const errors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(base + qaPath, {waitUntil: 'networkidle'});
await page.waitForTimeout(1200);
const [chooser] = await Promise.all([page.waitForEvent('filechooser', {timeout: 20000}), page.click('#load-save-start')]);
await chooser.setFiles('qa/fixtures/wave-sneak.island.json');
await page.waitForTimeout(3500);
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(600);
const elapsed = () => page.evaluate(() => window.__islandDebug.world().elapsed);
const fps = await page.evaluate(() => new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); }));
const results = [];
const check = (name, ok, detail) => results.push(`${ok ? 'PASS' : 'FAIL'} ${name} — ${detail}`);
let e0 = await elapsed(), t0 = Date.now();
await page.waitForTimeout(6000);
let game = await elapsed() - e0, real = (Date.now() - t0) / 1000;
check('clock keeps pace', game >= real * (fps >= 6 ? .85 : .6) && game <= real * 1.15, `${game.toFixed(2)} game s in ${real.toFixed(2)} real s at ${fps} fps`);
await page.keyboard.press('i');
await page.waitForTimeout(800);
e0 = await elapsed();
await page.waitForTimeout(3000);
game = await elapsed() - e0;
check('clock stops while the bag is open', Math.abs(game) < .05, `${game.toFixed(3)} game s passed with the bag open`);
await page.keyboard.press('Escape');
check('clock no errors', !errors.length, errors.join('|') || 'none');
console.log(results.join('\n'));
await browser.close();
process.exit(results.some(r => r.startsWith('FAIL')) ? 1 : 0);
