import {test} from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addPlayer,act as rawAct,step,nightStrength} from '../src/shared.ts';
import {discovered,CAMP} from '../src/exploration.ts';
function act(...args:Parameters<typeof rawAct>){const result=rawAct(...args);const p=args[0].players[args[1]];for(let i=0;i<50&&p.gesture;i++)step(args[0],.1);return result;}
test('Tools must be owned before equipping, and chopping requires an equipped axe',()=>{
 const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=1465;p.y=700;
 act(w,'a','equip','axe');assert.equal(p.equipped,undefined);act(w,'a','interact','tree-beach');assert.equal(w.resources['tree-beach'],4);
 p.bag.axe=1;act(w,'a','equip','axe');assert.equal(p.equipped,'axe');for(let i=0;i<5;i++)step(w,.1);
 for(let hit=0;hit<4;hit++){act(w,'a','interact','tree-beach');const hp:number=w.resources['tree-beach'];act(w,'a','interact','tree-beach');assert.equal(w.resources['tree-beach'],hp,'cannot spam during swing');for(let i=0;i<7;i++)step(w,.1);}
 assert.equal(w.resources['tree-beach'],0);assert.equal(p.bag.wood,undefined);assert.equal(w.woodDrops!['tree-beach'],5);p.equipped=undefined;act(w,'a','interact','tree-beach');assert.equal(p.bag.wood,5);assert.equal(w.woodDrops!['tree-beach'],0);assert.equal(p.bag.fiber,2);assert.equal(p.bag.coconut,2);act(w,'a','interact','tree-beach');assert.equal(p.bag.wood,5);
});
test('Hunting gives raw ingredients once; raw meat cannot be eaten, and bow needs arrows',()=>{
 const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=2400;p.y=650;p.bag.bow=1;act(w,'a','equip','bow');for(let i=0;i<5;i++)step(w,.1);const rabbit=w.animals![0];rabbit.x=2440;rabbit.y=650;act(w,'a','interact',rabbit.id);assert.equal(rabbit.hp,2);p.bag.arrow=1;act(w,'a','interact',rabbit.id);assert.equal(p.bag.arrow,0);assert.equal(rabbit.hp,2);for(let i=0;i<3;i++)step(w,.1);assert.equal(rabbit.hp,0);assert.equal(p.bag.rawMeat,1);act(w,'a','interact',rabbit.id);assert.equal(p.bag.rawMeat,1);for(let i=0;i<4;i++)step(w,.1);assert.match(act(w,'a','eat','rawMeat'),/아니에요/);
});
test('Ranged attacks do not hit animals through solid objects',()=>{
 const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=1260;p.y=430;p.bag={bow:1,arrow:3};p.equipped='bow';const a=w.animals![0];a.x=1400;a.y=430;assert.match(act(w,'a','interact',a.id),/가려져/);assert.equal(a.hp,2);assert.equal(p.bag.arrow,3);
});
test('Map exploration is shared, retained on save, and camp stays known',()=>{
 const w=emptyWorld(),a=addPlayer(w,'a','하준'),b=addPlayer(w,'b','여름');a.ready=b.ready=true;assert.ok(discovered(w.explored,CAMP));const place={x:2860,y:580};assert.equal(discovered(w.explored,place),false);b.x=place.x;b.y=place.y;step(w,.1);assert.ok(discovered(w.explored,place));assert.ok(discovered(JSON.parse(JSON.stringify(w)).explored,place));
});
test('The five-minute cycle includes dark nights and a new dawn',()=>{assert.equal(nightStrength(0),0);assert.equal(nightStrength(180),1);assert.equal(nightStrength(300),0);});

test('Shovel requires ownership and equipment; digging consumes deposits once per animation',()=>{const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.x=1000;p.y=705;rawAct(w,'a','interact','dig-beach');assert.equal(p.bag.stone,undefined);p.bag.shovel=1;p.equipped='shovel';rawAct(w,'a','interact','dig-beach');rawAct(w,'a','interact','dig-beach');assert.equal(p.bag.stone,undefined);for(let i=0;i<13;i++)step(w,.1);assert.equal(p.bag.stone,1);assert.equal(p.bag.worm,1);assert.equal(w.resources['dig-beach'],2);});
test('Camp upgrades require returning with wood and reveal shared routes',()=>{const w=emptyWorld(),p=addPlayer(w,'a','하준');p.ready=true;p.bag.wood=30;act(w,'a','camp-upgrade');assert.equal(p.bag.wood,30);p.x=1260;p.y=660;const n=w.explored!.length;act(w,'a','camp-upgrade');assert.equal(w.campLevel,2);assert.equal(p.bag.wood,20);assert.ok(w.explored!.length>n);});
