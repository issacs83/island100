import {writeFileSync} from 'node:fs';
import {mkdirSync} from 'node:fs';mkdirSync('qa/fixtures',{recursive:true});
import {emptyWorld,addPlayer} from '../src/shared';
import {reveal} from '../src/exploration';
import {frontierRegions} from '../src/world-layout';
import {encodeSave} from '../src/save-file';
const spots:Record<string,[number,number]>={q1:[1600,900],q2:[5100,900],q3:[1600,2880],q4:[5100,2880],beachS:[900,980],jungleR:[3420,560],coastMid:[760,2400],camp:[1300,680],seamE:[3300,880],seamS:[2000,1000],meadow:[2360,1820],southbeach:[1250,1500],highland:[4250,700],forest:[4150,2150],grove:[2450,3250],east:[5850,3150]};
for(const [k,[x,y]] of Object.entries(spots)){const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=x;p.y=y;p.ready=true;p.looted=true;p.quiz=true;w.phase=4;p.bag={axe:1,pickaxe:1,rod:1,worm:10,wood:50,fiber:50,stone:50,bottle:1,water:5,ration:5};p.equipped='axe';for(const r of frontierRegions)w.explored=reveal(w.explored,r,340);writeFileSync(`qa/fixtures/${k}.island.json`,encodeSave(w,p.id));}
