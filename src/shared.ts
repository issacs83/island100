import {housingAction,type House} from './housing';
import {stepSwimmer,seaTargets,seaInteract} from './island-sea';
import {socialAction,socialTargets,socialInteract,stepSocial,eventCatch} from './island-social';
import {lifeItemNames,lifeFoods,lifeTools,lifeTargets,lifeInteract,lifeAction,lifeEvent,stepLife,emptyLife,craftRecipes,knowsRecipe,repairTool,wearTool,toolDurability,fishingWaitFactor,villagerByName,type LifeItem,type LifeState} from './island-life';
import {WORLD_WIDTH,WORLD_HEIGHT,frontierLandmarks} from './world-layout';
import {renewResources,resourceWait,resourceRules} from './resources';
import {reveal,CAMP} from './exploration';
import {moveOnGround,nearestGround,canStand,clearSight,findRoute,shore as coastShore} from './terrain';
export type Item = LifeItem|'ironOre'|'leatherVest'|'shovel'|'bottle'|'pot'|'rawWater'|'water'|'ration'|'coconut'|'fish'|'wood'|'fiber'|'rod'|'stone'|'worm'|'shrimp'|'rawFish'|'reefFish'|'woodKnife'|'woodSpear'|'bow'|'stoneKnife'|'stoneSpear'|'axe'|'pickaxe'|'basket'|'grilledReef'|'torch'|'arrow'|'rawMeat'|'cookedMeat'|'hide';
export type Input = {x:number;y:number;run:boolean;sneak?:boolean};
export type Player = {swimming?:boolean;seaHint?:boolean;hat?:Item;top?:Item;eventDay?:number;room?:{x:number;y:number;pose:string};toolUse?:Partial<Record<Item,number>>;id:string;name:string;color:number;x:number;y:number;hp:number;water:number;food:number;stamina:number;bag:Partial<Record<Item,number>>;looted:boolean;quiz:boolean;online:boolean;ready:boolean;input:Input;face:number;walk:number;moving?:boolean;blocked?:boolean;survey?:string;equipped?:Item;gesture?:{kind:'pickup'|'dig'|'equip'|'fill'|'cook'|'craft'|'eat'|'drink'|'mine'|'cut'|'net'|'shake'|'water'|'plant'|'dive';remaining:number;duration?:number;item?:Item;target?:string;rewards?:Partial<Record<Item,number>>;nutrition?:{food:number;water:number};phase?:number};swing?:{kind:'chop'|'attack';remaining:number;target:string;hit?:boolean;weapon?:Item;aimX?:number;aimY?:number};notice?:string;noticeSeq?:number;activity?:{kind:'fishing';remaining:number;catch:Item;stage?:'cast'|'wait'|'bite'|'reel'|'show'};catches?:number;collected?:Partial<Record<Item,number>>;armor?:'leatherVest';hurtAt?:number;reward?:{item:Item;n:number;seq:number}};
export type Animal={id:string;species:'rabbit'|'boar';x:number;y:number;homeX:number;homeY:number;hp:number;maxHp:number;face:number;moving:boolean;respawnAt:number;hitAt?:number};
export type Monster={id:string;species:'slime'|'shadow';x:number;y:number;hp:number;maxHp:number;cooldown:number;windup:number;target?:string;hitAt?:number;moving:boolean};
export type Companion={x:number;y:number;face:number;walk:number;moving:boolean;mode:'explore'|'follow'|'camp'|'rest';wait:number;repath:number;stop:number;route:{x:number;y:number}[]};
export type Friend = {name:string;color:number};
export type World = {life?:LifeState;house?:House;resourceReady?:Record<string,number>;version:2;code:string;elapsed:number;phase:number;players:Record<string,Player>;friends:Friend[];explored?:string[];animals?:Animal[];monsters?:Monster[];monsterNight?:number;companion?:Companion;cutAt?:Record<string,number>;woodDrops?:Record<string,number>;campLevel?:number;campColor?:number;storage?:Partial<Record<Item,number>>;resources:Record<string,number>};
export type Landmark = {id:string;name:string;x:number;y:number;kind:string};
export const WIDTH=WORLD_WIDTH, HEIGHT=WORLD_HEIGHT, DAY_SECONDS=300;
export const dayNumber=(elapsed:number)=>Math.floor(elapsed/DAY_SECONDS)+1;
export const landmarks:Landmark[]=[
 {id:'dig-beach',name:'부드러운 모래 · 삽으로 파기',x:1000,y:705,kind:'dig'},
 {id:'dig-jungle',name:'축축한 흙 · 삽으로 파기',x:2180,y:680,kind:'dig'},
 {id:'bag',name:'떠밀려 온 가방',x:1070,y:650,kind:'bag'},
 {id:'yeoreum',name:'김여름',x:1050,y:545,kind:'friend'},
 {id:'rain',name:'빗물이 고인 통',x:1330,y:450,kind:'rain'},
 {id:'camp',name:'우리의 캠프',x:1260,y:590,kind:'camp'},
 {id:'workbench',name:'제작대',x:1170,y:580,kind:'workbench'},
 {id:'stone',name:'작은 돌',x:1170,y:700,kind:'stone'},
 {id:'worm',name:'지렁이 미끼 찾기',x:1390,y:500,kind:'worm'},
 {id:'shrimp',name:'새우 미끼 찾기',x:870,y:710,kind:'shrimp'},
 {id:'reef-fishing',name:'산호 물고기 낚시 자리',x:850,y:760,kind:'reef-fishing'},
 {id:'wood1',name:'떠밀려 온 나뭇가지',x:1260,y:710,kind:'wood'},
 {id:'wood2',name:'마른 나뭇가지',x:1060,y:760,kind:'wood'},
 {id:'fiber',name:'튼튼한 풀줄기',x:1430,y:560,kind:'fiber'},
 {id:'coconut',name:'떨어진 코코넛',x:1180,y:770,kind:'coconut'},
 {id:'tree-beach',name:'코코넛 야자나무',x:1465,y:645,kind:'tree'},
 {id:'tree-grove',name:'숲 입구 나무',x:1850,y:573,kind:'tree'},
 {id:'tree-jungle',name:'정글 나무',x:2640,y:715,kind:'tree'},
 {id:'fishing',name:'낚시 자리',x:785,y:610,kind:'fishing'},
 {id:'jungle',name:'정글 입구',x:1320,y:350,kind:'jungle'},
 {id:'dock',name:'낡은 부두 · 바다 구경',x:880,y:2050,kind:'dock'},
 {id:'lighthouse',name:'작은 등대 · 밤불',x:6350,y:3350,kind:'lighthouse'},
 {id:'pool',name:'정글의 샘',x:2460,y:490,kind:'rain'},
 {id:'jungle-wood',name:'정글 나뭇가지',x:2050,y:640,kind:'wood'},
 {id:'jungle-fiber',name:'정글 풀줄기',x:2690,y:680,kind:'fiber'},
 {id:'cave',name:'동굴 입구',x:3090,y:430,kind:'cave'},
 ...frontierLandmarks,
];
export const itemNames:Record<Item,string>={ironOre:'철광석',...lifeItemNames,leatherVest:'가죽 조끼',shovel:'삽',bottle:'물병',pot:'냄비',rawWater:'처리 전 물',water:'안전한 물',ration:'비상식량',coconut:'코코넛',fish:'구운 생선',wood:'목재',fiber:'풀줄기',rod:'낚싯대',stone:'돌',worm:'지렁이 미끼',shrimp:'새우 미끼',rawFish:'작은 물고기',reefFish:'산호 물고기',woodKnife:'나무칼',woodSpear:'나무창',bow:'활',stoneKnife:'돌칼',stoneSpear:'돌창',axe:'돌도끼',pickaxe:'돌곡괭이',basket:'바구니',grilledReef:'구운 산호 생선',torch:'횃불',arrow:'화살',rawMeat:'생고기',cookedMeat:'구운 고기',hide:'가죽'};
export const foods:Partial<Record<Item,{food:number;water:number}>>={...lifeFoods,ration:{food:35,water:0},coconut:{food:15,water:0},fish:{food:30,water:0},grilledReef:{food:45,water:0},water:{food:0,water:35},cookedMeat:{food:40,water:0}};
export const recipes:Partial<Record<Item,Partial<Record<Item,number>>>>=craftRecipes as Partial<Record<Item,Partial<Record<Item,number>>>>;
export const equipable:Item[]=[...lifeTools,'shovel','rod','woodKnife','woodSpear','bow','stoneKnife','stoneSpear','axe','pickaxe','bottle','pot','basket','torch'];
export const tools=equipable.map(k=>itemNames[k]);
export const toolDamage:Partial<Record<Item,number>>={woodKnife:1,woodSpear:2,bow:2,stoneKnife:2,stoneSpear:3,axe:2,pickaxe:2};
export function makeAnimals():Animal[]{return [{id:'rabbit-1',species:'rabbit',x:2400,y:630,hp:2,maxHp:2},{id:'rabbit-2',species:'rabbit',x:1700,y:690,hp:2,maxHp:2},{id:'boar-1',species:'boar',x:2920,y:530,hp:4,maxHp:4},...Array.from({length:6},(_,i)=>({id:`frontier-animal-${i}`,species:i%2?'boar':'rabbit',x:2200+(i%3)*1300,y:1600+Math.floor(i/3)*1300,hp:i%2?4:2,maxHp:i%2?4:2}))].map(a=>({...a,homeX:a.x,homeY:a.y,face:1,moving:false,respawnAt:0})) as Animal[];}
export function nightStrength(elapsed:number){const hour=(7.333+(elapsed%DAY_SECONDS)*24/DAY_SECONDS)%24;return hour>=20||hour<5?1:hour>=18?(hour-18)/2:hour<7?(7-hour)/2:0;}
export const shore=coastShore;
export function rightEdge(_y:number){return WIDTH-70;}
export function emptyWorld(code='SOLO'):World{return {version:2,code,elapsed:0,phase:0,players:{},friends:[],explored:reveal([],CAMP,340),animals:makeAnimals(),life:emptyLife(),resources:Object.fromEntries(Object.entries(resourceRules).map(([id,r])=>[id,r.capacity]))};}
export function cleanName(name:unknown){return typeof name==='string'?name.trim().replace(/[<>\u0000-\u001f]/g,'').slice(0,12):'';}
export function addPlayer(w:World,id:string,name:string):Player {const index=Object.keys(w.players).length; const p:Player={id,name:cleanName(name)||'친구',color:index%4,x:930+(index%4)*30,y:610+(index%4)*20,hp:100,water:68,food:72,stamina:100,bag:{},looted:false,quiz:false,online:true,ready:false,input:{x:0,y:0,run:false},face:1,walk:0};w.players[id]=p;w.explored=reveal(w.explored,p);return p;}
export function setInput(p:Player,v:unknown){if(p.activity||p.swing||p.gesture){p.input={x:0,y:0,run:false};return;}if(!v||typeof v!=='object')return;const a=v as Input;const x=Number.isFinite(a.x)?Math.max(-1,Math.min(1,a.x)):0;const y=Number.isFinite(a.y)?Math.max(-1,Math.min(1,a.y)):0;const magnitude=Math.hypot(x,y),len=Math.max(1,magnitude);
 // Sneaking: an explicit sneak key, or a gentle joystick tilt (like tiptoeing with a light stick push).
 const sneak=a.sneak===true||(magnitude>.05&&magnitude<.5);p.input={x:x/len,y:y/len,run:a.run===true&&!sneak,sneak};}
