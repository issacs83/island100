import {WIDTH,HEIGHT,landmarks,type World,type Player} from './shared';
import {obstacles,shore,surfaceAt,type Point} from './terrain';
import {CAMP,EXPLORE_CELL,discovered,regions} from './exploration';

export function drawExplorationMap(canvas:HTMLCanvasElement,world:World,me:Player,route:Point[]=[]){
 const c=canvas.getContext('2d')!,sx=canvas.width/WIDTH,sy=canvas.height/HEIGHT;
 c.clearRect(0,0,canvas.width,canvas.height);c.fillStyle='#467e83';c.fillRect(0,0,canvas.width,canvas.height);c.save();c.scale(sx,sy);
 c.beginPath();c.moveTo(WIDTH,0);for(let y=0;y<=HEIGHT;y+=20)c.lineTo(shore(y),y);c.lineTo(WIDTH,HEIGHT);c.closePath();c.fillStyle='#688765';c.fill();
 for(let x=720;x<WIDTH;x+=40)for(let y=340;y<HEIGHT;y+=40){if(x<shore(y)+30)continue;const surface=surfaceAt({x,y});c.fillStyle={sand:'#d5bd88',wetSand:'#aeaf8a',grass:'#839268',dirt:'#b6a174',stone:'#9d9c8b'}[surface];c.fillRect(x,y,41,41);}
 for(const o of obstacles){c.beginPath();o.points.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.fillStyle=o.id==='jungle-pool'?'#477e8c':['camp','bag','rain','workbench'].includes(o.id)?'#76543d':'#52645b';c.fill();}
 c.fillStyle='#16392be6';for(let y=0;y<Math.ceil(HEIGHT/EXPLORE_CELL);y++)for(let x=0;x<Math.ceil(WIDTH/EXPLORE_CELL);x++)if(!world.explored?.includes(`${x},${y}`))c.fillRect(x*EXPLORE_CELL,y*EXPLORE_CELL,EXPLORE_CELL+1,EXPLORE_CELL+1);
 c.beginPath();c.arc(CAMP.x,CAMP.y,185,0,Math.PI*2);c.fillStyle='#f1ce6c22';c.fill();c.strokeStyle='#f5d37b';c.lineWidth=5;c.setLineDash([14,10]);c.stroke();c.setLineDash([]);
 if(route.length){c.beginPath();c.moveTo(me.x,me.y);for(const p of route)c.lineTo(p.x,p.y);c.strokeStyle='#fff1bd';c.lineWidth=6;c.setLineDash([12,10]);c.stroke();c.setLineDash([]);}
 c.restore();c.font='bold 12px system-ui';c.textAlign='center';c.textBaseline='middle';
 const symbols:Record<string,string>={camp:'불',workbench:'제',rain:'물',bag:'짐',fishing:'낚','reef-fishing':'낚',cave:'굴',friend:'친'};
 for(const l of landmarks){if(!discovered(world.explored,l)||!symbols[l.kind])continue;const x=l.x*sx,y=l.y*sy;c.beginPath();c.arc(x,y,9,0,Math.PI*2);c.fillStyle=l.kind==='camp'?'#f5d17b':'#263f36';c.fill();c.fillStyle=l.kind==='camp'?'#3f402a':'#fff0bd';c.fillText(symbols[l.kind],x,y);}
 for(const p of Object.values(world.players)){if(!p.online)continue;const x=p.x*sx,y=p.y*sy;c.beginPath();c.arc(x,y,p.id===me.id?6:5,0,Math.PI*2);c.fillStyle=p.id===me.id?'#ffb389':'#b9e5d2';c.fill();c.strokeStyle='#16392b';c.lineWidth=2;c.stroke();}
 c.font='bold 11px system-ui';for(const r of regions){const known=discovered(world.explored,r);if(!known&&r.id!=='cave')continue;const x=r.x*sx,y=Math.max(14,r.y*sy-30);c.fillStyle=known?'#fff3cc':'#93a895';c.strokeStyle='#263c31';c.lineWidth=3;const label=known?r.name:'미탐험 지역';c.strokeText(label,x,y);c.fillText(label,x,y);}
 c.textAlign='left';c.fillStyle='#f9e7ba';c.fillText('N ↑',12,16);
}
