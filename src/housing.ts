import type {World,Player,Item} from './shared';
export const furnishings={bed:{name:'야자잎 침대',cost:{wood:5,fiber:4}},chair:{name:'나무 의자',cost:{wood:3}},table:{name:'작은 식탁',cost:{wood:4,stone:1}},lamp:{name:'조개 등불',cost:{ironOre:1,stone:2,fiber:2}},chest:{name:'나무 수납장',cost:{wood:5,fiber:2}},plant:{name:'야자 화분',cost:{stone:2,fiber:3}},rug:{name:'풀잎 러그',cost:{fiber:5}},shell:{name:'조개 장식',cost:{stone:2}}} as const;
export type Furniture=keyof typeof furnishings;
export type House={built:boolean;stock:Partial<Record<Furniture,number>>;placed:{id:number;kind:Furniture;x:number;y:number;rotation:number}[];nextId:number;floor:number;light:boolean;restAt?:number;bestScore?:number};
export const houseCost={wood:12,stone:6,fiber:8};
export function home(w:World):House{return w.house??={built:false,stock:{},placed:[],nextId:1,floor:0,light:true};}
export function footprint(kind:Furniture,rotation=0){const size:{[K in Furniture]:[number,number]}={bed:[1,2],chair:[1,1],table:[2,2],lamp:[1,1],chest:[2,1],plant:[1,1],rug:[2,2],shell:[1,1]};const [a,b]=size[kind];return rotation%2?{w:b,h:a}:{w:a,h:b};}
export function furnitureCells(f:{kind:Furniture;x:number;y:number;rotation:number}){const d=footprint(f.kind,f.rotation);return Array.from({length:d.w*d.h},(_,i)=>({x:f.x+i%d.w,y:f.y+Math.floor(i/d.w)}));}
export function floorOpen(h:House,x:number,y:number){return Number.isInteger(x)&&Number.isInteger(y)&&x>=0&&x<6&&y>=0&&y<6&&!h.placed.some(f=>f.kind!=='rug'&&furnitureCells(f).some(c=>c.x===x&&c.y===y));}
export function furnitureDistance(f:House['placed'][number],p:{x:number;y:number}){return Math.min(...furnitureCells(f).map(c=>Math.abs(c.x-p.x)+Math.abs(c.y-p.y)));}
function placeable(w:World,h:House,f:House['placed'][number],ignore?:number){return furnitureCells(f).every(c=>c.x>=0&&c.x<6&&c.y>=0&&c.y<6&&!(c.x===2&&c.y===5)&&!(f.kind!=='rug'&&Object.values(w.players).some(v=>v.room?.x===c.x&&v.room?.y===c.y))&&!h.placed.some(v=>v.id!==ignore&&(v.kind==='rug')===(f.kind==='rug')&&furnitureCells(v).some(a=>a.x===c.x&&a.y===c.y)));}
export function placementAllowed(w:World,h:House,f:House['placed'][number],ignore?:number){
 if(!Number.isInteger(f.x)||!Number.isInteger(f.y)||!Number.isInteger(f.rotation)||f.rotation<0||f.rotation>3||!placeable(w,h,f,ignore))return false;
 const trial={...h,placed:[...h.placed.filter(v=>v.id!==ignore),f]};
 return Object.values(w.players).every(v=>!v.room||v.room.x===2&&v.room.y===5||roomRoute(trial,v.room,{x:2,y:5}).length>0);
}
export function roomRoute(h:House,start:{x:number;y:number},end:{x:number;y:number}){if(!floorOpen(h,end.x,end.y))return [];const q=[start],paths=new Map<string,{x:number;y:number}[]>([[`${start.x},${start.y}`,[]]]);for(let i=0;i<q.length;i++){const a=q[i],path=paths.get(`${a.x},${a.y}`)!;if(a.x===end.x&&a.y===end.y)return path;for(const [dx,dy]of [[1,0],[-1,0],[0,1],[0,-1]]){const b={x:a.x+dx,y:a.y+dy},key=`${b.x},${b.y}`;if(!paths.has(key)&&floorOpen(h,b.x,b.y)){paths.set(key,[...path,b]);q.push(b);}}}return [];}
function spend(p:Player,cost:Partial<Record<Item,number>>){if(Object.entries(cost).some(([k,n])=>(p.bag[k as Item]||0)<n!))return false;for(const[k,n]of Object.entries(cost))p.bag[k as Item]!-=n!;return true;}
export function housingAction(w:World,p:Player,action:string,arg:any):string{
 if(Math.hypot(p.x-1260,p.y-610)>190)return '집은 캠프 가까이에서 이용해요.';
 const h=home(w);
 if(action==='house-build'){if(h.built)return '이미 집이 있어요.';if(!spend(p,houseCost))return '목재 12개 · 돌 6개 · 풀줄기 8개가 필요해요.';h.built=true;return '우리의 작은 집이 완성됐어요! 안으로 들어가 보세요.';}
 if(!h.built)return '먼저 캠프에 집을 지어요.';
 if(action==='house-craft'){if(!Object.hasOwn(furnishings,arg))return '가구를 선택해요.';const kind=arg as Furniture;if(!spend(p,furnishings[kind].cost))return '가구 재료가 부족해요.';h.stock[kind]=(h.stock[kind]||0)+1;return `${furnishings[kind].name} 완성! 빈 칸에 배치해요.`;}
 if(action==='house-place'){if(!arg||!Object.hasOwn(furnishings,arg.kind))return '놓을 가구를 선택해요.';const kind=arg.kind as Furniture;if(!(h.stock[kind]!>0))return '먼저 가구를 만들어요.';const f={id:h.nextId,kind,x:arg.x,y:arg.y,rotation:arg.rotation??0};if(!placementAllowed(w,h,f))return '가구 크기만큼 빈 공간이 필요해요. 출입구는 비워 둬요.';const trial={...h,placed:[...h.placed,f]};for(const v of Object.values(w.players)){if(v.room&&(v.room.x!==2||v.room.y!==5)&&!roomRoute(trial,v.room,{x:2,y:5}).length)return '문까지 걸어갈 길을 남겨 주세요.';}h.nextId++;h.stock[kind]!--;h.placed.push(f);return '가구를 놓았어요.';}
 if(action==='house-enter'){p.room={x:2,y:5,pose:'stand'};return '집에 들어왔어요.';}
 if(action==='house-exit'){p.room=undefined;return '다시 섬으로 나왔어요.';}
 if(action==='house-move'){if(!p.room||!arg||!floorOpen(h,arg.x,arg.y)||Math.abs(p.room.x-arg.x)+Math.abs(p.room.y-arg.y)!==1)return '가구를 돌아서 이동해요.';p.room={x:arg.x,y:arg.y,pose:'stand'};return '';}
 if(action==='house-floor'){if(![0,1,2].includes(arg))return '바닥을 선택해요.';h.floor=arg;return '바닥 분위기를 바꿨어요.';}
 if(action==='house-practice'){if(!Number.isInteger(arg)||arg<0||arg>3)return '연습 결과가 올바르지 않아요.';h.bestScore=Math.max(h.bestScore||0,arg);return `목공 연습 ${arg}/3 성공!`; }
 const f=h.placed.find(v=>v.id===arg);if(!f)return '가구를 선택해요.';
 if(action==='house-remove'){h.placed=h.placed.filter(v=>v!==f);h.stock[f.kind]=(h.stock[f.kind]||0)+1;return '가구를 보관했어요.';}
 if(action==='house-rotate'){const changed={...f,rotation:(f.rotation+1)%4};if(!placeable(w,h,changed,f.id))return '돌릴 공간이 부족해요.';const trial={...h,placed:h.placed.map(v=>v.id===f.id?changed:v)};for(const v of Object.values(w.players))if(v.room&&(v.room.x!==2||v.room.y!==5)&&!roomRoute(trial,v.room,{x:2,y:5}).length)return '문까지의 길을 남겨 주세요.';f.rotation=changed.rotation;return '가구 방향을 바꿨어요.';}
 if(action==='house-use'){if(!p.room||furnitureDistance(f,p.room)>1)return '가구 옆으로 걸어가 주세요.';if(f.kind==='lamp'){h.light=!h.light;return h.light?'등불을 켰어요.':'등불을 껐어요.';}if(f.kind==='bed'||f.kind==='chair'){p.room.pose=f.kind==='bed'?'rest':'sit';if(f.kind==='bed'&&(h.restAt===undefined||w.elapsed-h.restAt>=300)){h.restAt=w.elapsed;p.hp=Math.min(100,p.hp+15);p.stamina=Math.min(100,p.stamina+30);}return f.kind==='bed'?'편히 누웠어요. 잠시 쉬며 다음 탐험을 준비해요.':'의자 옆에 앉아 쉬어요.';}return f.kind==='chest'?'보관함에서 재료를 꺼내거나 넣을 수 있어요.':f.kind==='table'?'함께 먹을 음식을 가방에서 골라 보세요.':'직접 만든 장식을 감상해요.';}
 return '집을 꾸며 보세요.';
}
export function restoreHouse(value:any):House|undefined{
 if(value===undefined)return undefined;
 if(!value||typeof value.built!=='boolean'||!Array.isArray(value.placed)||value.placed.length>35||![0,1,2].includes(value.floor)||typeof value.light!=='boolean')throw new Error('집 기록이 올바르지 않아요.');
 const h:House={built:value.built,stock:{},placed:[],nextId:1,floor:value.floor,light:value.light};
 for(const[k,n]of Object.entries(value.stock||{})){if(!Object.hasOwn(furnishings,k)||!Number.isInteger(n)||Number(n)<0||Number(n)>10000)throw new Error('가구 수량이 올바르지 않아요.');h.stock[k as Furniture]=Number(n);}
 for(const f of value.placed){if(!f||!Object.hasOwn(furnishings,f.kind)||!Number.isInteger(f.id)||f.id<1||!Number.isInteger(f.x)||!Number.isInteger(f.y)||f.x<0||f.x>5||f.y<0||f.y>5||(f.x===2&&f.y===5)||![0,1,2,3].includes(f.rotation)||h.placed.some(v=>v.id===f.id))throw new Error('가구 배치가 올바르지 않아요.');if(!placeable({players:{}} as World,h,f))throw new Error('가구 크기가 겹치는 기록이에요.');h.placed.push({id:f.id,kind:f.kind,x:f.x,y:f.y,rotation:f.rotation});h.nextId=Math.max(h.nextId,f.id+1);}
 if(Number.isFinite(value.restAt)&&value.restAt>=0)h.restAt=value.restAt;if(Number.isInteger(value.bestScore)&&value.bestScore>=0&&value.bestScore<=3)h.bestScore=value.bestScore;return h;
}
