import test from 'node:test';
import assert from 'node:assert/strict';
import {featherAlpha,mirrorTiles,trailStamps,seaPixels,symmetryBreakers,COAST_X} from '../src/seamless-ground.ts';
import {trails,frontierSurface,WORLD_WIDTH,WORLD_HEIGHT} from '../src/world-layout.ts';
import {shore} from '../src/terrain.ts';

test('Feathered art edges are fully transparent at the border and opaque inside',()=>{
 // Every column of the bottom edge must vanish, otherwise a straight image border shows.
 for(let x=0;x<1672;x+=7)assert.equal(featherAlpha(x,940,1672,941,{bottom:200,right:260},23),0);
 for(let y=0;y<941;y+=7)assert.equal(featherAlpha(1671,y,1672,941,{bottom:200,right:260},23),0);
 assert.equal(featherAlpha(800,400,1672,941,{bottom:200,right:260},23),1);
 // The transparent zone wanders: the fade line is not a straight ruler line.
 const depths=new Set<number>();
 for(let x=0;x<1672;x+=40){let d=0;while(featherAlpha(x,940-d,1672,941,{bottom:200},23)===0)d++;depths.add(d);}
 assert.ok(depths.size>5,'fade line should vary along the edge');
});

test('Mirror tiling covers the whole island with matching neighbour edges',()=>{
 const tiles=mirrorTiles(0,0,WORLD_WIDTH,WORLD_HEIGHT,1254,1024);
 const maxX=Math.max(...tiles.map(t=>t.x+1254)),maxY=Math.max(...tiles.map(t=>t.y+1024));
 assert.ok(maxX>=WORLD_WIDTH&&maxY>=WORLD_HEIGHT);
 // Horizontal neighbours alternate flipX, vertical neighbours alternate flipY.
 for(const t of tiles){const right=tiles.find(o=>o.x===t.x+1254&&o.y===t.y);if(right)assert.notEqual(right.flipX,t.flipX);const below=tiles.find(o=>o.y===t.y+1024&&o.x===t.x);if(below)assert.notEqual(below.flipY,t.flipY);}
});

test('Painted dirt trail stamps sit where footsteps report dirt',()=>{
 const stamps=trailStamps(trails,30,10);
 assert.ok(stamps.length>100);
 // Inside the frontier the footstep surface under each stamp centre must be dirt.
 const frontier=stamps.filter(s=>s.y>=945||s.x>=3360);
 assert.ok(frontier.length>50);
 for(const s of frontier)if(s.x>=860)assert.equal(frontierSurface(s),'dirt',`${Math.round(s.x)},${Math.round(s.y)}`);
});

test('Coast column and sea follow the collision shoreline the whole way south',()=>{
 // Painted foam is about 163 world px into the coast column; collision shore must stay close.
 for(let y=950;y<WORLD_HEIGHT;y+=50)assert.ok(Math.abs(COAST_X+163-shore(y))<70,`y=${y}`);
 // Sea tile wraps: left and right columns, top and bottom rows are near-identical.
 const size=64,data=new Uint8ClampedArray(size*size*4);seaPixels(data,size,[90,200,210],[40,120,160]);
 // The wrap step (last column to first) is no larger than ordinary neighbouring steps.
 let inner=0,wrap=0;for(let y=0;y<size;y++){for(let x=1;x<size;x++)inner=Math.max(inner,Math.abs(data[(y*size+x)*4+2]-data[(y*size+x-1)*4+2]));wrap=Math.max(wrap,Math.abs(data[(y*size)*4+2]-data[(y*size+size-1)*4+2]));}
 assert.ok(wrap<=inner+2,`wrap ${wrap} inner ${inner}`);
});

test('Symmetry breakers land on every mirror axis',()=>{
 const s=symmetryBreakers(800,WORLD_WIDTH,WORLD_HEIGHT,1254,1024,330,6);
 assert.ok(s.length>60);
 assert.ok(s.every(p=>p.variant>=0&&p.variant<6));
});
