import {WORLD_WIDTH,WORLD_HEIGHT,frontierTrees,frontierLandmarks,frontierSurface} from './world-layout';
export type Point = {x:number;y:number};
export type Surface = 'sand'|'wetSand'|'grass'|'dirt'|'stone';
export type Obstacle = {id:string;name:string;points:Point[];bounds:{left:number;right:number;top:number;bottom:number}};
export const FOOT_RADIUS=12;
const polygon=(id:string,name:string,xy:number[][]):Obstacle=>({id,name,points:xy.map(([x,y])=>({x,y})),bounds:{left:Math.min(...xy.map(p=>p[0])),right:Math.max(...xy.map(p=>p[0])),top:Math.min(...xy.map(p=>p[1])),bottom:Math.max(...xy.map(p=>p[1]))}});
const ellipse=(id:string,name:string,x:number,y:number,rx:number,ry:number):Obstacle=>polygon(id,name,Array.from({length:20},(_,i)=>[x+Math.cos(i*Math.PI/10)*rx,y+Math.sin(i*Math.PI/10)*ry]));
// Coordinates follow the artwork's ground plane; collision uses the feet, not the head/sprite rectangle.
const jungle=(id:string,name:string,xy:number[][])=>polygon(id,name,xy.map(([x,y])=>[1540+x*1820/1672,y*945/941]));
export const obstacles:Obstacle[]=[
 ...frontierTrees.map(p=>ellipse(p.id,'숲 나무',p.x,p.y,20,14)),
 ...frontierLandmarks.filter(l=>l.kind==='tree'||l.kind==='stone').map(l=>ellipse(l.id,l.name,l.x,l.y,l.kind==='tree'?20:19,14)),
 ellipse('beach-ridge','해변 바위',1010,320,205,53),
 ellipse('beach-rock','큰 바위',1172,333,89,31),
 polygon('east-rocks','숲길 바위',[[1435,396],[1511,414],[1580,490],[1531,550],[1440,529],[1400,486]]),
 ellipse('beach-small-rock','해변 돌',1273,510,22,12),
 ellipse('beach-log','쓰러진 나무',1194,796,77,25),
 ellipse('beach-bottom-rock','해변 바위',1094,816,30,15),
 ellipse('beach-foreground','해변 큰 바위',1330,747,57,38),
 ellipse('bag','가방',1070,633,48,23),
 // Island nature museum pavilion beside the camp.
 ellipse('museum','섬 자연관',1612,630,100,24),
 // Island shop stall north of the workbench.
 ellipse('shop','섬 매점',1180,452,78,18),
 ellipse('rain','물통',1330,430,44,25),
 polygon('camp','텐트와 모닥불',[[1186,535],[1235,506],[1327,540],[1350,576],[1314,608],[1210,608],[1175,578]]),
 polygon('workbench','제작대',[[1128,556],[1212,556],[1212,581],[1128,581]]),
 ellipse('stone','돌 더미',1170,697,19,12),
 ellipse('wood1','나뭇가지 더미',1260,700,27,9),
 ellipse('wood2','나뭇가지 더미',1060,750,27,9),
 ellipse('coconut','코코넛',1180,765,15,12),
 ellipse('tree-beach','야자나무',1465,645,20,13),
 ellipse('tree-grove','나무',1850,573,20,14),
 ellipse('tree-jungle','나무',2640,715,20,14),
 jungle('jungle-cliff','정글 절벽',[[220,0],[1672,0],[1672,245],[1450,250],[1320,288],[1190,268],[1060,265],[720,225],[545,215],[330,272]]),
 jungle('jungle-main-rock','이끼 바위',[[351,290],[580,270],[690,337],[725,416],[674,522],[610,556],[434,535],[345,470],[315,384]]),
 jungle('jungle-pool','깊은 물',[[627,219],[784,209],[1130,270],[1205,348],[1176,420],[1070,467],[915,489],[751,434],[684,371]]),
 jungle('jungle-south-rock','정글 바위',[[390,691],[484,650],[597,664],[644,726],[620,814],[437,828],[356,772]]),
 jungle('jungle-bottom-rock','큰 바위',[[651,816],[722,768],[795,798],[849,850],[953,846],[997,941],[648,941]]),
 jungle('jungle-right-rock','정글 바위',[[1294,578],[1365,535],[1470,553],[1507,627],[1432,695],[1294,690],[1247,637]]),
 jungle('jungle-left-rock','정글 돌',[[96,471],[145,448],[176,471],[170,512],[110,522]]),
 jungle('palm-trunk','야자나무',[[230,316],[264,310],[302,365],[274,386],[245,365]]),
 jungle('jungle-foreground-left','빽빽한 수풀',[[0,697],[126,708],[264,837],[366,941],[0,941]]),
 jungle('jungle-foreground-right','빽빽한 수풀',[[1508,665],[1672,550],[1672,941],[1155,941],[1279,804]]),
];
export function shore(y:number){const coast=Math.min(y,945);return 825-(coast-420)*.37+Math.sin(y/65)*17;}
export function distanceToSegment(p:Point,a:Point,b:Point){const dx=b.x-a.x,dy=b.y-a.y;const t=Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/(dx*dx+dy*dy||1)));return Math.hypot(p.x-a.x-t*dx,p.y-a.y-t*dy);}
export function inside(p:Point,points:Point[]){let hit=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a.y>p.y)!==(b.y>p.y)&&p.x<(b.x-a.x)*(p.y-a.y)/(b.y-a.y)+a.x)hit=!hit;}return hit;}
export function touching(p:Point,o:Obstacle,radius=FOOT_RADIUS){if(p.x<o.bounds.left-radius||p.x>o.bounds.right+radius||p.y<o.bounds.top-radius||p.y>o.bounds.bottom+radius)return false;return inside(p,o.points)||o.points.some((a,i)=>distanceToSegment(p,a,o.points[(i+1)%o.points.length])<radius);}
const obstacleBins=new Map<string,Obstacle[]>();
for(const o of obstacles)for(let y=Math.floor((o.bounds.top-32)/160);y<=Math.floor((o.bounds.bottom+32)/160);y++)for(let x=Math.floor((o.bounds.left-32)/160);x<=Math.floor((o.bounds.right+32)/160);x++){const key=`${x},${y}`;const bin=obstacleBins.get(key)||[];bin.push(o);obstacleBins.set(key,bin);}
const nearbyObstacles=(p:Point)=>obstacleBins.get(`${Math.floor(p.x/160)},${Math.floor(p.y/160)}`)||[];
export function obstacleAt(p:Point,radius=FOOT_RADIUS){return (radius<=32?nearbyObstacles(p):obstacles).find(o=>touching(p,o,radius));}
export function canStand(p:Point,radius=FOOT_RADIUS){return Number.isFinite(p.x)&&Number.isFinite(p.y)&&p.x>=shore(p.y)+30&&p.x<=WORLD_WIDTH-70-radius&&p.y>=(p.x<3200?330:80)+radius&&p.y<=WORLD_HEIGHT-80-radius&&!obstacleAt(p,radius);}
export function clearSegment(a:Point,b:Point,radius=FOOT_RADIUS){const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/5));for(let i=0;i<=count;i++){const t=i/count;if(!canStand({x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t},radius))return false;}return true;}
export function clearSight(a:Point,b:Point,ignoreId?:string){const count=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/6));for(let i=1;i<count;i++){const t=i/count,p={x:a.x+(b.x-a.x)*t,y:a.y+(b.y-a.y)*t};if(nearbyObstacles(p).some(o=>o.id!==ignoreId&&o.id!=='jungle-pool'&&touching(p,o,0)))return false;}return true;}
export function nearestGround(p:Point):Point {if(canStand(p))return {x:p.x,y:p.y};const bounded={x:Math.max(680,Math.min(WORLD_WIDTH-90,Number.isFinite(p.x)?p.x:930)),y:Math.max(100,Math.min(WORLD_HEIGHT-100,Number.isFinite(p.y)?p.y:610))};for(let r=0;r<=1000;r+=8){const n=Math.max(8,Math.ceil(r*Math.PI/10));for(let i=0;i<n;i++){const a=i/n*Math.PI*2,q={x:bounded.x+Math.cos(a)*r,y:bounded.y+Math.sin(a)*r};if(canStand(q))return q;}}return {x:930,y:610};}
export function moveOnGround(from:Point,dx:number,dy:number):Point {
 let p=canStand(from)?{...from}:nearestGround(from);
 const n=Math.max(1,Math.ceil(Math.hypot(dx,dy)/4));
 for(let i=0;i<n;i++){const x=dx/n,y=dy/n;const both={x:p.x+x,y:p.y+y};if(canStand(both)){p=both;continue;}const alongX={x:p.x+x,y:p.y},alongY={x:p.x,y:p.y+y};if(Math.abs(x)>=Math.abs(y)){if(canStand(alongX))p=alongX;else if(canStand(alongY))p=alongY;}else{if(canStand(alongY))p=alongY;else if(canStand(alongX))p=alongX;}}
 return p;
}
const gravel=[ellipse('pebbles','자갈',980,798,105,35),ellipse('cave-floor','돌길',3070,405,120,55)];
export function surfaceAt(p:Point):Surface {
 if(p.y>=945||p.x>=3360)return frontierSurface(p);
 if(gravel.some(o=>inside(p,o.points)))return 'stone';
 if(p.x<1510){if(p.x-shore(p.y)<75)return 'wetSand';if(p.x>1360||p.y<395)return 'grass';return 'sand';}
 if(p.x<1840)return 'grass';
 const trail=[{x:1840,y:555},{x:2080,y:625},{x:2500,y:695},{x:2840,y:525},{x:3070,y:390}];
 if(trail.some((v,i)=>i>0&&distanceToSegment(p,trail[i-1],v)<42))return 'dirt';
 return 'grass';
}

