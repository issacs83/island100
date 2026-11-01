import {emptyWorld,addPlayer} from '../src/shared';import {encodeSave} from '../src/save-file';import {writeFileSync} from 'node:fs';
const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=1260;p.y=660;p.ready=true;p.bag={wood:100,stone:100,fiber:100,bottle:1,pot:1};writeFileSync('qa/house.island.json',encodeSave(w,p.id));
