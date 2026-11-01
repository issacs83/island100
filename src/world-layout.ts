// Stable coordinates preserve existing saves. New land extends south and east.
export const WORLD_WIDTH=6720, WORLD_HEIGHT=3780;
export const frontierRegions=[
 {id:'south-beach',name:'남쪽 조개 해변',x:1200,y:1500,goal:'해변 채집 · 낚시 · 남쪽 탐험',landmark:'frontier-fishing'},
 {id:'meadow',name:'바람 초원',x:2400,y:1800,goal:'목재와 풀줄기 · 토끼 관찰',landmark:'frontier-wood'},
 {id:'highland',name:'동쪽 광석 고원',x:4300,y:650,goal:'곡괭이 채굴 · 고원 탐험',landmark:'frontier-stone'},
 {id:'forest',name:'깊은 야자 숲',x:4200,y:2100,goal:'나무 베기 · 멧돼지 · 재료 운반',landmark:'frontier-tree'},
 {id:'south-grove',name:'남쪽 숲의 쉼터',x:2500,y:3200,goal:'먼 탐험길 · 풀줄기 · 귀환 준비',landmark:'frontier-fiber'},
 {id:'east-coast',name:'동쪽 끝 탐험지',x:5900,y:3100,goal:'미탐험 지형 · 새로운 발견',landmark:'frontier-dig'},
];
export const frontierLandmarks=frontierRegions.flatMap((r,i)=>[
 {id:r.landmark,name:r.name+' · '+['낚시 자리','나뭇가지','광석 더미','야자나무','풀줄기','묻힌 재료'][i],x:i===0?740:r.x,y:r.y,kind:['fishing','wood','stone','tree','fiber','dig'][i]},
 {id:`frontier-tree-${i}`,name:r.name+' · 나무',x:r.x+140,y:r.y+150,kind:'tree'},
 {id:`frontier-stone-${i}`,name:r.name+' · 돌',x:r.x-100,y:r.y+180,kind:'stone'},
 {id:`frontier-fiber-${i}`,name:r.name+' · 풀줄기',x:r.x+200,y:r.y+230,kind:'fiber'},
]);
// Deterministic decoration/collision: broad empty lanes keep regions connected.
export const frontierTrees=Array.from({length:180},(_,i)=>{
 const noise=(seed:number)=>{const n=Math.sin(seed*127.1)*43758.5453;return n-Math.floor(n);},x=1000+noise(i+1)*5400,y=1080+noise(i+400)*2470;
 return {id:`wild-tree-${i}`,x,y};
}).filter((p,i,all)=>!frontierLandmarks.some(l=>Math.hypot(p.x-l.x,p.y-l.y)<150)&&!all.some((q,j)=>j<i&&Math.hypot(q.x-p.x,q.y-p.y)<120));
// Walkable dirt trails. The renderer paints these and footsteps read them, so both always agree.
export const trails=[[{x:1100,y:850},{x:1250,y:1300},{x:1700,y:1550},{x:2400,y:1800},{x:3300,y:1950},{x:4200,y:2100},{x:5100,y:2550},{x:5900,y:3100}],[{x:3100,y:650},{x:3650,y:720},{x:4300,y:650},{x:4500,y:1200},{x:4200,y:2100}],[{x:2400,y:1800},{x:2650,y:2450},{x:2500,y:3200}]];
export function frontierSurface(p:{x:number;y:number}):'sand'|'grass'|'dirt'|'stone'{
 // Sand width matches the painted coast column (see seamless-ground COAST_X).
 if(p.x<860)return 'sand';
 // Painted trails win over the highland stone so the footstep sound matches what is drawn.
 for(const trail of trails)for(let i=1;i<trail.length;i++){const a=trail[i-1],b=trail[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy)));if(Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy)<48)return 'dirt';}
 if(p.x>3700&&p.y<1000)return 'stone';
 return 'grass';
}