const CELL=20,COLS=Math.ceil(WORLD_WIDTH/CELL)+1,ROWS=Math.ceil(WORLD_HEIGHT/CELL)+1;
let grid:Uint8Array|undefined;
const nodePoint=(id:number):Point=>({x:(id%COLS)*CELL,y:Math.floor(id/COLS)*CELL});
function navGrid(){if(!grid){grid=new Uint8Array(COLS*ROWS);for(let i=0;i<grid.length;i++)grid[i]=canStand(nodePoint(i),FOOT_RADIUS+3)?1:0;
 const reachable=new Uint8Array(grid.length),queue=[31*COLS+47];reachable[queue[0]]=1;
 for(let head=0;head<queue.length;head++){const id=queue[head],x=id%COLS,y=Math.floor(id/COLS);for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy,next=ny*COLS+nx;if(nx<0||nx>=COLS||ny<0||ny>=ROWS||!grid[next]||reachable[next]||dx&&dy&&(!grid[y*COLS+nx]||!grid[ny*COLS+x]))continue;if(!clearSegment(nodePoint(id),nodePoint(next),FOOT_RADIUS+1))continue;reachable[next]=1;queue.push(next);}}
 grid=reachable;
 }return grid;}
function closestNode(p:Point,connected:boolean){const g=navGrid(),cx=Math.round(p.x/CELL),cy=Math.round(p.y/CELL);let best=-1,dist=Infinity;for(let r=0;r<Math.max(COLS,ROWS);r++){for(let y=cy-r;y<=cy+r;y++)for(let x=cx-r;x<=cx+r;x++){if(r&&Math.abs(x-cx)!==r&&Math.abs(y-cy)!==r||x<0||x>=COLS||y<0||y>=ROWS)continue;const id=y*COLS+x;if(!g[id])continue;const q=nodePoint(id),d=Math.hypot(q.x-p.x,q.y-p.y);if(d<dist&&(!connected||clearSegment(p,q))){best=id;dist=d;}}if(best>=0&&(r+.5)*CELL>dist)return best;}return best;}
class Heap {a:{id:number;score:number}[]=[];push(id:number,score:number){const v={id,score};let i=this.a.length;this.a.push(v);while(i){const p=(i-1)>>1;if(this.a[p].score<=score)break;this.a[i]=this.a[p];i=p;}this.a[i]=v;}pop(){const top=this.a[0],last=this.a.pop()!;if(this.a.length){let i=0;while(i*2+1<this.a.length){let c=i*2+1;if(c+1<this.a.length&&this.a[c+1].score<this.a[c].score)c++;if(last.score<=this.a[c].score)break;this.a[i]=this.a[c];i=c;}this.a[i]=last;}return top.id;}}
export type Route={points:Point[];adjusted:boolean};
export function findRoute(start:Point,requested:Point):Route {
 const origin=nearestGround(start),safe=nearestGround(requested),destination=canStand(requested,FOOT_RADIUS+3)?{x:requested.x,y:requested.y}:nodePoint(closestNode(safe,false)),adjusted=Math.hypot(requested.x-destination.x,requested.y-destination.y)>2;
 if(clearSegment(origin,destination))return {points:[destination],adjusted};
 const g=navGrid(),first=closestNode(origin,true),last=closestNode(destination,true);if(first<0||last<0)return {points:[],adjusted:true};
 const scores=new Float64Array(g.length).fill(Infinity),parent=new Int32Array(g.length).fill(-1),closed=new Uint8Array(g.length),open=new Heap();scores[first]=0;open.push(first,0);
 const goal=nodePoint(last);let found=false;
 while(open.a.length){const id=open.pop();if(closed[id])continue;if(id===last){found=true;break;}closed[id]=1;const x=id%COLS,y=Math.floor(id/COLS),p=nodePoint(id);
  for(let dy=-1;dy<=1;dy++)for(let dx=-1;dx<=1;dx++){if(!dx&&!dy)continue;const nx=x+dx,ny=y+dy;if(nx<0||nx>=COLS||ny<0||ny>=ROWS)continue;const next=ny*COLS+nx;if(!g[next]||closed[next]||dx&&dy&&(!g[y*COLS+nx]||!g[ny*COLS+x]))continue;const q=nodePoint(next);if(!clearSegment(p,q,FOOT_RADIUS+1))continue;const cost=scores[id]+Math.hypot(dx,dy)*CELL;if(cost>=scores[next])continue;scores[next]=cost;parent[next]=id;open.push(next,cost+Math.hypot(q.x-goal.x,q.y-goal.y));}
 }
 if(!found)return {points:[],adjusted:true};
 const raw:Point[]=[destination];for(let id=last;id>=0;id=parent[id]){raw.push(nodePoint(id));if(id===first)break;}raw.push(origin);raw.reverse();
 const points:Point[]=[];let i=0;while(i<raw.length-1){let next=raw.length-1;while(next>i+1&&!clearSegment(raw[i],raw[next],FOOT_RADIUS+1))next--;points.push(raw[next]);i=next;}return {points,adjusted};
}
