import {restoreHouse,floorOpen,furnitureDistance} from './housing';
import {resourceRules} from './resources';
import {restoreLife} from './island-life';
import {restoreSwimmer} from './island-sea';
import {restoreClothes} from './island-social';
import {WIDTH,HEIGHT,emptyWorld,itemNames,cleanName,equipable,type World,type Player,dayNumber} from './shared';
export function encodeSave(world:World,playerId:string){return JSON.stringify({format:'island100-save',version:1,savedAt:new Date().toISOString(),playerId,world},null,2);}
export function decodeSave(text:string):World{
 if(text.length>2_000_000)throw new Error('저장 파일이 너무 커요.');
 const data=JSON.parse(text,(key,value)=>{if(['__proto__','constructor','prototype'].includes(key))throw new Error('올바르지 않은 저장 파일이에요.');if(typeof value==='number'&&!Number.isFinite(value))throw new Error('저장 값이 올바르지 않아요.');return value;});
 const source=data.world;if(data.format!=='island100-save'||data.version!==1||source?.version!==2||!source.players||!Number.isFinite(source.elapsed)||source.elapsed<0||!Number.isInteger(source.phase)||source.phase<0||source.phase>4)throw new Error('무인도 100일 저장 파일을 선택해 주세요.');
 const selected=source.players[data.playerId];if(!selected)throw new Error('주인공 기록을 찾을 수 없어요.');
 const bag=(value:any)=>{if(!value||typeof value!=='object'||Array.isArray(value))throw new Error('가방 기록이 올바르지 않아요.');for(const [key,n]of Object.entries(value))if(!Object.hasOwn(itemNames,key)||!Number.isInteger(n)||Number(n)<0||Number(n)>100000)throw new Error('아이템 기록이 올바르지 않아요.');return value;};
 for(const k of ['x','y','hp','water','food','stamina','walk','face'])if(!Number.isFinite(selected[k]))throw new Error('캐릭터 기록이 올바르지 않아요.');
 const p:Player={...selected,id:'solo',name:cleanName(selected.name)||'박하준',color:0,bag:bag(selected.bag),online:true,ready:false,input:{x:0,y:0,run:false},moving:false,blocked:false};
 for(const k of ['hp','water','food','stamina'] as const)p[k]=Math.max(0,Math.min(100,p[k]));p.x=Math.max(0,Math.min(WIDTH,p.x));p.y=Math.max(0,Math.min(HEIGHT,p.y));
 if(p.equipped&&(!equipable.includes(p.equipped)||!p.bag[p.equipped]))p.equipped=undefined;if(p.armor!=='leatherVest'||!p.bag.leatherVest)p.armor=undefined;
 if(p.gesture){const g=p.gesture;if(!['pickup','dig','equip','fill','cook','craft','eat','drink','mine','cut','net','shake','water','plant','dive'].includes(g.kind)||!Number.isFinite(g.remaining)||g.remaining<0||g.remaining>10||!Number.isFinite(g.duration)||g.duration!<=0||g.duration!>10)throw new Error('행동 기록이 올바르지 않아요.');if(g.item&&!Object.hasOwn(itemNames,g.item))throw new Error('행동 아이템이 올바르지 않아요.');if(g.rewards)bag(g.rewards);if(g.nutrition&&(!Number.isFinite(g.nutrition.food)||!Number.isFinite(g.nutrition.water)||g.nutrition.food<0||g.nutrition.food>100||g.nutrition.water<0||g.nutrition.water>100))throw new Error('회복 기록이 올바르지 않아요.');}
 if(p.activity&&(!['cast','wait','bite','reel','show'].includes(p.activity.stage||'')||!['rawFish','reefFish'].includes(p.activity.catch)||!Number.isFinite(p.activity.remaining)||p.activity.remaining<0||p.activity.remaining>10))throw new Error('낚시 기록이 올바르지 않아요.');
 if(p.swing&&(!['attack','chop'].includes(p.swing.kind)||!Number.isFinite(p.swing.remaining)||p.swing.remaining<0||p.swing.remaining>1||typeof p.swing.target!=='string'))throw new Error('공격 기록이 올바르지 않아요.');
 const w=emptyWorld();w.elapsed=source.elapsed;w.phase=source.phase;w.players={solo:p};
 if(!source.resources||typeof source.resources!=='object')throw new Error('자원 기록이 올바르지 않아요.');for(const key of Object.keys(w.resources)){const n=source.resources[key];if(n!==undefined){if(!Number.isInteger(n)||n<0||n>100000)throw new Error('자원 수량이 올바르지 않아요.');w.resources[key]=n;}}
 w.storage=bag(source.storage||{});w.friends=Array.isArray(source.friends)?source.friends.slice(0,12).filter((v:any)=>typeof v?.name==='string').map((v:any)=>({name:cleanName(v.name),color:Number.isInteger(v.color)?v.color%4:1})):[];
 w.explored=Array.isArray(source.explored)?source.explored.filter((v:any)=>typeof v==='string'&&v.length<30).slice(0,10000):w.explored;
 for(const key of ['cutAt','woodDrops'] as const){const value=source[key];if(value&&typeof value==='object'){w[key]={};for(const [id,n]of Object.entries(value))if(Object.hasOwn(w.resources,id)&&typeof n==='number'&&Number.isFinite(n)&&n>=0)w[key]![id]=n;}}
 w.campLevel=[1,2,3].includes(source.campLevel)?source.campLevel:1;w.campColor=[0,1,2,3].includes(source.campColor)?source.campColor:0;
 if(Array.isArray(source.animals))for(const a of w.animals!){const saved=source.animals.find((v:any)=>v?.id===a.id);if(saved&&['x','y','hp','respawnAt'].every(k=>Number.isFinite(saved[k]))){a.x=Math.max(0,Math.min(WIDTH,saved.x));a.y=Math.max(0,Math.min(HEIGHT,saved.y));a.hp=Math.max(0,Math.min(a.maxHp,saved.hp));a.respawnAt=Math.max(0,saved.respawnAt);}}
 // Restore validated night encounter and companion state; paths are recalculated after loading.
 if(Array.isArray(source.monsters)&&source.monsters.length<=3){w.monsters=source.monsters.filter((m:any)=>m&&typeof m.id==='string'&&['slime','shadow'].includes(m.species)&&['x','y','hp','maxHp','cooldown','windup'].every(k=>Number.isFinite(m[k]))).map((m:any)=>({...m,x:Math.max(0,Math.min(WIDTH,m.x)),y:Math.max(0,Math.min(HEIGHT,m.y)),hp:Math.max(0,Math.min(6,m.hp)),maxHp:m.species==='slime'?4:6,target:m.target===data.playerId?'solo':undefined}));if(Number.isInteger(source.monsterNight))w.monsterNight=source.monsterNight;}
 const n=source.companion;if(n&&['x','y','face','walk','stop'].every(k=>Number.isFinite(n[k]))){w.companion={x:Math.max(0,Math.min(WIDTH,n.x)),y:Math.max(0,Math.min(HEIGHT,n.y)),face:n.face<0?-1:1,walk:n.walk,stop:n.stop,mode:'explore',moving:false,wait:0,repath:0,route:[]};}
 w.life=restoreLife(source.life);
 restoreSwimmer(p);restoreClothes(p);if(typeof p.seaHint!=='boolean')p.seaHint=undefined;if(!Number.isInteger(p.eventDay))p.eventDay=undefined;
 w.house=restoreHouse(source.house);p.room=undefined;
 const room=selected.room;if(room&&w.house?.built){p.room=floorOpen(w.house,room.x,room.y)?{x:room.x,y:room.y,pose:'stand'}:{x:2,y:5,pose:'stand'};if(['sit','rest'].includes(room.pose)&&w.house.placed.some(f=>f.kind===(room.pose==='sit'?'chair':'bed')&&furnitureDistance(f,p.room!)<=1))p.room.pose=room.pose;}
 w.resourceReady={};if(source.resourceReady)for(const [key,n]of Object.entries(source.resourceReady)){if(!Object.hasOwn(resourceRules,key)||typeof n!=='number'||!Number.isFinite(n)||n<0)throw new Error('자원 재생 기록이 올바르지 않아요.');w.resourceReady[key]=n;}
 return w;
}
export function saveFilename(w:World){return `무인도100일-${dayNumber(w.elapsed)}일차-${new Date().toISOString().slice(0,10)}.island.json`;}
