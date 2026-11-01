// Browser QA: loads region save files into the real game and captures desktop/mobile screenshots.
// Usage: BASE=http://127.0.0.1:7749 MODES=desk|mob|both node qa/browser-shots.mjs camp meadow ...
// Fixtures come from: npx tsx qa/region-fixtures.ts (writes qa/fixtures/*.island.json).
import {chromium} from 'playwright';
const base=process.env.BASE||'http://127.0.0.1:8787';
const out=process.env.OUT||'qa/shots';
const spots=process.argv.slice(2);
const modes=process.env.MODES==='mob'?[[390,844,'mob']]:process.env.MODES==='desk'?[[1280,720,'desk']]:[[1280,720,'desk'],[390,844,'mob']];
const {mkdirSync}=await import('node:fs');mkdirSync(out,{recursive:true});
// CHROME lets a sandbox point at a preinstalled browser; otherwise Playwright's own build is used.
const browser=await chromium.launch({...(process.env.CHROME?{executablePath:process.env.CHROME}:{}),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
let failures=0;
for(const [width,height,tag] of modes){
 for(const spot of spots){
  const ctx=await browser.newContext({viewport:{width,height},hasTouch:tag==='mob',isMobile:tag==='mob'});
  const page=await ctx.newPage();const errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  await page.goto(base+'/',{waitUntil:'networkidle'});
  await page.waitForTimeout(1500);
  // Load the region save through the real start-screen file picker.
  const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:20000}),page.click('#load-save-start')]);
  await chooser.setFiles(`qa/fixtures/${spot}.island.json`);
  await page.waitForTimeout(5000);
  await page.keyboard.press('Escape').catch(()=>{});
  await page.waitForTimeout(800);
  await page.screenshot({path:`${out}/${tag}-${spot}.png`});
  if(errors.length)failures++;
  console.log(tag,spot,errors.length?'ERRORS: '+errors.slice(0,3).join(' | '):'ok');
  await ctx.close();
 }
}
await browser.close();
process.exit(failures?1:0);