export function step(w:World,dt:number){
 dt=Math.min(.1,Math.max(0,dt));const active=Object.values(w.players).filter(p=>p.online&&(p.ready||p.room));if(!active.length)return;w.elapsed+=dt;renewResources(w);
 for(const p of active){
  if(!p.swimming&&!canStand(p)){const safe=nearestGround(p);p.x=safe.x;p.y=safe.y;}
  if(p.gesture){p.input={x:0,y:0,run:false};p.gesture.remaining-=dt;if(p.gesture.remaining<=0){const g=p.gesture;for(const [item,n]of Object.entries(g.rewards||{}))put(p,item as Item,n);if(g.kind==='craft'&&g.item&&toolDurability[g.item])p.toolUse={...p.toolUse,[g.item]:0};if(g.nutrition){p.food=Math.min(100,p.food+g.nutrition.food);p.water=Math.min(100,p.water+g.nutrition.water);}if(g.phase)w.phase=Math.max(w.phase,g.phase);p.gesture=undefined;}}
  if(p.swing){p.input={x:0,y:0,run:false};p.swing.remaining-=dt;if(!p.swing.hit&&p.swing.remaining<=.27){p.swing.hit=true;if(p.swing.kind==='attack')resolveStrike(w,p);else{const tree=landmarks.find(l=>l.id===p.swing!.target);if(tree&&Math.hypot(p.x-tree.x,p.y-tree.y)<120&&clearSight(p,tree,tree.id)&&w.resources[tree.id]>0){w.resources[tree.id]--;wearTool(w,p,'axe');if(!w.resources[tree.id]){(w.cutAt??={})[tree.id]=w.elapsed;(w.woodDrops??={})[tree.id]=5;announce(p,'나무가 쓰러졌어요! 밑동 옆 목재를 챙기세요.');lifeEvent(w,p,'chop');}}}}if(p.swing.remaining<=0)p.swing=undefined;}
  if(p.activity){const a=p.activity;a.stage??='cast';a.remaining-=dt;p.input={x:0,y:0,run:false};if(a.remaining<=0){if(a.stage==='cast'){a.stage='wait';a.remaining=(1.6+(Math.sin(w.elapsed*3)+1)*.7)*fishingWaitFactor(dayNumber(w.elapsed));}else if(a.stage==='wait'){a.stage='bite';a.remaining=1.6;announce(p,'입질! 지금 당기기 버튼이나 E를 누르세요!');}else if(a.stage==='bite'){p.activity=undefined;announce(p,'물고기가 미끼만 먹고 달아났어요. 찌가 잠기면 당겨요!');}else if(a.stage==='reel'){a.stage='show';a.remaining=1.2;}else{put(p,a.catch);wearTool(w,p,'rod');p.activity=undefined;p.catches=(p.catches||0)+1;lifeEvent(w,p,'fish');eventCatch(w,p,'fish');}}}

  if(p.room){p.input={x:0,y:0,run:false};p.moving=false;p.blocked=false;p.stamina=Math.min(100,p.stamina+dt*12);continue;}
  // Sea: swimming movement and entering/leaving the water are handled by the diving module.
  if(stepSwimmer(w,p,dt)){p.blocked=false;continue;}
  const intended=Math.hypot(p.input.x,p.input.y)>.01,wantsRun=intended&&p.input.run&&p.stamina>2,speed=wantsRun?195:p.input.sneak?62:128;
  const before={x:p.x,y:p.y},next=moveOnGround(p,p.input.x*speed*dt,p.input.y*speed*dt),distance=Math.hypot(next.x-p.x,next.y-p.y);
  p.x=next.x;p.y=next.y;const survey=`${Math.floor(p.x/40)},${Math.floor(p.y/40)}`;if(!w.explored||p.survey!==survey){w.explored=reveal(w.explored||reveal([],CAMP,340),p);p.survey=survey;}p.moving=distance>.01;p.blocked=intended&&distance<speed*dt*.35;
  const running=p.moving&&wantsRun;
  p.stamina=Math.max(0,Math.min(100,p.stamina+(running?-18:12)*dt));p.water=Math.max(0,p.water-(running?.08:.025)*dt);p.food=Math.max(0,p.food-.018*dt);
  if(p.moving){if(Math.abs(next.x-before.x)>.01)p.face=next.x<before.x?-1:1;p.walk+=distance/12.8;}
  if(!p.moving&&Math.hypot(p.x-CAMP.x,p.y-CAMP.y)<150&&p.water>0&&p.food>0)p.hp=Math.min(100,p.hp+dt);
  if(p.water===0||p.food===0)p.hp=Math.max(0,p.hp-.4*dt);
  if(p.hp===0){p.swimming=false;const safe=nearestGround({x:1260,y:660});p.x=safe.x;p.y=safe.y;p.hp=65;p.water=35;p.food=35;}
 }
 const outdoors=active.filter(p=>!p.room);
 stepCompanion(w,outdoors,dt);
 stepLife(w,outdoors,dt);
 stepSocial(w,outdoors);
 stepMonsters(w,outdoors,dt);
 w.animals??=makeAnimals();for(const animal of w.animals){if(animal.hp<=0){if(w.elapsed>=animal.respawnAt){const safe=nearestGround({x:animal.homeX,y:animal.homeY});animal.x=safe.x;animal.y=safe.y;animal.hp=animal.maxHp;}continue;}const close=outdoors.find(p=>Math.hypot(p.x-animal.x,p.y-animal.y)<125);const angle=close?Math.atan2(animal.y-close.y,animal.x-close.x):Math.atan2(animal.homeY-animal.y,animal.homeX-animal.x)+Math.sin(w.elapsed*.4+animal.homeX)*2;const speed=close?(animal.species==='rabbit'?100:62):Math.sin(w.elapsed*.8+animal.homeY)>.2?20:0;const next=moveOnGround(animal,Math.cos(angle)*speed*dt,Math.sin(angle)*speed*dt);animal.moving=Math.hypot(next.x-animal.x,next.y-animal.y)>.05;if(Math.abs(next.x-animal.x)>.02)animal.face=next.x<animal.x?-1:1;animal.x=next.x;animal.y=next.y;}
}
export function worldTargets(w?:World):Landmark[]{return [...landmarks.map(l=>l.id==='yeoreum'&&w?.companion?{...l,x:w.companion.x,y:w.companion.y}:l),...(w?.monsters||[]).filter(m=>m.hp>0).map(m=>({id:m.id,name:m.species==='slime'?'밤이슬 슬라임':'숲 그림자',x:m.x,y:m.y,kind:'monster'})),...(w?.animals||[]).filter(a=>a.hp>0).map(a=>({id:a.id,name:a.species==='rabbit'?'야생 토끼':'멧돼지',x:a.x,y:a.y,kind:'animal'})),...lifeTargets(w),...seaTargets(w),...socialTargets(w)];}
export function nearest(p:Player,w?:World):Landmark|undefined {const preferred:Partial<Record<Item,string[]>>={pickaxe:['stone'],axe:['tree'],woodKnife:['fiber'],stoneKnife:['fiber'],shovel:['dig','buried'],bugNet:['bug'],wateringCan:['plot'],rod:['fishing'],bottle:['rain','pool'],pot:['camp'],woodSpear:['animal','monster'],stoneSpear:['animal','monster'],bow:['animal','monster']};const kinds=p.equipped&&preferred[p.equipped];const nearby=worldTargets(w).filter(l=>(!p.swimming||l.kind==='dive')&&Math.hypot(p.x-l.x,p.y-l.y)<(['animal','monster'].includes(l.kind)&&p.equipped==='bow'?280:115));const suited=kinds?nearby.filter(l=>kinds.includes(l.kind)):[];const pool=suited.length?suited:p.equipped!=='bugNet'&&nearby.some(l=>l.kind!=='bug')?nearby.filter(l=>l.kind!=='bug'):nearby;return pool.sort((a,b)=>Math.hypot(p.x-a.x,p.y-a.y)-Math.hypot(p.x-b.x,p.y-b.y))[0];}
function put(p:Player,i:Item,n=1){p.bag[i]=(p.bag[i]||0)+n;(p.collected??={})[i]=(p.collected?.[i]||0)+n;p.reward={item:i,n,seq:(p.reward?.seq||0)+1};}
function take(p:Player,i:Item,n=1){if((p.bag[i]||0)<n)return false;p.bag[i]!-=n;return true;}
export function act(w:World,id:string,action:string,arg?:unknown):string {const p=w.players[id];if(!p||!p.ready)return '먼저 모험을 시작해 주세요.';
 renewResources(w);
 if(p.gesture&&action!=='friend')return '동작이 끝날 때까지 기다려요.';
 if((p.swing||p.activity)&&!['interact','friend'].includes(action))return '동작이 끝난 뒤 사용해요.';
 if(action.startsWith('house-'))return housingAction(w,p,action,arg);
 if(action.startsWith('life-'))return lifeAction(w,p,action,arg);
 if(action.startsWith('social-')||action.startsWith('shop-')||action==='dress'||action==='wish')return socialAction(w,p,action,arg);
 if(action==='store'||action==='withdraw'||action==='camp-color'){if(Math.hypot(p.x-CAMP.x,p.y-CAMP.y)>180)return '캠프 가까이에서 사용해요.';if(action==='camp-color'){if(typeof arg!=='number'||!Number.isInteger(arg)||arg<0||arg>3)return '깃발 색을 선택해요.';w.campColor=arg;return '우리 캠프 깃발을 바꿨어요.';}const item=arg as Item;if(!Object.hasOwn(itemNames,item))return '아이템을 선택해요.';const store=w.storage??={};if(action==='store'){if(!take(p,item))return '가방에 없어요.';store[item]=(store[item]||0)+1;if(p.equipped===item&&!p.bag[item])p.equipped=undefined;if(p.armor===item&&!p.bag[item])p.armor=undefined;}else{if(!store[item])return '보관함에 없어요.';store[item]!--;p.bag[item]=(p.bag[item]||0)+1;}p.gesture={kind:'pickup',remaining:.6,duration:.6,item};return action==='store'?'캠프 보관함에 넣었어요.':'보관함에서 꺼냈어요.';}
 if(action==='wear'){if(arg==='none'){p.armor=undefined;return '가죽 조끼를 벗었어요.';}if(arg!=='leatherVest'||!p.bag.leatherVest)return '가방에 가죽 조끼가 필요해요.';p.armor='leatherVest';p.gesture={kind:'equip',remaining:.55,duration:.55,item:'leatherVest'};return '가죽 조끼를 입었어요. 몬스터 피해가 30% 줄어요.';}
 if(action==='equip'&&(p.activity||p.swing||p.gesture))return '동작이 끝난 뒤 도구를 바꿀 수 있어요.';
 if(action==='interact'&&p.activity){const a=p.activity;if(a.stage==='bite'){a.stage='reel';a.remaining=1.1;return '걸렸어요! 물고기를 끌어올려요.';}if(a.stage==='reel'||a.stage==='show')return '잡은 물고기를 챙기고 있어요.';p.activity=undefined;return '너무 일찍 당겼어요. 찌가 잠길 때 당겨 보세요.';}
 if(action==='camp-upgrade'){if(Math.hypot(p.x-CAMP.x,p.y-CAMP.y)>180)return '캠프에 돌아와서 정비해요.';const level=w.campLevel||1;if(level>=3)return '캠프 정비를 모두 마쳤어요.';if(!take(p,'wood',level*10))return `목재 ${level*10}개가 필요해요.`;w.campLevel=level+1;w.explored=reveal(w.explored,CAMP,340+level*220);return `캠프 ${level+1}단계! 주변 탐험 경로를 지도에 기록했어요.`;}
 if(action==='equip'){const item=arg as Item;if(arg==='none'){p.gesture={kind:'equip',remaining:.5,duration:.5,item:p.equipped};p.equipped=undefined;return '도구를 가방에 넣었어요.';}if(!equipable.includes(item)||!p.bag[item])return '가방에 있는 도구를 선택해 주세요.';p.equipped=item;p.gesture={kind:'equip',remaining:.55,duration:.55,item};return `손에 들었어요: ${itemNames[item]}`;}
 if(p.activity&&['interact','craft'].includes(action))return '입질을 기다리는 중이에요. 곧 줄을 당길 거예요!';
 if(action==='friend'){const name=cleanName(arg);if(!name)return '친구 이름을 입력해 주세요.';if(w.friends.length>=12)return '이 샘플에는 친구를 12명까지 등록할 수 있어요.';if(w.friends.some(f=>f.name===name)||['박하준','김여름'].includes(name))return '이미 함께하는 친구예요.';w.friends.push({name,color:(w.friends.length+2)%4});return `${name} 친구가 캠프에 도착했어요!`;}
 if(action==='eat'){const i=arg as Item;const f=foods[i];if(!f)return '먹을 수 있는 음식이 아니에요.';if(!take(p,i))return '가방에 없어요.';p.gesture={kind:i==='water'?'drink':'eat',remaining:1.4,duration:1.4,item:i,nutrition:f,phase:i==='water'?3:undefined};return `${itemNames[i]} · 포만감 +${f.food}, 수분 +${f.water}`;}
 if(action==='quiz'){if(w.phase<3)return '물을 확보하고 마신 뒤 풀어보세요.';if(arg!==2)return '투명해도 안전한 물은 아닐 수 있어요. 다시 생각해 보세요.';p.quiz=true;w.phase=4;return '정답! 물의 겉모습만으로 안전을 판단할 수 없어요.';}
 const requested=action!=='craft'&&typeof arg==='string'?worldTargets(w).find(l=>l.id===arg):undefined;
 const l=requested&&Math.hypot(p.x-requested.x,p.y-requested.y)<(['animal','monster'].includes(requested.kind)&&p.equipped==='bow'?280:115)?requested:requested?undefined:nearest(p,w);if(!l)return '가까이 다가가서 살펴보세요.';
 if(action==='craft'){const bench=landmarks.find(v=>v.kind==='workbench')!;if(Math.hypot(p.x-bench.x,p.y-bench.y)>=115)return '제작대 가까이에서 만들어 주세요.';const item=(typeof arg==='string'?arg:'rod') as Item;const recipe=recipes[item];if(!recipe)return '만들 수 없는 물건이에요.';if(!knowsRecipe(w,item))return '아직 모르는 레시피예요. 병편지 · 친구 부탁 · 자연관 교환대에서 레시피를 찾아보세요!';if(item==='water'&&!p.bag.pot)return '물을 준비하려면 냄비가 필요해요.';for(const [ingredient,n]of Object.entries(recipe))if((p.bag[ingredient as Item]||0)<n!)return `${itemNames[item]} 재료가 부족해요.`;for(const [ingredient,n]of Object.entries(recipe))take(p,ingredient as Item,n);p.gesture={kind:foods[item]||item==='water'?'cook':'craft',remaining:1.8,duration:1.8,item,target:'workbench',rewards:{[item]:item==='arrow'?5:1}};return `${itemNames[item]}${item==='arrow'?' 5개':''} 만드는 중이에요.`;}
 if(action==='tool-repair'){const bench=landmarks.find(v=>v.kind==='workbench')!;if(Math.hypot(p.x-bench.x,p.y-bench.y)>=115)return '제작대 가까이에서 고쳐 주세요.';return repairTool(w,p,arg);}
 if(action==='interact'&&!['fishing','reef-fishing','animal','monster'].includes(l.kind)&&!clearSight(p,l,l.id))return '장애물에 가려져 있어요. 물건 옆으로 돌아가세요.';
 if(p.gesture)return '동작이 끝날 때까지 잠깐 기다려요.';
 switch(l.kind){
 case 'dig':if(p.equipped!=='shovel')return '가방에서 삽을 손에 들어 주세요.';if(!w.resources[l.id])return `${resourceWait(w,l.id)}초 뒤 흙더미가 다시 생겨요.`;w.resources[l.id]--;wearTool(w,p,'shovel');p.gesture={kind:'dig',remaining:1.2,duration:1.2,item:'shovel',target:l.id,rewards:{stone:1,worm:1}};return '흙을 파서 돌 1개와 지렁이 미끼 1개를 찾았어요!';
 case 'tree':{if(p.swing)return '도끼를 휘두르는 중이에요.';const dropped=w.woodDrops?.[l.id]||0;if(dropped){w.woodDrops![l.id]=0;p.gesture={kind:'pickup',remaining:1,duration:1,item:'wood',target:l.id,rewards:{wood:dropped,fiber:2,...(l.id==='tree-beach'?{coconut:2}:{})}};return `목재 ${dropped}개와 풀줄기 2개를 챙겼어요! 가방에 넣고 있어요`; }if(p.equipped!=='axe')return '가방에서 돌도끼를 장착한 뒤 나무를 베어 보세요.';if(p.swing)return '도끼를 휘두르는 중이에요.';if(!w.resources[l.id])return '이 나무는 이미 베었어요.';if(p.stamina<8)return '잠시 쉬어 스태미나를 회복해요.';p.stamina-=8;p.face=l.x<p.x?-1:1;p.swing={kind:'chop',remaining:.55,target:l.id};return '도끼를 들어 나무를 내려쳐요.';}
 case 'monster':case 'animal':{const a=[...(w.animals||[]),...(w.monsters||[])].find(a=>a.id===l.id);if(!a||a.hp<=0)return '동물이 숲속으로 사라졌어요.';const damage=p.equipped?toolDamage[p.equipped]:undefined;if(!damage)return '창, 활, 칼이나 도끼를 장착하세요.';if(p.swing)return '도구를 휘두르는 중이에요.';if(p.stamina<8)return '잠시 쉬어 스태미나를 회복해요.';if(!clearSight(p,a))return '바위나 물건에 가려져 있어요. 다른 방향으로 이동하세요.';if(p.equipped==='bow'&&!take(p,'arrow'))return '활을 쓰려면 제작대에서 화살을 만들어야 해요.';p.stamina-=8;p.face=a.x<p.x?-1:1;p.swing={kind:'attack',remaining:.55,target:a.id,weapon:p.equipped,aimX:a.x,aimY:a.y};p.input={x:0,y:0,run:false};return '자세를 잡고 공격해요!';}


 case 'friend':{const villager=villagerByName(w,l.id);if(villager)return `${villager.name}: 안녕! 나랑 이야기하자. 화면을 누르거나 친구 버튼을 눌러 보세요!`;if(w.companion){const n=w.companion;n.wait=3;n.moving=false;return n.mode==='camp'||n.mode==='rest'?'여름: 밤에는 캠프 불빛 곁에서 쉬자. 밖에는 몬스터가 있어!':n.mode==='follow'?'여름: 하준아, 같이 가! 내가 뒤에서 길을 살펴볼게.':'여름: 주변을 살펴보고 있어. 새로 발견한 길은 지도에 표시할게!';}return '여름: 하준아, 우리 같이 안전한 물부터 구하자!';}
 case 'bag':if(p.looted)return '가방에서 필요한 물건은 모두 챙겼어요.';p.looted=true;p.gesture={kind:'pickup',remaining:1.2,duration:1.2,item:'bottle',target:l.id,rewards:{bottle:1,pot:1,ration:2},phase:1};return '물병 · 냄비 · 비상식량 2개를 찾았어요. 물통에서 물을 모아 캠프로 가져가요.';
 case 'rain':if(!p.bag.bottle)return '먼저 해변의 가방에서 물병을 찾아요.';if(p.bag.rawWater)return '이미 물을 모았어요. 캠프에서 물을 준비해요.';p.gesture={kind:'fill',remaining:2.2,duration:2.2,item:'bottle',target:l.id,rewards:{rawWater:1}};p.face=l.x<p.x?-1:1;return '병에 물을 채우고 있어요. 아직 마시지 마세요!';
 case 'camp':if(p.bag.rawWater&&p.bag.pot){take(p,'rawWater');p.gesture={kind:'cook',remaining:2.6,duration:2.6,item:'water',target:l.id,rewards:{water:1},phase:2};return '물을 끓이고 식히는 중이에요.';}return '여기는 우리의 캠프! 가방에서 먹거나, 도구를 만들고, 친구를 등록할 수 있어요.';
 case 'workbench':return '제작대에서 도구와 미끼, 음식을 만들어요.';
 case 'stone':case 'worm':case 'shrimp':case 'wood':case 'fiber':case 'coconut':if(!w.resources[l.id])return `이곳은 쉬는 중이에요. ${resourceWait(w,l.id)}초 뒤 다시 모을 수 있어요.`;w.resources[l.id]--;const collecting=l.kind as Item;const kind=l.kind==='stone'&&p.equipped==='pickaxe'?'mine':l.kind==='fiber'&&['woodKnife','stoneKnife'].includes(p.equipped||'')?'cut':'pickup';const quantity=p.equipped==='basket'?Math.min(3,1+w.resources[l.id]):1;w.resources[l.id]-=quantity-1;if(kind==='mine')wearTool(w,p,'pickaxe');p.gesture={kind,remaining:1,duration:1,item:collecting,target:l.id,rewards:{[collecting]:quantity,...(kind==='mine'&&w.resources[l.id]%2===0?{ironOre:1}:{})}};return `${itemNames[l.kind as Item]} ${quantity}개를 챙기고 있어요.`;
 case 'reef-fishing':case 'fishing':if(!p.bag.rod)return '캠프에서 낚싯대를 먼저 만들어 보세요.';if(p.equipped!=='rod')return '가방을 열어 낚싯대를 손에 들어 주세요.';const bait=l.kind==='reef-fishing'?'shrimp':'worm';if(!take(p,bait))return `${l.kind==='reef-fishing'?'산호 물고기는 새우':'작은 물고기는 지렁이'} 미끼가 필요해요.`;p.activity={kind:'fishing',remaining:.7,stage:'cast',catch:l.kind==='reef-fishing'?'reefFish':'rawFish'};p.input={x:0,y:0,run:false};p.face=-1;return '낚싯줄을 던졌어요. 찌가 완전히 잠기면 E 또는 당기기를 누르세요!';
 case 'jungle':return '여름: 정글 길을 발견했어! 오른쪽 길을 따라 샘과 동굴 입구를 탐험하자.';
 case 'dock':{const hour=(7.333+(w.elapsed%DAY_SECONDS)*24/DAY_SECONDS)%24;return hour>=18||hour<6?'부두 끝에서 바다를 보니 등대 불빛이 반짝여요. 밤바다는 조심해요!':'부두에 앉아 파도를 구경해요. 배가 오는 날도 있을지도?';}
 case 'lighthouse':{const hour2=(7.333+(w.elapsed%DAY_SECONDS)*24/DAY_SECONDS)%24;return hour2>=18||hour2<6?'등대 불이 켜졌어요! 빛이 바다를 비춰 길을 알려줘요.':'등대: 밤이 되면 불을 켜서 바다배를 지켜줘요. 올라가 볼까요?';}
 case 'cave':return '여름: 동굴은 조명과 동행 준비가 필요해. 오늘은 입구만 기록하자.';
 default:return lifeInteract(w,p,l)??seaInteract(w,p,l)??socialInteract(w,p,l)??'주변을 살펴봤어요.';}}

