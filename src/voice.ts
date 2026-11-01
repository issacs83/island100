export type Speaker='yeoreum'|'hajun';
type Line={id:string;speaker:Speaker;text:string;url:string};
const norm=(s:string)=>s.replace(/[\s.,!?’'…]/g,'');
export class CharacterVoice {
 enabled=true;onStatus?:(status:string)=>void;onSpeech?:(speaker:Speaker|undefined,text?:string)=>void;
 lines:Line[]=[];player?:HTMLAudioElement;ctx?:AudioContext;analyser?:AnalyserNode;sample=new Uint8Array(256);active?:Speaker;level=0;serial=0;currentText='';
 constructor(){void fetch('/audio/manifest.json').then(r=>r.ok?r.json():[]).then(v=>this.lines=v).catch(()=>{});}
 unlock(){if(!this.ctx){this.ctx=new AudioContext();}void this.ctx.resume();}
 supported(){return true;}
 speak(text:string,speaker:Speaker='yeoreum',force=false){
  if(!this.enabled)return;if(!force&&this.player&&!this.player.paused&&norm(this.currentText)===norm(text))return;this.stop();const line=this.lines.find(l=>l.speaker===speaker&&norm(l.text)===norm(text));
  // Lines without a recorded voice still appear as a speech bubble for a few seconds (no error toast).
  if(!line){const generation=++this.serial;this.currentText=text;this.active=speaker;this.onSpeech?.(speaker,text);setTimeout(()=>{if(generation!==this.serial)return;this.active=undefined;this.currentText='';this.onSpeech?.(undefined);},Math.min(6000,1800+text.length*90));return;}this.currentText=text;
  this.unlock();const audio=new Audio(line.url);this.player=audio;audio.preload='auto';audio.volume=.9;const generation=++this.serial;
  if(this.ctx){try{const source=this.ctx.createMediaElementSource(audio);this.analyser=this.ctx.createAnalyser();this.analyser.fftSize=512;source.connect(this.analyser).connect(this.ctx.destination);}catch{}}
  audio.onplaying=()=>{if(generation!==this.serial)return;this.active=speaker;this.onSpeech?.(speaker,text);};
  audio.onended=()=>{if(generation!==this.serial)return;this.active=undefined;this.level=0;this.onSpeech?.(undefined);};
  audio.onerror=()=>{if(generation!==this.serial)return;this.onStatus?.('대사 음성을 불러오지 못했어요. 다시 듣기를 눌러 주세요.');this.active=undefined;this.onSpeech?.(undefined);};
  void audio.play().catch(()=>this.onStatus?.('대사 다시 듣기를 눌러 음성을 시작해 주세요.'));
 }
 amplitude(){if(!this.active||!this.analyser)return 0;this.analyser.getByteTimeDomainData(this.sample);let sum=0;for(const v of this.sample){const n=(v-128)/128;sum+=n*n;}this.level=Math.sqrt(sum/this.sample.length);return this.level;}
 stop(){this.serial++;this.currentText='';if(this.player){this.player.pause();this.player.onended=null;this.player.onerror=null;this.player.src='';this.player=undefined;}this.analyser?.disconnect();this.analyser=undefined;this.active=undefined;this.level=0;this.onSpeech?.(undefined);}
 toggle(){this.enabled=!this.enabled;if(!this.enabled)this.stop();return this.enabled;}
}
