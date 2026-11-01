import {HalfFloatType, Mesh, NeutralToneMapping, PCFSoftShadowMap, PerspectiveCamera, Scene, Vector2, WebGLRenderTarget, WebGLRenderer} from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {HorizontalTiltShiftShader} from 'three/addons/shaders/HorizontalTiltShiftShader.js';
import {VerticalTiltShiftShader} from 'three/addons/shaders/VerticalTiltShiftShader.js';
import type {Bridge} from '../scene';
import type {IslandController} from '../island-controller';
import type {Speaker} from '../voice';
import {landmarks, nightStrength, shore, worldTargets, type Player, type World} from '../shared';
import {surfaceAt} from '../terrain';
import {CAMP} from '../exploration';
import {UNIT, aimCamera, boxBounds, groundVisible, pickBox, pickGround, projectScene, seeCircle, standingBox, treeBox, viewWindow, type ScreenBox, type SeeCircle} from './space';
import {bend, groundDetailTexture, seeThrough, std} from './look';
import {buildGroundChunk, chunkBounds, groundChunks} from './ground3d';
import {createWater} from './water3d';
import {SkyLight, daylight} from './sky-light3d';
import {Flora3D} from './flora3d';
import {Actors3D} from './actors3d';
import {Props3D} from './props-scene3d';
import {Critters3D} from './critters3d';
import {Dressing3D} from './dressing3d';
import {Input3D} from './input3d';
import {Overlay3D, type Tag} from './overlay3d';
import {TREE_KINDS, hitSize} from './hits';

type Target = ReturnType<typeof worldTargets>[number];
// Chunks whose centre is farther than this from the focus (scene units) are not drawn.
const CHUNK_VIEW = 46;
// Target names show within this many game pixels of the player, like the 2D labels.
const LABEL_RANGE = 180;
// Longest wait for the shader compile before the first frame (ms).
const PRIME_TIMEOUT_MS = 8000;
// ?q=low keeps trees and props to this many units ahead (full quality: trees to the bent horizon, flora3d TREE_AHEAD;
// props to props-scene3d PROP_AHEAD).
const LOW_AHEAD = 28;
// Focus easing per second; matches the 2D camera's 0.07 lerp per frame at 60 fps.
const FOLLOW_RATE = 4.35;
const landmarkIds = new Set(landmarks.map(l => l.id)), KEYBOARD_KINDS = new Set(['animal', 'monster']);

// The outdoor island in three.js. Same controller and clock as 2D; only drawing and picking differ.
export class Island3D {
  private renderer = new WebGLRenderer({antialias: false, powerPreference: 'high-performance'});
  private scene = new Scene();
  private camera = new PerspectiveCamera(34, 1, .1, 200);
  // ?q=low drops shadows, post-processing, ground dressing and far trees for slow devices and headless checks (full quality tiers come in P6).
  private low = new URLSearchParams(location.search).get('q') === 'low';
  private composer: EffectComposer;
  private bloom = new UnrealBloomPass(new Vector2(1, 1), .18, .45, .92);
  private tiltH = new ShaderPass(HorizontalTiltShiftShader);
  private tiltV = new ShaderPass(VerticalTiltShiftShader);
  private chunks: {mesh: Mesh; x: number; z: number}[] = [];
  private water = createWater();
  private sky: SkyLight;
  private flora = new Flora3D();
  private props = new Props3D();
  private critters = new Critters3D();
  private dressing = new Dressing3D();
  private actors: Actors3D;
  private input: Input3D;
  private overlay: Overlay3D;
  private focus = {x: CAMP.x, y: CAMP.y};
  private focused = false;
  private width = 1;
  private height = 1;
  private now = 0;
  private last = 0;
  private fps = 0;
  private frames = 0;
  private fpsTime = 0;
  private calls = 0;
  private rendered = 0;
  private speech?: {speaker: Speaker; text: string};
  private boxes: ScreenBox[] = [];
  private see?: SeeCircle;
  private soundTicks = 0;
  private steps = new Map<string, number>();
  private toolSounds = new Map<string, {key: string; played: boolean}>();

