import {test} from 'node:test';
import assert from 'node:assert/strict';
import {canStand,moveOnGround,findRoute,clearSegment,nearestGround,obstacles,surfaceAt} from '../src/terrain.ts';
import {emptyWorld,addPlayer,setInput,step,landmarks} from '../src/shared.ts';

test('Feet cannot cross the tent, barrel or a painted jungle boulder, even in a large movement',()=>{
 for(const [from,dx,dy] of [[{x:1260,y:655},0,-180],[{x:1330,y:495},0,-140],[{x:2090,y:625},0,-220]] as const){
  assert.ok(canStand(from));const end=moveOnGround(from,dx,dy);assert.ok(canStand(end));assert.ok(end.y>from.y+dy+30,'stops before passing through object');
 }
});
test('Walking into an obstacle stops walk cadence and stamina drain; tangential movement slides',()=>{
 const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=1260;p.y=654;setInput(p,{x:0,y:-1,run:true});
 for(let i=0;i<20;i++)step(w,.1);const y=p.y,walk=p.walk;p.stamina=50;step(w,.1);
 assert.equal(p.y,y);assert.equal(p.walk,walk);assert.equal(p.moving,false);assert.equal(p.blocked,true);assert.ok(p.stamina>50);
 setInput(p,{x:1,y:-1,run:false});const x=p.x;for(let i=0;i<5;i++)step(w,.1);assert.ok(p.x>x);assert.ok(canStand(p));
});
test('Click routes detour around scenery; all interaction destinations remain reachable',()=>{
 const start={x:930,y:610};
 for(const landmark of landmarks){const route=findRoute(start,landmark);assert.ok(route.points.length,landmark.id+' has a route');let prev=start;
  for(const p of route.points){assert.ok(clearSegment(prev,p),landmark.id+' path segment avoids obstacles');prev=p;}
  assert.ok(Math.hypot(prev.x-landmark.x,prev.y-landmark.y)<110,landmark.id+' can be interacted with');
 }
 const rock=obstacles.find(o=>o.id==='jungle-main-rock')!;const requested=rock.points[2],route=findRoute(start,requested);assert.equal(route.adjusted,true);assert.ok(canStand(route.points.at(-1)!));
});
test('Old saves inside solid geometry relocate to nearby ground, not through the rock',()=>{
 const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=2100;p.y=435;assert.equal(canStand(p),false);step(w,.05);assert.ok(canStand(p));assert.ok(Math.hypot(p.x-2100,p.y-435)<250);assert.deepEqual(nearestGround(p),{x:p.x,y:p.y});
});
test('Different traversable ground surfaces select distinct footfall materials',()=>{
 assert.equal(surfaceAt({x:950,y:600}),'sand');assert.equal(surfaceAt({x:800,y:610}),'wetSand');assert.equal(surfaceAt({x:2420,y:590}),'grass');assert.equal(surfaceAt({x:2500,y:695}),'dirt');assert.equal(surfaceAt({x:980,y:798}),'stone');
});
