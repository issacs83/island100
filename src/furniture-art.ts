import type {Furniture} from './housing';
// Original, code-drawn pixel furniture. No Nintendo assets.
export function furnitureArt(kind:Furniture|'house'){
 if(kind!=='house'){const i=['bed','chair','table','lamp','chest','plant','rug','shell'].indexOf(kind);return `<span class="furniture-art" aria-hidden="true" style="--fx:${i%4/3*100}%;--fy:${Math.floor(i/4)*100}%"></span>`;}
 if(kind==='house')return '<img class="cabin-preview" src="/art/cabin-v1.png" alt="야자잎 지붕의 작은 집">';
 return '';
}