  constructor(host: HTMLElement, private bridge: Bridge, private control: IslandController) {
    const r = this.renderer;
    r.setPixelRatio(this.low ? 1 : Math.min(devicePixelRatio || 1, 1.5));
    r.setClearColor('#217c88');
    r.shadowMap.enabled = !this.low;
    r.shadowMap.type = PCFSoftShadowMap;
    r.toneMapping = NeutralToneMapping;
    r.info.autoReset = false;
    host.append(r.domElement);
    this.sky = new SkyLight(this.scene, matchMedia('(pointer: coarse)').matches ? 1024 : 2048);
    this.sky.sun.castShadow = !this.low;
    const ground = std('#ffffff', {vertexColors: true, map: groundDetailTexture(), roughness: .95});
    for (const key of groundChunks()) {
      const b = chunkBounds(key), mesh = new Mesh(buildGroundChunk(key), ground);
      mesh.receiveShadow = true;
      this.chunks.push({mesh, x: (b.x0 + b.x1) / 2, z: (b.z0 + b.z1) / 2});
      this.scene.add(mesh);
    }
    this.scene.add(this.water, this.flora.group, this.props.group, this.critters.group);
    // Ground dressing is part of full quality only; ?q=low (slow devices) keeps the lawn plain.
    if (!this.low) this.scene.add(this.dressing.group);
    this.actors = new Actors3D(this.scene);
    // Multisampled HDR target: the composer would otherwise lose antialiasing.
    this.composer = new EffectComposer(r, new WebGLRenderTarget(1, 1, {type: HalfFloatType, samples: 4}));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(this.bloom);
    this.tiltH.uniforms.r.value = .5;
    this.tiltV.uniforms.r.value = .5;
    this.composer.addPass(this.tiltH);
    this.composer.addPass(this.tiltV);
    this.composer.addPass(new OutputPass());
    this.input = new Input3D(control);
    this.overlay = new Overlay3D(control, new URLSearchParams(location.search).has('qa'));
    r.domElement.addEventListener('pointerdown', e => this.click(e));
    r.domElement.addEventListener('pointermove', e => { r.domElement.style.cursor = pickBox(this.boxes, e.offsetX, e.offsetY, this.see) ? 'pointer' : 'default'; });
    addEventListener('resize', () => this.resize());
    this.resize();
    this.prime();
  }

  // Builds the props once and compiles every material before the first frame, for the target the scene really renders
  // into (the composer's buffer in full quality: no tone mapping, linear output). Where the browser compiles shaders in
  // parallel (KHR_parallel_shader_compile) the title screen stays responsive meanwhile instead of freezing.
  private prime() {
    const w = this.bridge.world(), fx = this.focus.x / UNIT, fz = this.focus.y / UNIT;
    bend.uFocus.value.set(fx, 0, fz);
    aimCamera(this.camera, this.focus, this.width, this.height);
    const view = viewWindow(this.camera, fz, this.width, this.height);
    this.flora.update(w, fx, fz, view, this.low ? LOW_AHEAD : undefined);
    this.props.update(w, worldTargets(w), 0, nightStrength(w.elapsed), fx, fz, view, this.low ? LOW_AHEAD : undefined);
    if (!this.low) this.dressing.update(fx, fz, view);
    const target = this.renderer.getRenderTarget();
    this.renderer.setRenderTarget(this.low ? null : this.composer.readBuffer);
    const compiled = this.renderer.compileAsync(this.scene, this.camera);
    this.renderer.setRenderTarget(target);
    // A compile that never settles (a lost context) must not keep the island from drawing.
    Promise.race([compiled, new Promise(done => setTimeout(done, PRIME_TIMEOUT_MS))]).catch(() => undefined).finally(() => requestAnimationFrame(this.frame));
  }

  project(x: number, y: number, height = 0) {
    const p = projectScene(this.camera, this.focus.y / UNIT, x / UNIT, height, y / UNIT, this.width, this.height);
    return {x: p.x, y: p.y};
  }
  snapToPlayer() { this.focused = false; }
  setSpeech(speaker: Speaker | undefined, text = '') { this.speech = speaker ? {speaker, text} : undefined; }
  stats() { return {fps: this.fps, calls: this.calls, rendered: this.rendered, sounds: this.soundTicks}; }

  private resize() {
    this.width = innerWidth;
    this.height = innerHeight;
    this.renderer.setSize(this.width, this.height);
    this.composer.setSize(this.width, this.height);
    this.tiltH.uniforms.h.value = 1.9 / this.width;
    this.tiltV.uniforms.v.value = 1.9 / this.height;
  }

