import {emptyWorld,addPlayer,equipable,itemNames,landmarks} from '../src/shared';
import {encodeSave} from '../src/save-file';
import {writeFileSync} from 'node:fs';
const targets:Record<string,string>={shovel:'dig-beach',rod:'fishing',woodKnife:'fiber',stoneKnife:'fiber',axe:'tree-beach',pickaxe:'stone',bottle:'rain',pot:'camp',basket:'wood1',torch:'wood1'};
for(const item of equipable){const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.bag=Object.fromEntries(Object.keys(itemNames).map(k=>[k,5]));delete p.bag.rawWater;if(item==='pot')p.bag.rawWater=1;p.equipped=item;p.ready=true;const l=landmarks.find(l=>l.id===targets[item]);if(l){p.x=l.x;p.y=l.y+55;}else{p.x=2400;p.y=650;w.animals![0].x=2440;w.animals![0].y=650;}w.companion={x:1050,y:545,face:1,walk:0,mode:'explore',wait:30};if(item==='torch')w.elapsed=180;writeFileSync(`qa/${item}.island.json`,encodeSave(w,p.id));}
