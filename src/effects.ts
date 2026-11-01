import Phaser from 'phaser';
export class LivingIsland extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
 camera?:Phaser.Cameras.Scene2D.Camera;
 constructor(game:Phaser.Game){super({game,renderTarget:true,fragShader:`precision mediump float;
 uniform sampler2D uMainSampler;
 uniform float uTime;uniform vec2 uSize;uniform vec2 uScroll;uniform float uZoom;
 varying vec2 outTexCoord;
 void main(){
  vec2 uv=outTexCoord;vec4 c=texture2D(uMainSampler,uv);
  vec2 world=uv*uSize/uZoom+uScroll;
  float gust=.65+.35*sin(uTime*.55);
  vec2 wind=normalize(vec2(1.,-.22));
  float leaf=smoothstep(.005,.10,c.g-c.b)*smoothstep(-.06,.09,c.g-c.r);
  float sway=sin(uTime*1.7+world.x*.016+world.y*.009)*gust;
  float micro=sin(uTime*3.+world.x*.08)*.2;
  vec2 motion=wind*(sway+micro)*leaf*6./uSize;
  float shore=825.-(world.y-420.)*.37+sin(world.y/65.)*17.;
  float blue=smoothstep(.065,.20,c.g-c.r)*smoothstep(.035,.14,c.b-c.r);
  float foam=(1.-smoothstep(.025,.11,max(max(c.r,c.g),c.b)-min(min(c.r,c.g),c.b)))*smoothstep(.88,.98,c.g);
  float ocean=(1.-smoothstep(shore-35.,shore+25.,world.x))*smoothstep(215.,250.,world.y)*(1.-smoothstep(820.,895.,world.y))*max(blue,foam);
  ocean*=smoothstep(1.,1.15,length((world-vec2(430.,409.))/vec2(76.,48.)));
  ocean*=smoothstep(1.,1.15,length((world-vec2(291.,475.))/vec2(79.,37.)));
  ocean*=smoothstep(1.,1.15,length((world-vec2(464.,507.))/vec2(79.,47.)));
  ocean*=smoothstep(1.,1.15,length((world-vec2(374.,561.))/vec2(58.,34.)));
  ocean*=smoothstep(1.,1.15,length((world-vec2(265.,610.))/vec2(77.,47.)));
  motion+=vec2(sin(world.y*.045+uTime*1.25)*2.5,cos(world.x*.02+uTime)*1.2)*ocean/uSize;
  c=texture2D(uMainSampler,clamp(uv+motion,vec2(0.),vec2(1.)));
  float shimmer=sin(world.x*.14+world.y*.17-uTime*2.)*ocean*.014;
  c.rgb+=shimmer;
  gl_FragColor=c;
 }`});}
 onPreRender(){const c=this.camera,z=c?.zoom||1;this.set1f('uTime',this.game.loop.time/1000);this.set2f('uSize',this.renderer.width,this.renderer.height);this.set2f('uScroll',(c?.scrollX||0)-(c?.width||0)*.5*(1-z)/z,(c?.scrollY||0)-(c?.height||0)*.5*(1-z)/z);this.set1f('uZoom',z);}
}
export class LivingFire extends Phaser.Renderer.WebGL.Pipelines.PostFXPipeline {
 constructor(game:Phaser.Game){super({game,renderTarget:true,fragShader:`precision mediump float;uniform sampler2D uMainSampler;uniform float uTime;varying vec2 outTexCoord;
 void main(){vec2 uv=outTexCoord;vec4 c=texture2D(uMainSampler,uv);float fire=smoothstep(.45,.65,c.r-c.b)*smoothstep(.09,.22,c.r-c.g)*smoothstep(.78,.96,c.r);float f=sin(uTime*8.+uv.x*85.);uv.x+=fire*f*.002;uv.y+=fire*sin(uTime*6.+uv.x*60.)*.003;c=texture2D(uMainSampler,uv);c.rgb+=vec3(.05,.025,0.)*fire*(.5+.5*sin(uTime*9.));gl_FragColor=c;}`});}
 onPreRender(){this.set1f('uTime',this.game.loop.time/1000);}
}
