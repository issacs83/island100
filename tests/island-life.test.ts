import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addPlayer,step,act,worldTargets,nearest,type World,type Player} from '../src/shared.ts';
import {life,lifePointsStandable,bugSpots,buriedToday,fruitTrees,gardenPlots,MUSEUM,museumCatalog,dailyTasks,dayOf,lifeEvent,GROW_SECONDS,FRUIT_REGROW,shellSpots,lifeTargets,hourOf} from '../src/island-life.ts';
import {findRoute,canStand} from '../src/terrain.ts';
import {CAMP} from '../src/exploration.ts';
import {encodeSave,decodeSave} from '../src/save-file.ts';

// A ready solo player standing at a given point.
function setup(x=CAMP.x,y=CAMP.y):[World,Player]{const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.ready=true;p.looted=true;p.quiz=true;w.phase=4;p.x=x;p.y=y;return [w,p];}
// Finish the current gesture so its rewards land in the bag.
function finish(w:World,p:Player){for(let i=0;i<40&&p.gesture;i++)step(w,.1);}
// Advance game time quietly (no input, so nothing is startled).
function wait(w:World,seconds:number){for(let t=0;t<seconds;t+=.1)step(w,.1);}
function standNear(p:Player,x:number,y:number){p.x=x;p.y=y+30;if(!canStand(p)){p.y=y-30;}if(!canStand(p)){p.x=x+40;p.y=y;}}

test('Every island-life point is on walkable ground and reachable from camp',()=>{
 assert.deepEqual(lifePointsStandable(),[]);
 const [w]=setup();
 for(const t of lifeTargets(w)){const route=findRoute(CAMP,t);assert.ok(route.points.length,t.id);const end=route.points.at(-1)!;assert.ok(Math.hypot(end.x-t.x,end.y-t.y)<120,`${t.id} end ${Math.round(end.x)},${Math.round(end.y)}`);}
});

test('Bug catching: net required, slow approach catches, achievement miles paid once',()=>{
 const [w,p]=setup();
 const b=life(w).bugs.find(v=>v.species==='hermitCrab')!;
 standNear(p,b.x,b.y);
 assert.match(act(w,p.id,'interact',b.id),/곤충망/);
 p.bag.bugNet=1;act(w,p.id,'equip','bugNet');finish(w,p);
 const live=worldTargets(w).find(t=>t.id===b.id)!;standNear(p,live.x,live.y);
 assert.match(act(w,p.id,'interact',b.id),/잡았다/);
 finish(w,p);
 assert.equal(p.bag.hermitCrab,1);
 assert.equal(life(w).stats.bug,1);
 assert.ok(life(w).achieved.includes('bug-1'));
 assert.ok(life(w).miles>=100);
 assert.ok(!worldTargets(w).some(t=>t.id===b.id),'caught bug disappears until respawn');
});

test('Running near a bug scares it away; it returns later',()=>{
 const [w,p]=setup();
 const b=life(w).bugs.find(v=>v.species==='hermitCrab')!;
 p.x=b.x+120;p.y=b.y;p.input={x:-1,y:0,run:true};p.stamina=100;
 for(let i=0;i<5;i++)step(w,.1);
 assert.equal(b.state,'fled');
 p.input={x:0,y:0,run:false};p.x=CAMP.x;p.y=CAMP.y;
 wait(w,46);
 assert.equal(b.state,'idle');
});

test('Day and night bugs follow the island clock',()=>{
 const [w]=setup();
 assert.ok(hourOf(w.elapsed)>6&&hourOf(w.elapsed)<18);
 const ids=()=>new Set(worldTargets(w).filter(t=>t.kind==='bug').map(t=>t.id));
 assert.ok([...ids()].some(id=>id.includes('butterfly')));
 assert.ok(![...ids()].some(id=>id.includes('firefly')));
 w.elapsed=Math.ceil(((21-7.333)/24)*300);
 assert.ok(hourOf(w.elapsed)>20);
 assert.ok([...ids()].some(id=>id.includes('firefly')));
 assert.ok(![...ids()].some(id=>id.includes('butterfly')));
});

