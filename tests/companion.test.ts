import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld,addPlayer,stepCompanion,worldTargets} from '../src/shared';
import {canStand} from '../src/terrain';
import {CAMP} from '../src/exploration';
test('Solo companion explores along traversable ground and updates interaction location',()=>{const w=emptyWorld(),p=addPlayer(w,'p','박하준');p.ready=true;p.x=1190;p.y=660;stepCompanion(w,[p],.1);const start={...w.companion!};for(let i=0;i<400;i++){stepCompanion(w,[p],.1);assert.ok(canStand(w.companion!));}assert.ok(Math.hypot(start.x-w.companion!.x,start.y-w.companion!.y)>20);const target=worldTargets(w).find(l=>l.id==='yeoreum')!;assert.equal(target.x,w.companion!.x);});
test('Solo companion follows distant player and returns to camp at night',()=>{const w=emptyWorld(),p=addPlayer(w,'p','박하준');p.ready=true;p.x=2200;p.y=700;stepCompanion(w,[p],.1);assert.equal(w.companion?.mode,'follow');w.elapsed=180;for(let i=0;i<700;i++)stepCompanion(w,[p],.1);assert.ok(Math.hypot(w.companion!.x-CAMP.x,w.companion!.y-CAMP.y)<200);assert.equal(w.companion?.mode,'rest');});
test('Autonomous companion does not run in cooperative worlds',()=>{const w=emptyWorld('ABCDEF'),p=addPlayer(w,'p','박하준');p.ready=true;stepCompanion(w,[p],.1);assert.equal(w.companion,undefined);});