function announce(p:Player,text:string){p.notice=text;p.noticeSeq=(p.noticeSeq||0)+1;}
function resolveStrike(w:World,p:Player){const swing=p.swing!,a=[...(w.animals||[]),...(w.monsters||[])].find(a=>a.id===swing.target&&a.hp>0);const bow=swing.weapon==='bow';if(!a||!clearSight(p,a)||Math.hypot(p.x-a.x,p.y-a.y)>(bow?280:120)||(bow&&Math.hypot(a.x-(swing.aimX??a.x),a.y-(swing.aimY??a.y))>42)){announce(p,'빗나갔어요. 가까이 다가가서 다시 노려요.');return;}a.hp=Math.max(0,a.hp-(toolDamage[swing.weapon!]||0));a.hitAt=w.elapsed;if(a.species==='slime'||a.species==='shadow'){if(a.hp===0){put(p,'stone',2);announce(p,'몬스터를 물리쳤어요! 돌 2개를 챙겼어요.');}else announce(p,'명중! 다음 공격을 피해요.');return;}if(a.hp===0){(a as Animal).respawnAt=w.elapsed+300;put(p,'rawMeat',a.species==='boar'?3:1);put(p,'hide');announce(p,'사냥 성공! 생고기와 가죽을 챙겼어요. 고기는 익혀 먹어요.');}else announce(p,'맞혔어요! 동물이 달아나요.');}