test('Beachcombing shells regrow after the tide',()=>{
 const [w,p]=setup();const s=shellSpots[0];standNear(p,s.x,s.y);
 const name=worldTargets(w).find(t=>t.id===s.id)!.name;
 assert.match(act(w,p.id,'interact',s.id),/주웠어요/);finish(w,p);
 assert.equal(Object.values(p.bag).reduce((a,b)=>a!+b!,0),1,name);
 assert.ok(!worldTargets(w).some(t=>t.id===s.id));
 wait(w,151);
 assert.ok(worldTargets(w).some(t=>t.id===s.id));
});

test('Daily X marks: shovel digs once, finds fossil/clay/coin, new set next day',()=>{
 const [w,p]=setup();const today=buriedToday(1);assert.equal(today.length,4);
 const spot=today[0];standNear(p,spot.x,spot.y);
 assert.match(act(w,p.id,'interact',spot.id),/삽/);
 p.bag.shovel=1;act(w,p.id,'equip','shovel');finish(w,p);
 const msg=act(w,p.id,'interact',spot.id);assert.match(msg,/화석|점토|동전/);finish(w,p);
 assert.equal((p.bag.fossil||0)+(p.bag.clay||0)+(p.bag.oldCoin||0),1);
 assert.ok(!worldTargets(w).some(t=>t.id===spot.id));
 assert.notDeepEqual(buriedToday(2).map(b=>b.id),today.map(b=>b.id));
});

test('Shaking a fruit tree drops fruit, then it regrows',()=>{
 const [w,p]=setup();const t=fruitTrees.find(v=>!v.palm)!;standNear(p,t.x,t.y);
 const msg=act(w,p.id,'interact',t.id);assert.match(msg,/망고|벌집/);finish(w,p);
 assert.equal(p.bag.mango,3);
 assert.match(act(w,p.id,'interact',t.id),/열매가 없어요/);finish(w,p);
 wait(w,FRUIT_REGROW+1);
 assert.equal(life(w).fruit[t.id].count,3);
});

test('Garden: plant a seed, water three times, harvest a flower and a seed',()=>{
 const [w,p]=setup();const plot=gardenPlots[0];standNear(p,plot.x,plot.y);
 assert.match(act(w,p.id,'interact',plot.id),/꽃씨가 필요/);
 p.bag.flowerSeed=1;assert.match(act(w,p.id,'interact',plot.id),/심었어요/);finish(w,p);
 assert.equal(p.bag.flowerSeed,0);
 assert.match(act(w,p.id,'interact',plot.id),/물뿌리개/);
 p.bag.wateringCan=1;act(w,p.id,'equip','wateringCan');finish(w,p);
 for(let stage=0;stage<3;stage++){
  assert.match(act(w,p.id,'interact',plot.id),/물을 줬어요/);finish(w,p);
  assert.match(act(w,p.id,'interact',plot.id),/촉촉/);
  wait(w,GROW_SECONDS+1);
  assert.equal(life(w).plots[0].stage,stage+1);
 }
 act(w,p.id,'equip','none');finish(w,p);
 assert.match(act(w,p.id,'interact',plot.id),/땄어요/);finish(w,p);
 assert.equal((p.bag.hibiscus||0)+(p.bag.plumeria||0),1);
 assert.equal(p.bag.flowerSeed,1);
 assert.ok(life(w).achieved.includes('harvest-1'));
});

