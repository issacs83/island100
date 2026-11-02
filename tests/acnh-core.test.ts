// AC core pack v1: daily weather, recipe discovery, tool durability and villager move-ins.
import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addPlayer,step,act,worldTargets,landmarks,type World,type Player} from '../src/shared.ts';
import {life,weatherOf,fishingWaitFactor,stepLife,dayOf,hash01,gardenPlots,unlockRandomRecipe,craftRecipes,baseRecipes,toolDurability,usesLeft,villagerCandidates,villagerHome,villagersOf,lifePointsStandable} from '../src/island-life.ts';
import {friendNames} from '../src/island-social.ts';
import {canStand} from '../src/terrain.ts';
import {decodeSave,encodeSave} from '../src/save-file.ts';

function setup(x=CAMPX,y=CAMPY):[World,Player]{const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.ready=true;p.looted=true;p.quiz=true;w.phase=4;p.x=x;p.y=y;return [w,p];}
const CAMPX=1260,CAMPY=660;
function finish(w:World,p:Player){for(let i=0;i<60&&p.gesture;i++)step(w,.1);}
function at(p:Player,x:number,y:number){p.x=x;p.y=y+28;if(!canStand(p))p.y=y-28;}
const DAY=300;
function gotoDay(w:World,day:number,second=10){w.elapsed=(day-1)*DAY+second;}

test('Weather is deterministic, day 1 is sunny, and every day resolves to a valid type',()=>{
  assert.equal(weatherOf(1),'sunny');
  for(let day=1;day<=120;day++){
    const w=weatherOf(day);
    assert.ok(['sunny','cloudy','rain','storm'].includes(w),`day ${day}`);
    assert.equal(w,weatherOf(day),'deterministic');
  }
});

test('Rain waters the garden by itself and makes fish bite sooner',()=>{
  const rainDay=[2,3,4,5,6,7,8,9,10].find(d=>['rain','storm'].includes(weatherOf(d)))!;
  const [w,p]=setup();
  p.bag.flowerSeed=2;
  gotoDay(w,rainDay);
  const plot=gardenPlots[0];
  at(p,plot.x,plot.y);
  assert.match(act(w,p.id,'interact',plot.id),/심었어요/);
  finish(w,p);
  stepLife(w,[p],.05);
  assert.equal(life(w).plots[0].wet,true,'rain auto-waters planted plots');
  assert.ok(fishingWaitFactor(rainDay)<1,'fish bite sooner in rain');
  assert.equal(fishingWaitFactor(1),1,'day one waits normally');
});

test('New islands know only base recipes and locked recipes cannot be crafted',()=>{
  const [w,p]=setup();
  const L=life(w);
  for(const key of baseRecipes)assert.ok(L.recipes.includes(key),`base: ${key}`);
  assert.ok(!L.recipes.includes('leatherVest')&&!L.recipes.includes('bow'));
  p.x=1170;p.y=600;p.bag={hide:3,fiber:2};
  assert.match(act(w,p.id,'craft','leatherVest'),/아직 모르는 레시피/);
  assert.equal(p.bag.hide,3);
});

test('The daily bottle letter can unlock a recipe; the museum exchange also sells one',()=>{
  const [w,p]=setup();
  const L=life(w);
  const before=L.recipes.length;
  const key=unlockRandomRecipe(w,p,'test-bottle');
  assert.ok(key&&!L.recipes.slice(0,before).includes(key));
  assert.equal(L.recipes.length,before+1);
  // Exchange offer exists and pays out a recipe for miles.
  L.miles=200;
  p.x=1612;p.y=700;
  assert.match(act(w,p.id,'life-exchange','recipe'),/레시피/);
  assert.ok(L.recipes.length>=before+2);
});

test('Gather tools wear with use, break at the limit and can be repaired at the bench',()=>{
  const [w,p]=setup();
  const dig=landmarks.find(l=>l.id==='dig-beach')!;
  p.bag={shovel:1};p.equipped='shovel';
  at(p,dig.x,dig.y);
  w.resources['dig-beach']=3;
  act(w,p.id,'interact',dig.id);
  finish(w,p);
  assert.equal(p.toolUse?.shovel,1,'one dig wears the shovel once');
  assert.equal(usesLeft(p,'shovel'),toolDurability.shovel!-1);
  // Repair back to full (walk to the workbench first).
  p.x=1170;p.y=600;p.bag.wood=1;p.bag.stone=1;
  assert.match(act(w,p.id,'tool-repair','shovel'),/고쳤어요/);
  finish(w,p);
  assert.equal(p.toolUse?.shovel,0);
  assert.equal(usesLeft(p,'shovel'),toolDurability.shovel);
  assert.equal(p.bag.wood,0);
  // Break: at the wear limit the tool is consumed and announced.
  p.bag.shovel=1;p.equipped='shovel';p.toolUse={shovel:toolDurability.shovel!-1};
  w.resources['dig-beach']=3;
  at(p,dig.x,dig.y);
  const notice0=p.noticeSeq||0;
  act(w,p.id,'interact',dig.id);
  assert.equal(p.bag.shovel,0,'broken tool leaves the bag');
  assert.equal(p.equipped,undefined);
  assert.equal(p.toolUse?.shovel,0);
  assert.match(p.notice||'',/망가졌어요/);
});

test('Villagers move in on their days, appear as targets and befriend through talk',()=>{
  const [w,p]=setup();
  gotoDay(w,2);step(w,.05);
  assert.equal(villagersOf(w).length,0,'no neighbours on day 2');
  gotoDay(w,villagerCandidates[0].day);
  step(w,.05);
  const arrived=villagersOf(w);
  assert.equal(arrived.length,1);
  const first=villagerCandidates[0];
  assert.equal(arrived[0].name,first.name);
  assert.ok(friendNames(w).includes(first.name));
  // Walkable home and a world target to talk to.
  const home=villagerHome(first.id);
  assert.equal(lifePointsStandable().length,0,'villager homes are standable');
  const target=worldTargets(w).find(t=>t.id===first.name);
  assert.ok(target,'villager landmark exists');
  // Talking at their home raises friendship.
  at(p,home.x,home.y);
  const reply=act(w,p.id,'social-talk',{to:first.name});
  assert.match(reply,new RegExp(first.name));
  assert.ok((life(w).friendship[first.name]?.points||0)>=1);
});

test('Villagers and recipes survive the save file round-trip',()=>{
  const [w,p]=setup();
  gotoDay(w,villagerCandidates[0].day);
  step(w,.05);
  unlockRandomRecipe(w,p,'roundtrip');
  p.bag={shovel:1,wood:1,stone:1};p.equipped='shovel';p.toolUse={shovel:7};
  w.elapsed+=5;step(w,.05);
  const r=decodeSave(encodeSave(w,'solo'));
  assert.deepEqual(villagersOf(r).map(v=>v.name),[villagerCandidates[0].name]);
  assert.equal(life(r).recipes.length,life(w).recipes.length);
  assert.equal(r.players.solo.toolUse?.shovel,7);
  assert.equal(Object.keys(life(r).recipes).length>0,true);
});
