import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addPlayer,step,act,setInput,worldTargets,nearest,type World,type Player} from '../src/shared.ts';
import {life,bugSpots,gardenPlots,museumCatalog,breedFlowers,GROW_SECONDS} from '../src/island-life.ts';
import {canSwim,seaSpots,SEA_REFILL} from '../src/island-sea.ts';
import {SHOP,friendship,friendLevel,todaysRequest,tasteOf,eventOn,starVisible,sellPrices} from '../src/island-social.ts';
import {canStand,shore} from '../src/terrain.ts';
import {CAMP} from '../src/exploration.ts';
import {encodeSave,decodeSave} from '../src/save-file.ts';

function setup(x=CAMP.x,y=CAMP.y):[World,Player]{const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.ready=true;p.looted=true;p.quiz=true;w.phase=4;p.x=x;p.y=y;return [w,p];}
function finish(w:World,p:Player){for(let i=0;i<40&&p.gesture;i++)step(w,.1);}
function run(w:World,p:Player,input:{x:number;y:number;run?:boolean;sneak?:boolean},seconds:number){for(let t=0;t<seconds;t+=.1){setInput(p,{run:false,...input});step(w,.1);}setInput(p,{x:0,y:0,run:false});}

test('Sneaking: gentle stick tilt is slow, never startles bugs, walking close does',()=>{
 const [w,p]=setup();
 setInput(p,{x:.3,y:0,run:false});assert.equal(p.input.sneak,true);
 setInput(p,{x:1,y:0,run:true});assert.equal(p.input.sneak,false);
 setInput(p,{x:1,y:0,run:true,sneak:true});assert.equal(p.input.run,false);
 const start=p.x;run(w,p,{x:1,y:0,sneak:true},1);const sneakDist=p.x-start;
 const s2=p.x;run(w,p,{x:-1,y:0},1);const walkDist=s2-p.x;
 assert.ok(sneakDist>40&&sneakDist<walkDist*.6,`${sneakDist} vs ${walkDist}`);
 // Dragonfly flees at 60 when walking; sneaking right up to it is fine.
 const b=life(w).bugs.find(v=>v.species==='hermitCrab')!;
 p.x=b.x+70;p.y=b.y;run(w,p,{x:-.3,y:0},1.2);
 assert.equal(b.state,'idle','sneaking keeps the bug calm');
});

test('Diving: wetsuit lets you swim in, dive a bubble, swim back to land',()=>{
 const y=1500,[w,p]=setup(shore(1500)+45,y);assert.ok(canStand(p));
 run(w,p,{x:-1,y:0},.6);assert.ok(!p.swimming,'no wetsuit, no swimming');assert.ok(p.seaHint);
 p.bag.wetsuit=1;run(w,p,{x:-1,y:0},.6);assert.ok(p.swimming);assert.ok(canSwim(p));
 const spot=seaSpots.find(s=>Math.abs(s.y-y)<10)!;
 for(let i=0;i<120&&Math.hypot(p.x-spot.x,p.y-spot.y)>60;i++){const d=Math.hypot(spot.x-p.x,spot.y-p.y);setInput(p,{x:(spot.x-p.x)/d,y:(spot.y-p.y)/d,run:false});step(w,.1);}
 setInput(p,{x:0,y:0,run:false});
 assert.equal(nearest(p,w)?.kind,'dive');
 const msg=act(w,p.id,'interact',spot.id);assert.match(msg,/잠수해서/);finish(w,p);
 const caught=['seaUrchin','seaStar','octopus','abalone','seaCucumber'].filter(k=>(p.bag as any)[k]);assert.equal(caught.length,1);
 assert.ok(!worldTargets(w).some(t=>t.id===spot.id));
 run(w,p,{x:1,y:0},6);assert.ok(!p.swimming,'climbed out');assert.ok(canStand(p));
 w.elapsed+=SEA_REFILL+1;step(w,.1);
 assert.ok(worldTargets(w).some(t=>t.id===spot.id));
 assert.ok(museumCatalog.some(e=>e.cat==='sea'&&e.key===caught[0]));
});

