import {worldTargets, type Input, type Player, type World} from './shared';
import {clearSight, findRoute, type Point} from './terrain';
import {pickClickTarget} from './click-target';
import {MAX_FRAME_GAP, SIM_STEP} from './clock';

// Movement keys held this frame, already mapped from whatever device the renderer listens to.
export type HeldKeys = {up: boolean; down: boolean; left: boolean; right: boolean; run: boolean; sneak: boolean};
export const NO_KEYS: HeldKeys = {up: false, down: false, left: false, right: false, run: false, sneak: false};
// The slice of the game bridge the controller needs; the Phaser scene's Bridge satisfies it.
// advance(realDt) says how many fixed SIM_STEP steps the world takes this frame (0 in online play or while paused);
// tick(dt) advances the world by one such step.
export type ControlBridge = {world: () => World; me: () => Player | undefined; input: (v: Input) => void; action: (targetId?: string) => void; advance: (realDt: number) => number; tick: (dt: number) => void; blocked: () => boolean; notice: (text: string) => void};

// Reach for acting straight away on a click, and the slightly tighter reach that counts as arrival on foot.
// Rain barrels are used from the side; a bow reaches animals and monsters from far away.
export function clickReach(kind: string, equipped?: string) {
  return kind === 'rain' ? 65 : ['animal', 'monster'].includes(kind) && equipped === 'bow' ? 270 : 110;
}
export function arrivalReach(kind: string, equipped?: string) {
  return kind === 'rain' ? 65 : ['animal', 'monster'].includes(kind) && equipped === 'bow' ? 265 : 99;
}
const AUTO_SNEAK_RANGE = 240;
const ROUTE_SPEED = 195;
const ARRIVED = .8;
const HUNT_REROUTE = .6;
const NO_PATH = '이곳으로 이어지는 길이 없어요. 다른 길을 찾아보세요.';
const ADJUSTED = '장애물 앞의 걸을 수 있는 곳으로 이동해요.';

// Renderer-independent hero control: walk-to routes, click targets, auto-sneak, joystick and keys.
// The 2D Phaser scene and the 3D renderer drive the same controller.
export class IslandController {
  target?: Point;
  waypoints: Point[] = [];
  pendingInteract?: string;
  private joy = {x: 0, y: 0};
  private now = 0;
  private lastHuntRoute = 0;

  constructor(private bridge: ControlBridge) {}

  // Steers the hero for one rendered frame. When the world steps locally it advances in fixed SIM_STEP steps,
  // each steered on its own, so the hero cannot overshoot a waypoint at any frame rate.
  update(realDt: number, keys: HeldKeys) {
    const frameDt = Number.isFinite(realDt) ? Math.min(Math.max(realDt, 0), MAX_FRAME_GAP) : 0;
    this.now += frameDt;
    const me = this.bridge.me();
    if (!me) return;
    this.followHuntTarget();
    const steps = this.bridge.advance(realDt);
    // Frames that step no world time here (online play, menus, a fast frame between steps) steer as before the clock change.
    this.steer(me, keys, steps > 0 ? SIM_STEP : Math.min(frameDt, .05));
    for (let i = 0; i < steps; i++) {
      if (i > 0) this.steer(me, keys, SIM_STEP);
      this.bridge.tick(SIM_STEP);
    }
  }

  // Turns held keys, the joystick or the current route into one movement input sized for dt seconds of travel.
  private steer(me: Player, keys: HeldKeys, dt: number) {
    let x = 0, y = 0;
    if (!this.bridge.blocked()) {
      x = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      y = (keys.down ? 1 : 0) - (keys.up ? 1 : 0);
      if (this.joy.x || this.joy.y) { x = this.joy.x; y = this.joy.y; }
      if (x || y) this.clearRoute();
      else if (this.arrived(me)) { this.bridge.action(this.pendingInteract); this.clearRoute(); }
      else if (this.target) {
        const dx = this.target.x - me.x, dy = this.target.y - me.y, len = Math.hypot(dx, dy);
        if (len < ARRIVED) this.target = this.waypoints.shift();
        else {
          const amount = Math.min(1, len / (ROUTE_SPEED * dt || 1));
          x = dx / len * amount;
          y = dy / len * amount;
        }
      }
    } else {
      this.clearRoute();
      this.joy = {x: 0, y: 0};
    }
    const sneaking = this.chasingBug(me);
    this.bridge.input({x, y, run: keys.run && !sneaking, sneak: keys.sneak || sneaking});
  }