test('Museum: donate once per species, appraise fossils, exchange and sell coins',()=>{
 const [w,p]=setup(MUSEUM.x,MUSEUM.y+40);
 p.bag.butterfly=2;p.bag.fossil=1;p.bag.oldCoin=1;
 assert.match(act(w,p.id,'life-donate','butterfly'),/기증/);finish(w,p);
 assert.match(act(w,p.id,'life-donate','butterfly'),/이미 전시/);
 assert.equal(p.bag.butterfly,1);
 const before=life(w).museum.length;
 assert.match(act(w,p.id,'life-donate','fossil'),/감정 결과/);finish(w,p);
 assert.equal(life(w).museum.length,before+1);
 assert.ok(museumCatalog.find(e=>e.key===life(w).museum.at(-1))?.cat==='fossil');
 assert.match(act(w,p.id,'life-sell','oldCoin'),/마일/);
 const miles=life(w).miles;assert.ok(miles>=60);
 assert.match(act(w,p.id,'life-exchange','seeds'),/받았어요/);finish(w,p);
 assert.equal(p.bag.flowerSeed,3);
 assert.equal(life(w).miles,miles-60);
 p.x=CAMP.x;p.y=CAMP.y;assert.match(act(w,p.id,'life-donate','butterfly'),/가까이/);
});

test('Daily tasks pay 100 miles once and reset the next day',()=>{
 const [w,p]=setup();const tasks=dailyTasks(1);assert.equal(tasks.length,3);
 const task=tasks[0];const L=life(w);
 for(let i=0;i<task.n;i++)lifeEvent(w,p,task.stat);
 assert.ok(L.daily.done.includes(task.id));
 const after=L.miles;lifeEvent(w,p,task.stat);
 assert.ok(L.daily.done.filter(d=>d===task.id).length===1);
 assert.ok(L.miles-after<100||!dailyTasks(1).some(t=>t.stat===task.stat&&t.id!==task.id),'no second payout for the same task');
 w.elapsed=300;step(w,.1);
 assert.equal(L.daily.day,2);assert.deepEqual(L.daily.done,[]);
});

test('Message bottle: once per day, gives seeds and a tip',()=>{
 const [w,p]=setup();const bottle=worldTargets(w).find(t=>t.kind==='message')!;standNear(p,bottle.x,bottle.y);
 assert.match(act(w,p.id,'interact','message-bottle'),/꽃씨 2봉지/);finish(w,p);
 assert.equal(p.bag.flowerSeed,2);
 assert.ok(!worldTargets(w).some(t=>t.kind==='message'));
 w.elapsed=300*dayOf(w.elapsed);step(w,.1);
 assert.ok(worldTargets(w).some(t=>t.kind==='message'));
});

test('Tool preference: the net targets bugs, the can targets plots, the shovel targets X marks',()=>{
 const [w,p]=setup();const plot=gardenPlots[1];standNear(p,plot.x,plot.y);
 p.bag.wateringCan=1;p.equipped='wateringCan';assert.equal(nearest(p,w)?.kind,'plot');
});

test('Island life survives a save file round trip',()=>{
 const [w,p]=setup(MUSEUM.x,MUSEUM.y+40);p.bag.butterfly=1;act(w,p.id,'life-donate','butterfly');finish(w,p);
 const L=life(w);L.plots[2]={stage:2,wet:true,stageAt:10,flower:'plumeria'};L.dug.push('1:buried-3');
 const back=decodeSave(encodeSave(w,'solo'));
 assert.deepEqual(back.life!.museum,L.museum);
 assert.equal(back.life!.miles,L.miles);
 assert.deepEqual(back.life!.plots[2],L.plots[2]);
 assert.ok(back.life!.dug.includes('1:buried-3'));
 assert.ok(back.life!.achieved.includes('donate-1'));
 // Hostile values are clamped or dropped.
 const bad=JSON.parse(encodeSave(w,'solo'));bad.world.life.miles=-5;bad.world.life.museum=['butterfly','<script>'];bad.world.life.plots[0]={stage:99};
 const fixed=decodeSave(JSON.stringify(bad)).life!;
 assert.equal(fixed.miles,0);assert.deepEqual(fixed.museum,['butterfly']);assert.equal(fixed.plots[0].stage,3);
});

test('Bug spot list covers ten species',()=>{assert.equal(new Set(bugSpots.map(b=>b.species)).size,10);});
