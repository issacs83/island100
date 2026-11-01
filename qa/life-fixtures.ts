// Save files that place the hero next to each island-life activity for browser play-tests.
import {writeFileSync,mkdirSync} from 'node:fs';
import {emptyWorld,addPlayer,type Item} from '../src/shared';
import {reveal} from '../src/exploration';
import {frontierRegions} from '../src/world-layout';
import {encodeSave} from '../src/save-file';
import {bugSpots,gardenPlots,MUSEUM,fruitTrees,buriedToday,life} from '../src/island-life';
mkdirSync('qa/fixtures',{recursive:true});
const bag:Partial<Record<Item,number>>={bugNet:1,wateringCan:1,shovel:1,axe:1,rod:1,flowerSeed:3,worm:5,wood:20,fiber:20,stone:20,bottle:1,water:3,ration:3};
function make(name:string,x:number,y:number,equipped:Item|undefined,edit?:(w:ReturnType<typeof emptyWorld>)=>void,elapsed=0){const w=emptyWorld(),p=addPlayer(w,'solo','박하준');p.x=x;p.y=y;p.ready=true;p.looted=true;p.quiz=true;w.phase=4;w.elapsed=elapsed;p.bag={...bag};p.equipped=equipped;for(const r of frontierRegions)w.explored=reveal(w.explored,r,340);edit?.(w);writeFileSync(`qa/fixtures/${name}.island.json`,encodeSave(w,'solo'));}
const crab=bugSpots.find(b=>b.id==='bug-hermit-1')!;
make('life-bug',crab.x+70,crab.y+20,'bugNet');
const plot=gardenPlots[0];
make('life-garden',plot.x,plot.y+45,undefined);
make('life-garden-grown',plot.x,plot.y+45,undefined,w=>{const L=life(w);L.plots=[{stage:3,wet:false,stageAt:0,flower:'hibiscus'},{stage:2,wet:true,stageAt:0,flower:'plumeria'},{stage:1,wet:false,stageAt:0,flower:'hibiscus'},{stage:0,wet:false,stageAt:0,flower:'plumeria'}];});
make('life-museum',MUSEUM.x,MUSEUM.y+50,undefined,w=>{const L=life(w);L.miles=420;L.museum=['rawFish','butterfly','conch','ammonite'];w.players.solo.bag.hermitCrab=1;w.players.solo.bag.scallop=1;w.players.solo.bag.fossil=1;w.players.solo.bag.oldCoin=1;});
const tree=fruitTrees.find(t=>!t.palm)!;
make('life-fruit',tree.x+50,tree.y+30,undefined);
const x=buriedToday(1)[0];
make('life-dig',x.x+45,x.y+25,'shovel');
const ff=bugSpots.find(b=>b.id==='bug-firefly-1')!;
make('life-night',ff.x+25,ff.y+35,'bugNet',undefined,Math.ceil(((21.5-7.333)/24)*300));
console.log('life fixtures written');
