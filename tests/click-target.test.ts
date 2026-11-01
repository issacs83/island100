import test from 'node:test';
import assert from 'node:assert/strict';
import {pickClickTarget,CLICK_RADIUS} from '../src/click-target.ts';
import type {Landmark} from '../src/shared.ts';

// Geometry from the failing server play-test: a butterfly hovering just above the 남쪽 숲의 쉼터 grass tuft.
const tuft:Landmark={id:'fiber-south-camp',name:'남쪽 숲의 쉼터 · 풀줄기',x:2505,y:3189,kind:'fiber'};
const butterfly:Landmark={id:'bug-butterfly-2',name:'호랑나비',x:2529.3,y:3140.7,kind:'bug'};

test('A click on a bug beside a grass tuft picks the bug even when it lands inside the tuft hit box',()=>{
 assert.equal(pickClickTarget({x:2530.4,y:3116.6},[tuft,butterfly],tuft.id),butterfly.id);
});

test('A hit-box click with nothing closer keeps the hit-box owner',()=>{
 assert.equal(pickClickTarget({x:2505,y:3200},[tuft,butterfly],tuft.id),tuft.id);
});

test('A hit-box click out of reach of every target still keeps the hit-box owner',()=>{
 assert.equal(pickClickTarget({x:tuft.x+CLICK_RADIUS*3,y:tuft.y},[tuft,butterfly],tuft.id),tuft.id);
});

test('An empty-ground click picks nothing so the hero walks there',()=>{
 assert.equal(pickClickTarget({x:100,y:100},[tuft,butterfly]),undefined);
});

test('The nearest of several targets in reach wins regardless of list order',()=>{
 const shell:Landmark={id:'shell-3',name:'가리비',x:2540,y:3150,kind:'shell'};
 const point={x:2541,y:3124};
 assert.equal(pickClickTarget(point,[tuft,butterfly,shell]),shell.id);
 assert.equal(pickClickTarget(point,[shell,butterfly,tuft]),shell.id);
});