  // Plans a route; the notices match what the player saw before the split.
  goTo(x: number, y: number) {
    const me = this.bridge.me();
    if (!me) return;
    const route = findRoute(me, {x, y});
    this.waypoints = route.points;
    this.target = this.waypoints.shift();
    if (!this.target) { this.pendingInteract = undefined; this.bridge.notice(NO_PATH); }
    else if (route.adjusted && !this.pendingInteract) this.bridge.notice(ADJUSTED);
  }

  // Acts now when in reach and in sight, otherwise walks up to the target and acts on arrival.
  interactWith(id: string) {
    if (this.bridge.blocked()) return;
    const me = this.bridge.me();
    if (me?.activity) { this.bridge.action(); return; }
    const l = worldTargets(this.bridge.world()).find(t => t.id === id);
    if (!l || !me) return;
    if (Math.hypot(me.x - l.x, me.y - l.y) < clickReach(l.kind, me.equipped) && clearSight(me, l, l.id)) { this.bridge.action(id); return; }
    this.pendingInteract = id;
    this.goTo(l.x + (l.kind === 'rain' ? 55 : 15), l.y + (l.kind === 'rain' ? 15 : 30));
  }

  // A click or tap on open world space: the nearest target in reach, otherwise a walk to that spot.
  clickWorld(point: Point) {
    if (this.bridge.blocked()) return;
    const hit = pickClickTarget(point, worldTargets(this.bridge.world()));
    if (hit) this.interactWith(hit);
    else { this.pendingInteract = undefined; this.goTo(point.x, point.y); }
  }

  // A click that landed on a target's own art or hit box; a closer target in reach still wins.
  clickOwned(point: Point, owner: string) {
    this.interactWith(pickClickTarget(point, worldTargets(this.bridge.world()), owner));
  }

  // Keyboard activation of a focused hit button keeps that button's own target.
  activate(owner: string) { this.interactWith(owner); }

  pressAction() { if (!this.bridge.blocked()) this.bridge.action(); }
  pressJoystick() { this.clearRoute(); }
  setJoystick(x: number, y: number) { this.joy = {x, y}; }
  releaseJoystick() { this.joy = {x: 0, y: 0}; }

  private arrived(me: Player) {
    const id = this.pendingInteract;
    return !!id && worldTargets(this.bridge.world()).some(l => l.id === id && Math.hypot(me.x - l.x, me.y - l.y) < arrivalReach(l.kind, me.equipped) && clearSight(me, l, l.id));
  }

  private chasingBug(me: Player) {
    const id = this.pendingInteract;
    const bug = id ? worldTargets(this.bridge.world()).find(l => l.id === id && l.kind === 'bug') : undefined;
    return !!bug && Math.hypot(me.x - bug.x, me.y - bug.y) < AUTO_SNEAK_RANGE;
  }

  // Animals and monsters move, so a hunt re-plans its route every HUNT_REROUTE seconds.
  private followHuntTarget() {
    if (!this.pendingInteract || this.now - this.lastHuntRoute <= HUNT_REROUTE) return;
    const w = this.bridge.world();
    const prey = [...(w.animals || []), ...(w.monsters || [])].find(a => a.id === this.pendingInteract && a.hp > 0);
    if (prey) { this.lastHuntRoute = this.now; this.goTo(prey.x, prey.y); }
  }

  private clearRoute() {
    this.target = undefined;
    this.waypoints = [];
    this.pendingInteract = undefined;
  }
}
