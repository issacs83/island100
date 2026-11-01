export type MusicMood='beach'|'forest'|'night'|'danger'|'home';
// Original procedural score: pentatonic mallet, soft bass and slow pads. No borrowed recordings.
export class IslandMusic{
 mood:MusicMood='beach';bus:GainNode;next=0;beat=0;enabled=true;
 constructor(private ctx:AudioContext,master:GainNode){this.bus=ctx.createGain();this.bus.gain.value=.32;this.bus.connect(master);}
 update(mood:MusicMood){if(!this.enabled||this.ctx.state!=='running')return;if(this.mood!==mood){this.mood=mood;this.beat=0;this.next=this.ctx.currentTime+.12;this.bus.gain.setTargetAtTime(mood==='danger'?.26:mood==='home'?.23:.32,this.ctx.currentTime,.7);}const now=this.ctx.currentTime;if(this.next<now-.3)this.next=now;while(this.next<now+.16){this.schedule(this.next);this.next+=this.mood==='danger'?.27:this.mood==='night'?.65:this.mood==='home'?.58:.43;this.beat++;}}
 note(midi:number,time:number,duration:number,volume:number,type:OscillatorType='sine',pan=0){const c=this.ctx,o=c.createOscillator(),gain=c.createGain(),stereo=c.createStereoPanner();o.type=type;o.frequency.value=440*2**((midi-69)/12);stereo.pan.value=pan;gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(volume,time+.025);gain.gain.exponentialRampToValueAtTime(.0001,time+duration);o.connect(gain).connect(stereo).connect(this.bus);o.start(time);o.stop(time+duration+.03);o.onended=()=>{o.disconnect();gain.disconnect();stereo.disconnect();};}
 schedule(t:number){const bar=Math.floor(this.beat/8)%4,step=this.beat%8,m=this.mood,root=m==='night'?[57,53,60,55][bar]:m==='danger'?[45,45,43,40][bar]:m==='forest'?[55,60,57,62][bar]:[60,65,57,67][bar];
 if(step===0){this.note(root-12,t,1.4,.22,'sine');if(m!=='danger'){this.note(root,t,2.1,.065,'sine',-.35);this.note(root+7,t,2,.05,'sine',.35);}}
 if(m==='danger'){this.note(root+(step%2?7:0),t,.22,.12,'triangle',step%2?.2:-.2);return;}
 const tune=m==='night'?[12,-1,19,-1,16,-1,14,-1]:m==='home'?[7,-1,12,16,-1,12,7,-1]:m==='forest'?[7,12,-1,14,19,-1,14,12]:[12,16,19,-1,21,19,16,-1],pitch=tune[(step+bar*2)%8];if(pitch>=0)this.note(root+pitch,t,m==='night'?1.7:m==='home'?1.1:.72,m==='night'?.11:m==='home'?.09:.16,'sine',Math.sin(this.beat)*.4);
 }
}
