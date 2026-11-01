// Fixed-spot shots of the 2D and 3D views at 1280×720 plus phone shots, with fps and draw calls per 3D shot.
// Usage: BASE=… OUT=dir node qa/view3d-shots.mjs   (needs qa/fixtures from qa/view3d-shot-fixtures.ts)
import {chromium} from 'playwright';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
const base = process.env.BASE || 'http://127.0.0.1:8787', out = process.env.OUT || 'qa/shots-3d';
mkdirSync(out, {recursive: true});
const spots = JSON.parse(readFileSync('qa/fixtures/shot-spots.json', 'utf8'));
const browser = await chromium.launch({...(process.env.CHROME ? {executablePath: process.env.CHROME} : {}), args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader']});
const stats = {}, problems = [];
async function shoot(spot, render, phone, file) {
  const ctx = await browser.newContext(phone ? {viewport: {width: 390, height: 844}, hasTouch: true, isMobile: true} : {viewport: {width: 1280, height: 720}});
  const page = await ctx.newPage(), errors = [];
  page.on('pageerror', e => errors.push(e.message));
  // A slow software-rendered page can miss the first file chooser; reload once before giving up.
  let chooser;
  for (let attempt = 0; attempt < 2 && !chooser; attempt++) {
    await page.goto(base + '/?qa' + (render ? '&render=3d' : ''), {waitUntil: 'networkidle'});
    await page.waitForTimeout(render ? 3000 : 1200);
    chooser = await Promise.all([page.waitForEvent('filechooser', {timeout: 45000}), page.click('#load-save-start')]).then(([c]) => c, () => undefined);
  }
  if (!chooser) throw new Error(`${file}: the save file chooser never opened`);
  await chooser.setFiles(`qa/fixtures/shot-${spot.key}.island.json`);
  await page.waitForTimeout(render ? 6000 : 3500);
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(2500);
  const s = render ? await page.evaluate(() => window.__islandDebug.stats()) : undefined;
  await page.screenshot({path: `${out}/${file}.png`});
  await ctx.close();
  if (errors.length) problems.push(`${file}: ${errors.join(' | ')}`);
  return s;
}
for (const spot of spots) {
  await shoot(spot, false, false, `${spot.key}-2d`);
  stats[spot.key] = await shoot(spot, true, false, `${spot.key}-3d`);
  if (spot.phone) stats[`${spot.key}-phone`] = await shoot(spot, true, true, `${spot.key}-phone-3d`);
}
writeFileSync(`${out}/stats.json`, JSON.stringify(stats, null, 1));
console.log(Object.entries(stats).map(([k, v]) => `${k}: fps ${v?.fps} draw ${v?.calls}`).join('\n'));
console.log(problems.length ? `errors:\n${problems.join('\n')}` : 'errors: none');
await browser.close();
