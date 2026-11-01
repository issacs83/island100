import {readFileSync,writeFileSync} from 'node:fs';
import {emptyWorld,addPlayer} from '../src/shared';
import {reveal} from '../src/exploration';
import {frontierRegions} from '../src/world-layout';
import {encodeSave,decodeSave} from '../src/save-file';
const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=2360;p.y=1820;p.ready=true;p.looted=true;p.quiz=true;w.phase=4;p.bag={axe:1,pickaxe:1,rod:1,worm:10,wood:50,fiber:50,stone:50,bottle:1,water:5,ration:5};p.equipped='pickaxe';for(const r of frontierRegions)w.explored=reveal(w.explored,r,340);writeFileSync('qa/open-world.island.json',encodeSave(w,p.id));
const indoors=decodeSave(readFileSync('qa/decorated.island.json','utf8'));indoors.players.solo.room={x:2,y:1,pose:'sit'};writeFileSync('qa/indoor-resume.island.json',encodeSave(indoors,'solo'));