// Camp light is a safe zone. Telegraphs and damage are simulated on the server too.
export const CAMP_SAFE_RADIUS=200;
export function stepMonsters(w:World,active:Player[],dt:number){
 const hour=(7.333+(w.elapsed%DAY_SECONDS)*24/DAY_SECONDS)%24;
 if(hour>=6&&hour<19){w.monsters=[];return;}
 const night=Math.floor((w.elapsed+7.333*DAY_SECONDS/24)/DAY_SECONDS)-(hour<6?1:0);
 if(w.monsterNight!==night){w.monsterNight=night;w.monsters=[{x:1650,y:700},{x:2130,y:660},{x:2820,y:720}].map((point,i)=>{const pos=nearestGround(point);return{id:`monster-${night}-${i}`,species:i===2?'shadow':'slime',...pos,hp:i===2?6:4,maxHp:i===2?6:4,cooldown:1,windup:0,moving:false} as Monster;});for(const p of active)announce(p,'밤의 몬스터가 나타났어요! 도구로 맞서거나 캠프 불빛으로 돌아와요.');}
 for(const m of w.monsters||[]){if(m.hp<=0)continue;m.moving=false;m.cooldown=Math.max(0,m.cooldown-dt);
 const targets=active.filter(p=>p.hp>0&&!p.swimming&&Math.hypot(p.x-CAMP.x,p.y-CAMP.y)>CAMP_SAFE_RADIUS).sort((a,b)=>Math.hypot(a.x-m.x,a.y-m.y)-Math.hypot(b.x-m.x,b.y-m.y));
 if(m.windup>0){m.windup-=dt;if(m.windup<=0){const p=targets.find(p=>p.id===m.target);if(p&&Math.hypot(p.x-m.x,p.y-m.y)<85&&clearSight(m,p)){p.hp=Math.max(0,p.hp-((m.species==='shadow'?9:6)*(p.armor==='leatherVest' && (p.bag.leatherVest||0)>0 ? .7 : 1)));p.hurtAt=w.elapsed;announce(p,'공격을 받았어요! 붉은 표시를 피해 움직이거나 캠프로 돌아와요.');}m.cooldown=1.6;}continue;}
 const p=targets[0];if(!p||Math.hypot(p.x-m.x,p.y-m.y)>850)continue;const distance=Math.hypot(p.x-m.x,p.y-m.y);
 if(distance<75&&clearSight(m,p)){if(m.cooldown<=0){m.windup=.7;m.target=p.id;}continue;}
 const speed=m.species==='shadow'?85:64;const next=moveOnGround(m,(p.x-m.x)/distance*speed*dt,(p.y-m.y)/distance*speed*dt);
 if(Math.hypot(next.x-CAMP.x,next.y-CAMP.y)>CAMP_SAFE_RADIUS){m.moving=Math.hypot(next.x-m.x,next.y-m.y)>.1;m.x=next.x;m.y=next.y;}
 }
}

