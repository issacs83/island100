import type {Point} from './terrain';
import {WORLD_WIDTH,WORLD_HEIGHT,frontierRegions} from './world-layout';
export const EXPLORE_CELL=120;
export const CAMP:Point={x:1260,y:660};
export const regions=[
 {id:'beach',name:'서쪽 해변',x:880,y:700,goal:'낚시 · 새우 미끼 · 떠밀려 온 물자',landmark:'fishing'},
 {id:'camp',name:'우리의 캠프',x:1260,y:660,goal:'물 준비 · 요리 · 제작 · 휴식',landmark:'camp'},
 {id:'grove',name:'숲의 갈림길',x:1750,y:620,goal:'풀줄기 · 나무 · 정글 진입',landmark:'jungle'},
 {id:'jungle',name:'이끼 바위 숲',x:2140,y:620,goal:'바위를 돌아가는 길 · 제작 재료',landmark:'jungle-wood'},
 {id:'pool',name:'폭포와 샘',x:2570,y:590,goal:'새로운 물 공급 장소 찾기',landmark:'pool'},
 {id:'cave',name:'동쪽 동굴 입구',x:3060,y:420,goal:'입구 조사 · 다음 탐험 준비',landmark:'cave'},
 ...frontierRegions,
];
export function reveal(seen:string[]|undefined,p:Point,radius=240):string[]{const known=new Set(seen||[]);for(let y=Math.floor((p.y-radius)/EXPLORE_CELL);y<=Math.floor((p.y+radius)/EXPLORE_CELL);y++)for(let x=Math.floor((p.x-radius)/EXPLORE_CELL);x<=Math.floor((p.x+radius)/EXPLORE_CELL);x++){if(x<0||x>=Math.ceil(WORLD_WIDTH/EXPLORE_CELL)||y<0||y>=Math.ceil(WORLD_HEIGHT/EXPLORE_CELL))continue;if(Math.hypot((x+.5)*EXPLORE_CELL-p.x,(y+.5)*EXPLORE_CELL-p.y)<radius)known.add(`${x},${y}`);}return [...known];}
export function discovered(seen:string[]|undefined,p:Point){return !!seen?.includes(`${Math.floor(p.x/EXPLORE_CELL)},${Math.floor(p.y/EXPLORE_CELL)}`);}
export function campDirection(p:Point){const angle=Math.atan2(CAMP.y-p.y,CAMP.x-p.x);return ['→','↘','↓','↙','←','↖','↑','↗'][(Math.round(angle/(Math.PI/4))+8)%8];}