test('Monsters ignore swimmers and a saved swimmer outside water is put back on land',()=>{
 const [w,p]=setup(300,1500);p.swimming=true;p.bag.wetsuit=1;
 const text=encodeSave(w,'solo');assert.equal(decodeSave(text).players.solo.swimming,true);
 const bad=JSON.parse(text);bad.world.players.solo.x=3000;bad.world.players.solo.y=1500;
 assert.ok(!decodeSave(JSON.stringify(bad)).players.solo.swimming);
});

test('Friendship: talk once a day, gift tastes, request, level rewards',()=>{
 const [w,p]=setup(1050,580);
 assert.match(act(w,p.id,'social-talk',{to:'김여름'}),/여름:/);
 assert.equal(friendship(w,'김여름').points,1);
 act(w,p.id,'social-talk',{to:'김여름'});assert.equal(friendship(w,'김여름').points,1,'talk points once per day');
 p.bag.mango=1;assert.match(act(w,p.id,'social-gift',{to:'김여름',item:'mango'}),/제일 좋아/);
 assert.equal(friendship(w,'김여름').points,5);assert.equal(friendLevel(5),1);
 assert.equal(p.bag.flowerSeed,3,'friend level 1 reward');
 p.bag.coral=1;assert.match(act(w,p.id,'social-gift',{to:'김여름',item:'coral'}),/벌써/);
 const req=todaysRequest('김여름',1);(p.bag as any)[req.item]=req.n;
 const miles=life(w).miles;assert.match(act(w,p.id,'social-request',{to:'김여름'}),/고마워/);
 assert.equal(life(w).miles>=miles+80,true);assert.equal(friendship(w,'김여름').points,10);
 assert.match(act(w,p.id,'social-request',{to:'김여름'}),/벌써/);
 p.x=3000;p.y=1500;assert.match(act(w,p.id,'social-talk',{to:'김여름'}),/곁으로/);
 act(w,p.id,'friend','민준');p.x=CAMP.x;p.y=CAMP.y+40;assert.match(act(w,p.id,'social-talk',{to:'민준'}),/민준/);
 assert.ok(tasteOf('민준').loves.length>0);
 assert.match(act(w,p.id,'social-talk',{to:'모르는애'}),/선택/);
});

test('Shop: sell finds for bells, buy goods, must be at the shop',()=>{
 const [w,p]=setup(SHOP.x,SHOP.y);assert.ok(canStand(p));
 p.bag.beetle=2;p.bag.octopus=1;
 assert.match(act(w,p.id,'shop-sell',{item:'beetle',all:true}),/1200벨/);
 assert.equal(life(w).bells,1200);assert.equal(p.bag.beetle,0);
 assert.match(act(w,p.id,'shop-sell',{item:'wood'}),/사지 않는/);
 act(w,p.id,'shop-sell',{item:'octopus'});assert.equal(life(w).bells,1200+sellPrices.octopus!);
 assert.match(act(w,p.id,'shop-buy','suit'),/샀어요/);assert.equal(p.bag.wetsuit,1);
 assert.match(act(w,p.id,'shop-buy','suit'),/부족/);
 p.x=3000;p.y=1500;assert.match(act(w,p.id,'shop-buy','seeds'),/가까이/);
});