  private click(e: PointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const id = pickBox(this.boxes, e.offsetX, e.offsetY, this.see);
    if (id) { this.control.activate(id); return; }
    const point = pickGround(this.camera, this.focus.y / UNIT, e.offsetX, e.offsetY, this.width, this.height);
    if (point) this.control.clickWorld(point);
  }

  private frame = (time: number) => {
    requestAnimationFrame(this.frame);
    const realDt = this.last ? (time - this.last) / 1000 : 0;
    this.last = time;
    const me = this.bridge.me();
    if (me) this.control.update(realDt, this.input.keys());
    this.now += Math.min(realDt, .25);
    this.countFps(realDt);
    const w = this.bridge.world(), night = nightStrength(w.elapsed);
    // Sound runs before the indoor return: audio.update is what switches to the home tune and quiets the surf.
    if (me) this.sounds(w, me, night);
    // Indoors the outdoor island is hidden: the controller above keeps the clock running, drawing stops.
    if (document.body.classList.contains('in-home')) return;
    this.follow(me, realDt);
    const fx = this.focus.x / UNIT, fz = this.focus.y / UNIT;
    bend.uFocus.value.set(fx, 0, fz);
    const distance = aimCamera(this.camera, this.focus, this.width, this.height);
    this.aimSeeThrough(me, fz);
    const light = daylight(night);
    this.sky.apply(light, fx, fz, distance);
    const water = this.water.material.uniforms;
    water.uTime.value = this.now;
    water.uShallow.value.copy(light.water[0]); water.uMid.value.copy(light.water[1]); water.uDeep.value.copy(light.water[2]); water.uFoam.value.copy(light.foam);
    this.renderer.toneMappingExposure = light.exposure;
    this.bloom.strength = light.bloomStrength;
    this.bloom.threshold = light.bloomThreshold;
    for (const c of this.chunks) c.mesh.visible = Math.hypot(c.x - fx, c.z - fz) < CHUNK_VIEW;
    const targets = worldTargets(w);
    const view = viewWindow(this.camera, fz, this.width, this.height);
    this.flora.update(w, fx, fz, view, this.low ? LOW_AHEAD : undefined);
    this.props.update(w, targets, this.now, night, fx, fz, view, this.low ? LOW_AHEAD : undefined);
    this.critters.update(w, targets, this.now);
    if (!this.low) this.dressing.update(fx, fz, view);
    if (me) this.actors.update(w, me, this.now, fz, light.tint, this.bridge.voice);
    const boxes = this.targetBoxes(w, targets, fz);
    this.boxes = [...boxes.values()];
    this.overlay.placeButtons(targets.filter(t => landmarkIds.has(t.id) || KEYBOARD_KINDS.has(t.kind)), boxes, this.width, this.height, this.bridge.blocked());
    if (me) this.placeTags(me, targets, boxes, fz);
    this.renderer.info.reset();
    if (this.low) this.renderer.render(this.scene, this.camera); else this.composer.render(realDt);
    this.calls = this.renderer.info.render.calls;
    this.rendered++;
    this.overlay.showStats(this.fps, this.calls);
  };

  // Centres the see-through circle on the hero's chest, in drawing-buffer pixels with y up (gl_FragCoord space).
  private aimSeeThrough(me: Player | undefined, fz: number) {
    const uniform = seeThrough.uSee.value;
    if (!me || me.room) { uniform.z = 0; this.see = undefined; return; }
    const pr = this.renderer.getPixelRatio(), see = seeCircle(this.camera, fz, me.x, me.y, this.width, this.height);
    this.see = see;
    uniform.set(see.x * pr, (this.height - see.y) * pr, see.r * pr);
    seeThrough.uSeeDepth.value = see.depth;
  }

  private countFps(realDt: number) {
    this.frames++;
    this.fpsTime += realDt;
    if (this.fpsTime >= 1) { this.fps = Math.round(this.frames / this.fpsTime); this.frames = 0; this.fpsTime = 0; }
  }

  // The focus eases toward the player (or the camp before a game starts) and snaps after loads and teleports.
  private follow(me: Player | undefined, realDt: number) {
    const target = me ?? CAMP;
    if (!this.focused) { this.focus = {x: target.x, y: target.y}; this.focused = !!me; return; }
    const k = 1 - Math.exp(-FOLLOW_RATE * Math.min(realDt, .25));
    this.focus.x += (target.x - this.focus.x) * k;
    this.focus.y += (target.y - this.focus.y) * k;
  }

