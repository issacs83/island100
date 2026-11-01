import type {Item} from './shared';
// Scrolling world coordinates are not depth. Keep body, grip and clothing aligned everywhere.
export function actorScale(color:number){return .95*(color%2===1?.86:1);}
export function explorationZoom(width:number){return Math.max(.42,Math.min(.9,width/1280));}
// Grip coordinates are normalized to the trimmed 80px item textures, not icon centers.
export const toolGrips:Partial<Record<Item,{x:number;y:number;size:number;angle:number}>>={
 woodSpear:{x:.32,y:.73,size:92,angle:-30},stoneSpear:{x:.32,y:.73,size:92,angle:-30},
 rod:{x:.28,y:.78,size:88,angle:-22},axe:{x:.32,y:.78,size:66,angle:8},pickaxe:{x:.34,y:.78,size:72,angle:8},
 shovel:{x:.66,y:.3,size:78,angle:28},woodKnife:{x:.27,y:.78,size:56,angle:-18},stoneKnife:{x:.27,y:.78,size:56,angle:-18},
 bow:{x:.46,y:.49,size:66,angle:-20},torch:{x:.28,y:.78,size:62,angle:-27},
 bottle:{x:.5,y:.65,size:43,angle:0},
 // Island-life tools: the net is held at the end of its pole, the can by its handle.
 bugNet:{x:.12,y:.9,size:88,angle:-25},wateringCan:{x:.14,y:.52,size:54,angle:0},pot:{x:.13,y:.42,size:52,angle:0},basket:{x:.5,y:.16,size:55,angle:0}
};
export function surfCycle(time:number){const phase=((time/7.5)%1+1)%1;const advance=phase<.38;const u=advance?phase/.38:(phase-.38)/.62;const reach=advance?Math.sin(u*Math.PI/2):.5+.5*Math.cos(u*Math.PI);return {reach,foam:advance?.2+.5*reach:.7*(1-u),phase};}