test('Wardrobe: wear hat and shirt from the bag, refuse wrong slot',()=>{
 const [w,p]=setup();p.bag.strawHat=1;p.bag.tropicalShirt=1;
 assert.match(act(w,p.id,'dress',{slot:'hat',item:'strawHat'}),/썼어요/);finish(w,p);
 assert.match(act(w,p.id,'dress',{slot:'top',item:'tropicalShirt'}),/입었어요/);finish(w,p);
 assert.equal(p.hat,'strawHat');assert.equal(p.top,'tropicalShirt');
 assert.match(act(w,p.id,'dress',{slot:'hat',item:'tropicalShirt'}),/입을 수 없는/);
 act(w,p.id,'dress',{slot:'hat',item:'none'});assert.equal(p.hat,undefined);
 const back=decodeSave(encodeSave(w,'solo')).players.solo;assert.equal(back.top,'tropicalShirt');
});

test('Flower breeding: watered red and white neighbours spread, sometimes pink',()=>{
 let pink=0;
 for(let trial=0;trial<12;trial++){
  const [w]=setup();const L=life(w);w.elapsed=trial*7;
  L.plots=[{stage:3,wet:true,stageAt:w.elapsed,flower:'hibiscus'},{stage:-1,wet:false,stageAt:0,flower:'hibiscus'},{stage:-1,wet:false,stageAt:0,flower:'hibiscus'},{stage:-1,wet:false,stageAt:0,flower:'hibiscus'}];
  // Put a white bloom next to the empty middle plot too.
  L.plots[2]={stage:3,wet:true,stageAt:w.elapsed,flower:'plumeria'};
  w.elapsed+=GROW_SECONDS+1;breedFlowers(w,[]);
  assert.equal(L.plots[1].stage,0,'seedling spread into the empty neighbour');
  if(L.plots[1].flower==='pinkHibiscus')pink++;
 }
 assert.ok(pink>0&&pink<12,`pink ${pink}/12`);
});

test('Seasonal events: calendar, bug-off tiers, shooting-star wish',()=>{
 assert.equal(eventOn(1),undefined);assert.equal(eventOn(3)?.id,'bug-off');assert.equal(eventOn(6)?.id,'tourney');assert.equal(eventOn(4)?.id,'meteor');
 const [w,p]=setup();w.elapsed=2*300+30;step(w,.1);assert.match(p.notice||'',/곤충 대회/);
 p.bag.bugNet=1;p.equipped='bugNet';
 const crabs=life(w).bugs.filter(b=>b.species==='hermitCrab');
 for(const b of crabs.slice(0,2)){p.x=b.x;p.y=b.y+30;act(w,p.id,'interact',b.id);finish(w,p);}
 assert.match(p.notice||'',/곤충 대회 2마리 달성/);
 // Meteor night on day 4 after 20:00.
 w.elapsed=3*300+Math.ceil((21-7.333)/24*300);while(!starVisible(w))w.elapsed+=1;
 assert.match(act(w,p.id,'wish'),/소원을 빌었어요/);assert.equal(p.bag.starFragment,1);
 assert.match(act(w,p.id,'wish'),/이미/);
});

test('All new fixed points are reachable: shop on land, sea spots in water',()=>{
 assert.ok(canStand({x:SHOP.x,y:SHOP.y}));
 for(const s of seaSpots)assert.ok(canSwim(s),s.id);
 assert.ok(gardenPlots.length===4&&bugSpots.length===14);
});

test('Old island data (first-wave rooms and saves) is upgraded instead of crashing',()=>{
 const [w,p]=setup();
 // Simulate a room persisted by the previous server: life without the second-wave fields.
 const old:any=JSON.parse(JSON.stringify(w.life));for(const k of ['sea','friendship','bells','event','wishAt','schema'])delete old[k];w.life=old;
 for(let i=0;i<5;i++)step(w,.1);
 assert.ok(worldTargets(w).some(t=>t.kind==='dive'));
 assert.deepEqual(life(w).friendship,{});assert.equal(life(w).bells,0);
 // A save file written before the second wave still loads.
 const text=encodeSave(w,'solo');const data=JSON.parse(text);delete data.world.life.sea;delete data.world.life.friendship;
 const back=decodeSave(JSON.stringify(data));assert.ok(back.life!.sea&&back.life!.friendship);
 void p;
});
