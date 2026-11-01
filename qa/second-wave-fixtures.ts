// Save files for play-testing sneaking, diving, friends, the shop, clothes, breeding and events.
import {writeFileSync,mkdirSync} from 'node:fs';
import {emptyWorld,addPlayer,type Item,type World} from '../src/shared';
import {reveal} from '../src/exploration';
import {frontierRegions} from '../src/world-layout';
import {encodeSave} from '../src/save-file';
import {life,bugSpots,gardenPlots} from '../src/island-life';
import {SHOP} from '../src/island-social';
import {shore} from '../src/terrain';
mkdirSync('qa/fixtures',{recursive:true});
const bag:Partial<Record<Item,number>>={bugNet:1,wateringCan:1,shovel:1,rod:1,wetsuit:1,flowerSeed:3,mango:3,coral:1,scallop:2,fish:2,wood:10,fiber:8,hibiscus:2,butterfly:1,coconut:3,seaStar:1,conch:1};
function make(name:string,x:number,y:number,edit?:(w:World)=>void,elapsed=0){const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=x;p.y=y;p.ready=true;p.looted=true;p.quiz=true;w.phase=4;w.elapsed=elapsed;p.bag={...bag};for(const r of frontierRegions)w.explored=reveal(w.explored,r,340);edit?.(w);writeFileSync(`qa/fixtures/${name}.island.json`,encodeSave(w,'solo'));}
const fly=bugSpots.find(b=>b.id==='bug-butterfly-2')!;
make('wave-sneak',fly.x+230,fly.y,w=>{w.players.solo.equipped='bugNet';});
make('wave-dive',shore(1500)+45,1500);
make('wave-friend',1060,600,w=>{w.companion={x:1050,y:560,face:1,walk:0,moving:false,mode:'explore',wait:30,repath:5,stop:0,route:[]};});
make('wave-shop',SHOP.x,SHOP.y+2,w=>{const b=w.players.solo.bag;b.beetle=2;b.octopus=1;b.starFragment=1;life(w).bells=300;});
make('wave-breed',gardenPlots[1].x,gardenPlots[1].y+50,w=>{const L=life(w);L.plots=[{stage:3,wet:true,stageAt:0,flower:'hibiscus'},{stage:-1,wet:false,stageAt:0,flower:'hibiscus'},{stage:3,wet:false,stageAt:0,flower:'plumeria'},{stage:-1,wet:false,stageAt:0,flower:'hibiscus'}];},45);
make('wave-bugoff',1300,700,undefined,2*300+20);
make('wave-meteor',1300,700,undefined,3*300+Math.ceil((21.5-7.333)/24*300));
console.log('second wave fixtures written');