export function stepCompanion(w:World,active:Player[],dt:number){
 if(w.code!=='SOLO'||active.length!==1||active[0].name==='김여름')return;
 const leader=active[0],n=w.companion??={...nearestGround({x:1050,y:545}),face:1,walk:0,moving:false,mode:'explore',wait:1,repath:0,stop:0,route:[]};
 const night=nightStrength(w.elapsed)>.45,threat=(w.monsters||[]).some(m=>m.hp>0&&Math.hypot(m.x-n.x,m.y-n.y)<230);
 const mode=night||threat?'camp':Math.hypot(leader.x-n.x,leader.y-n.y)>300?'follow':n.mode==='follow'&&Math.hypot(leader.x-n.x,leader.y-n.y)>125?'follow':'explore';
 n.moving=false;n.repath-=dt;if(mode!==n.mode&&!(mode==='camp'&&n.mode==='rest')){n.mode=mode;n.route=[];n.wait=0;n.repath=0;}
 if(n.wait>0){n.wait-=dt;return;}
 if(!n.route.length&&n.repath<=0){let goal:{x:number;y:number};if(mode==='camp'){goal={x:1100,y:610};if(Math.hypot(n.x-goal.x,n.y-goal.y)<25){n.mode='rest';n.wait=2;return;}}
 else if(mode==='follow')goal={x:leader.x-65*leader.face,y:leader.y+30};else{const stops=[{x:990,y:600},{x:1390,y:710},{x:1610,y:690},{x:1840,y:690},{x:1470,y:590},{x:1110,y:680}];goal=stops[n.stop++%stops.length];if(Math.hypot(goal.x-leader.x,goal.y-leader.y)>400)goal={x:leader.x+Math.cos(n.stop*2)*140,y:leader.y+Math.sin(n.stop*2)*80};}
 n.route=findRoute(n,goal).points;n.repath=mode==='follow'?1:3;
 }
 if(mode==='follow'&&n.repath<=0){n.route=[];return;}
 const next=n.route[0];if(!next){n.wait=1;return;}const d=Math.hypot(next.x-n.x,next.y-n.y);if(d<5){n.route.shift();if(!n.route.length){w.explored=reveal(w.explored,n,170);n.wait=mode==='explore'?2.5:0;}return;}
 const speed=mode==='camp'?118:mode==='follow'?145:66,travel=Math.min(d,speed*dt),point=moveOnGround(n,(next.x-n.x)/d*travel,(next.y-n.y)/d*travel),distance=Math.hypot(point.x-n.x,point.y-n.y);
 if(distance<.01){n.route=[];n.repath=.5;return;}if(Math.abs(point.x-n.x)>.01)n.face=point.x<n.x?-1:1;n.x=point.x;n.y=point.y;n.walk+=distance/12.8;n.moving=true;
}
