import {test} from 'node:test';
import assert from 'node:assert/strict';
import {frontierRegions,frontierLandmarks,WORLD_WIDTH,WORLD_HEIGHT} from '../src/world-layout';
import {findRoute,clearSegment,canStand,obstacles,moveOnGround} from '../src/terrain';
import {reveal,discovered,CAMP} from '../src/exploration';
import {emptyWorld,addPlayer,act,step} from '../src/shared';
import {resourceRules,renewResources} from '../src/resources';
import {encodeSave,decodeSave} from '../src/save-file';
import {placementAllowed,home} from '../src/housing';
import {actorScale,explorationZoom} from '../src/visual-motion';

test('All six frontier regions are connected to camp and back around solid objects',()=>{
 for(const r of frontierRegions){let p=CAMP;const route=findRoute(p,r);assert.ok(route.points.length,r.id);for(const q of route.points){assert.ok(clearSegment(p,q),r.id);p=q;}assert.ok(Math.hypot(p.x-r.x,p.y-r.y)<100);assert.ok(findRoute(p,CAMP).points.length);}
 const tree=obstacles.find(o=>o.id.startsWith('wild-tree-'))!;const center={x:(tree.bounds.left+tree.bounds.right)/2,y:(tree.bounds.top+tree.bounds.bottom)/2};assert.equal(canStand(center),false);const end=moveOnGround({x:center.x-70,y:center.y},140,0);assert.ok(end.x<center.x);assert.ok(canStand(end));assert.equal(canStand({x:WORLD_WIDTH+1,y:1800}),false);assert.equal(canStand({x:2400,y:WORLD_HEIGHT+1}),false);
});
test('Remote exploration, location and finite resource cooldown survive file round trip',()=>{
 const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=5900;p.y=3100;w.explored=reveal(w.explored,p);assert.ok(discovered(w.explored,p));assert.equal(discovered(w.explored,{x:4300,y:650}),false);
 const l=frontierLandmarks.find(l=>l.kind==='wood')!;p.x=l.x;p.y=l.y;p.ready=true;for(let n=0;n<3;n++){act(w,p.id,'interact',l.id);for(let i=0;i<11;i++)step(w,.1);}assert.equal(w.resources[l.id],0);renewResources(w);assert.ok(w.resourceReady![l.id]>w.elapsed);
 p.x=5900;p.y=3100;const loaded=decodeSave(encodeSave(w,p.id));assert.equal(loaded.players.solo.x,5900);assert.equal(loaded.players.solo.y,3100);assert.equal(loaded.resources[l.id],0);assert.equal(loaded.resourceReady![l.id],w.resourceReady![l.id]);assert.ok(discovered(loaded.explored,p));
 loaded.elapsed=loaded.resourceReady![l.id];renewResources(loaded);assert.equal(loaded.resources[l.id],resourceRules[l.id].capacity);
});
test('Every new gathering target is reachable and has a finite renewal rule',()=>{
 for(const l of frontierLandmarks){const route=findRoute(CAMP,l);assert.ok(route.points.length,l.id);const end=route.points.at(-1)!;assert.ok(Math.hypot(end.x-l.x,end.y-l.y)<110,l.id);if(l.kind!=='fishing')assert.ok(resourceRules[l.id]);}
});
test('An indoor save resumes a valid chair pose and repairs an obstructed room position',()=>{
 const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=1260;p.y=660;p.ready=true;p.bag={wood:100,stone:100,fiber:100};act(w,p.id,'house-build');act(w,p.id,'house-craft','chair');act(w,p.id,'house-place',{kind:'chair',x:3,y:4});act(w,p.id,'house-enter');act(w,p.id,'house-move',{x:2,y:4});act(w,p.id,'house-use',1);
 assert.deepEqual(decodeSave(encodeSave(w,p.id)).players.solo.room,{x:2,y:4,pose:'sit'});p.room={x:3,y:4,pose:'sit'};assert.deepEqual(decodeSave(encodeSave(w,p.id)).players.solo.room,{x:2,y:5,pose:'stand'});
});
test('Furniture preview rejects occupied floors and trapped exits without consuming stock',()=>{
 const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=1260;p.y=660;p.ready=true;p.bag={wood:100,stone:100,fiber:100};act(w,p.id,'house-build');act(w,p.id,'house-craft','bed');act(w,p.id,'house-enter');const h=home(w),snapshot=JSON.stringify(h);
 assert.equal(placementAllowed(w,h,{id:h.nextId,kind:'bed',x:2,y:4,rotation:0}),false);assert.equal(JSON.stringify(h),snapshot);
 assert.equal(placementAllowed(w,h,{id:h.nextId,kind:'bed',x:4,y:1,rotation:1}),true);act(w,p.id,'house-place',{kind:'bed',x:4,y:1,rotation:1});assert.equal(h.placed[0].rotation,1);assert.equal(h.stock.bed,0);
 p.room={x:0,y:0,pose:'stand'};h.placed=[{id:1,kind:'chair',x:0,y:1,rotation:0}];assert.equal(placementAllowed(w,h,{id:2,kind:'chair',x:1,y:0,rotation:0}),false);
});
test('World position never enlarges characters or their grips; mobile zoom leaves room to move',()=>{
 for(const region of frontierRegions){const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=region.x;p.y=region.y;assert.equal(actorScale(p.color),.95);assert.equal(actorScale(1),.95*.86);assert.ok(actorScale(1)<actorScale(0));}
 assert.ok(176*actorScale(0)*explorationZoom(390)<80);assert.ok(explorationZoom(390)<explorationZoom(1280));assert.equal(explorationZoom(4000),.9);
});