  private targetBoxes(w: World, targets: readonly Target[], fz: number) {
    const boxes = new Map<string, ScreenBox>();
    for (const t of targets) {
      // Targets past the bent horizon are not on screen: no click box and no keyboard button.
      if (!groundVisible(this.camera, fz, t.x, t.y, this.width, this.height)) continue;
      const cut = t.kind === 'tree' && !w.resources[t.id];
      if (TREE_KINDS.has(t.kind) && !cut) { boxes.set(t.id, treeBox(this.camera, fz, t.id, t.x, t.y, this.width, this.height)); continue; }
      const size = hitSize(t.kind, cut);
      boxes.set(t.id, standingBox(this.camera, fz, t.id, t.x, t.y, size[0], size[1], this.width, this.height));
    }
    return boxes;
  }

  private placeTags(me: Player, targets: readonly Target[], boxes: ReadonlyMap<string, ScreenBox>, fz: number) {
    const tags: Tag[] = [], active = this.bridge.voice.active;
    let bubble: {x: number; y: number} | undefined;
    for (const h of this.actors.heads) {
      const p = projectScene(this.camera, fz, h.x / UNIT, h.height, h.y / UNIT, this.width, this.height);
      if (p.depth >= 1 || !groundVisible(this.camera, fz, h.x, h.y, this.width, this.height)) continue;
      tags.push({id: `actor-${h.id}`, text: h.me ? `${h.name} · 나` : h.name, x: p.x, y: p.y});
      if (active && h.speaker === active && this.speech?.speaker === active) bubble = {x: p.x, y: p.y - 26};
    }
    // One target name at a time: the nearest one in reach, so labels never pile up around the camp.
    const near = targets.filter(t => t.kind !== 'friend' && boxes.has(t.id) && Math.hypot(t.x - me.x, t.y - me.y) <= LABEL_RANGE).sort((a, b) => Math.hypot(a.x - me.x, a.y - me.y) - Math.hypot(b.x - me.x, b.y - me.y))[0];
    if (near) { const r = boxBounds(boxes.get(near.id)!); tags.push({id: `target-${near.id}`, text: near.name, x: (r.left + r.right) / 2, y: r.top}); }
    this.overlay.placeTags(tags);
    this.overlay.showBubble(bubble ? this.speech?.text : undefined, bubble?.x, bubble?.y);
  }

  // Tool hits, footsteps and the music mood, the same rules as the 2D scene's updateSteps/updateActionSound.
  private sounds(w: World, me: Player, night: number) {
    for (const p of Object.values(w.players)) {
      const g = p.gesture, s = p.swing;
      if (!g && !s) this.toolSounds.delete(p.id);
      else {
        const key = g ? `${g.kind}:${g.target || g.item || ''}` : `${s!.kind}:${s!.target}`;
        let state = this.toolSounds.get(p.id);
        if (!state || state.key !== key) { state = {key, played: false}; this.toolSounds.set(p.id, state); }
        const progress = g ? 1 - g.remaining / (g.duration || .8) : 1 - s!.remaining / .55;
        if (!state.played && progress >= (g?.kind === 'fill' ? .15 : .5)) {
          state.played = true;
          const d = Math.hypot(p.x - me.x, p.y - me.y);
          if (d < 500) this.bridge.audio.tool(g?.kind || s!.kind, Math.max(0, 1 - d / 500));
        }
      }
      const phase = Math.floor(p.walk / 4), previous = this.steps.get(p.id);
      this.steps.set(p.id, phase);
      if (previous === undefined || phase === previous || !p.moving || !p.ready || p.room || this.bridge.blocked()) continue;
      const d = Math.hypot(p.x - me.x, p.y - me.y);
      if (d < 650) this.bridge.audio.footstep(surfaceAt(p), p.input.run, (p.x - me.x) / 600, Math.max(0, 1 - d / 650));
    }
    const danger = (w.monsters || []).some(m => m.hp > 0 && Math.hypot(m.x - me.x, m.y - me.y) < 240);
    this.soundTicks++;
    this.bridge.audio.update(this.now, me.x - shore(me.y), night, danger ? 'danger' : night > .4 ? 'night' : me.x > 1600 ? 'forest' : 'beach');
  }
}
