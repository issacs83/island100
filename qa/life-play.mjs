// Browser play-test for island life. Loads each fixture through the real start screen, then plays it
// with the keyboard/mouse like a person would and records screenshots plus the game's own messages.
// Usage: BASE=http://127.0.0.1:8787 node qa/life-play.mjs   (CHROME=/path optional)
import {chromium} from 'playwright';
import {mkdirSync} from 'node:fs';
const qaPath = '/?qa' + (process.env.RENDER ? '&render=' + process.env.RENDER : '');
const base=process.env.BASE||'http://127.0.0.1:8787',out=process.env.OUT||'qa/shots';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({...(process.env.CHROME?{executablePath:process.env.CHROME}:{}),args:['--use-gl=swiftshader','--enable-unsafe-swiftshader']});
const results=[];let failed=0;
async function open(fixture,{mobile=false}={}){const ctx=await browser.newContext(mobile?{viewport:{width:390,height:844},hasTouch:true,isMobile:true}:{viewport:{width:1280,height:720}});const page=await ctx.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});await page.goto(base+qaPath,{waitUntil:'networkidle'});await page.waitForTimeout(1200);const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:20000}),page.click('#load-save-start')]);await chooser.setFiles(`qa/fixtures/${fixture}.island.json`);await page.waitForTimeout(3500);await page.keyboard.press('Escape').catch(()=>{});await page.waitForTimeout(600);return {ctx,page,errors};}
const toast=page=>page.locator('#toast').textContent();
// Wait until the hero's current action has really finished (headless rendering can be slow).
async function settle(page,max=30000){await page.waitForFunction(()=>{const p=window.__islandDebug?.me();return p&&!p.gesture&&!p.swing;},null,{timeout:max});await page.waitForTimeout(150);}
const state=page=>page.evaluate(()=>{const p=window.__islandDebug.me(),w=window.__islandDebug.world();return {bag:p.bag,equipped:p.equipped,life:w.life};});
const label=page=>page.locator('#interact span').textContent();
function check(name,ok,detail){results.push(`${ok?'PASS':'FAIL'} ${name} — ${detail}`);if(!ok)failed++;}
async function pressE(page){await page.keyboard.press('e');await page.waitForTimeout(250);const t=await toast(page);await settle(page);return t;}
async function bag(page){await page.keyboard.press('i');await page.waitForTimeout(500);const text=await page.locator('#panel').innerText();await page.keyboard.press('Escape');await page.waitForTimeout(300);return text;}

// 1. Bug catching with the net (hermit crab on the beach).
{const {ctx,page,errors}=await open('life-bug');await page.screenshot({path:`${out}/life-1-bug-before.png`});const l=await label(page);await page.keyboard.press('e');await page.waitForTimeout(700);const t=await toast(page);await page.screenshot({path:`${out}/life-1-bug-swing.png`});await settle(page);await bag(page);const st=await state(page);check('bug catch',/소라게/.test(t)&&st.bag.hermitCrab===1,`label="${l}" toast="${t}"`);check('bug no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 2. Garden: plant, equip can, water.
{const {ctx,page,errors}=await open('life-garden');const l1=await label(page);const t1=await pressE(page);await page.keyboard.press('q');await page.waitForTimeout(500);const canBtn=page.locator('[data-quick-tool="wateringCan"]');await canBtn.click();await page.waitForTimeout(300);await settle(page);const l2=await label(page);await page.keyboard.press('e');await page.waitForTimeout(900);const t2=await toast(page);await page.screenshot({path:`${out}/life-2-garden-water.png`});await settle(page);check('garden plant',/심었어요/.test(t1),`label="${l1}" toast="${t1}"`);check('garden water',/물을 줬어요/.test(t2),`label="${l2}" toast="${t2}"`);check('garden no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 3. Grown garden visuals + harvest.
{const {ctx,page,errors}=await open('life-garden-grown');await page.screenshot({path:`${out}/life-3-garden-grown.png`});const t=await pressE(page);check('garden harvest',/땄어요/.test(t),`toast="${t}"`);check('grown no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 4. Museum: open, donate, browse encyclopedia, miles, exchange.
{const {ctx,page,errors}=await open('life-museum');await page.screenshot({path:`${out}/life-4-museum-world.png`});await page.keyboard.press('e');await page.waitForTimeout(600);await page.screenshot({path:`${out}/life-4-museum-donate.png`});await page.locator('[data-donate="hermitCrab"]').click();await page.waitForTimeout(500);const t1=await toast(page);await page.locator('[data-donate="fossil"]').click();await page.waitForTimeout(500);const t2=await toast(page);await page.locator('[data-tab="book"]').click();await page.waitForTimeout(400);await page.screenshot({path:`${out}/life-4-museum-book.png`});await page.locator('[data-tab="miles"]').click();await page.waitForTimeout(400);await page.screenshot({path:`${out}/life-4-museum-miles.png`});await page.locator('[data-tab="shop"]').click();await page.waitForTimeout(400);await page.locator('[data-offer="seeds"]').click();await page.waitForTimeout(500);const t3=await toast(page);await page.screenshot({path:`${out}/life-4-museum-shop.png`});check('museum donate',/기증했어요/.test(t1),t1);check('fossil appraisal',/감정 결과/.test(t2),t2);check('exchange',/받았어요/.test(t3),t3);check('museum no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 5. Fruit tree shake.
{const {ctx,page,errors}=await open('life-fruit');const l=await label(page);await page.keyboard.press('e');await page.waitForTimeout(2500);await page.screenshot({path:`${out}/life-5-fruit-shake.png`});const t=await toast(page);await settle(page);await bag(page);const st=await state(page);check('fruit shake',/망고|벌집/.test(t)&&st.bag.mango===3,`label="${l}" toast="${t}"`);check('fruit no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 6. Dig the daily X mark.
{const {ctx,page,errors}=await open('life-dig');await page.screenshot({path:`${out}/life-6-dig-before.png`});const l=await label(page);const t=await pressE(page);check('dig X',/화석|점토|동전/.test(t),`label="${l}" toast="${t}"`);check('dig no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 7. Night fireflies.
{const {ctx,page,errors}=await open('life-night');await page.waitForTimeout(800);await page.screenshot({path:`${out}/life-7-night-firefly.png`});const t=await pressE(page);check('firefly catch',/반딧불이/.test(t),`toast="${t}"`);check('night no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
// 8. Mobile museum panel layout.
{const {ctx,page,errors}=await open('life-museum',{mobile:true});await page.screenshot({path:`${out}/life-8-mobile-world.png`});await page.locator('#interact').tap();await page.waitForTimeout(600);await page.locator('[data-tab="miles"]').tap();await page.waitForTimeout(400);await page.screenshot({path:`${out}/life-8-mobile-miles.png`});check('mobile no errors',!errors.length,errors.join('|')||'none');await ctx.close();}
await browser.close();
console.log(results.join('\n'));process.exit(failed?1:0);
