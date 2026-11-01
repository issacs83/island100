import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld, addPlayer, worldTargets, type Input} from '../src/shared.ts';
import {bugSpots} from '../src/island-life.ts';
import {CAMP} from '../src/exploration.ts';
import {IslandController, NO_KEYS, type ControlBridge, type HeldKeys} from '../src/island-controller.ts';
import {SIM_STEP} from '../src/clock.ts';

// A solo island with a recording bridge; the world itself never steps, so tests move the hero by hand.
// log.steps is how many fixed steps the fake clock grants per frame (0 behaves like online play or a paused menu).
function harness(x = CAMP.x, y = CAMP.y) {
  const world = emptyWorld(), me = addPlayer(world, 'solo', '박하준');
  me.ready = true; me.looted = true; me.quiz = true; world.phase = 4; me.x = x; me.y = y;
  const log = {inputs: [] as Input[], actions: [] as (string | undefined)[], ticks: [] as number[], notices: [] as string[], blocked: false, steps: 0};
  const bridge: ControlBridge = {
    world: () => world, me: () => me,
    input: v => { log.inputs.push(v); }, action: id => { log.actions.push(id); }, advance: () => log.steps, tick: dt => { log.ticks.push(dt); },
    blocked: () => log.blocked, notice: t => { log.notices.push(t); },
  };
  return {world, me, log, control: new IslandController(bridge)};
}
const keys = (k: Partial<HeldKeys>): HeldKeys => ({...NO_KEYS, ...k});
const last = <T>(a: T[]) => a[a.length - 1];
const OPEN_GROUND = {x: CAMP.x + 160, y: CAMP.y + 60};

test('Held keys steer the hero directly and cancel a walk-to target', () => {
  const {control, log} = harness();
  control.goTo(OPEN_GROUND.x, OPEN_GROUND.y);
  assert.ok(control.target, 'a route was planned');
  control.update(1 / 60, keys({right: true, down: true}));
  assert.deepEqual(last(log.inputs), {x: 1, y: 1, run: false, sneak: false});
  assert.equal(control.target, undefined);
  assert.equal(control.pendingInteract, undefined);
});

test('A click on open ground walks there', () => {
  const {control, log} = harness();
  control.clickWorld(OPEN_GROUND);
  assert.ok(control.target, 'walking toward the click');
  assert.equal(control.pendingInteract, undefined);
  control.update(1 / 30, NO_KEYS);
  const v = last(log.inputs);
  assert.ok(Math.hypot(v.x, v.y) > 0, 'moves toward the target');
});

test('Clicking a landmark out of reach walks over and acts on arrival', () => {
  const {control, log, me, world} = harness();
  const bag = worldTargets(world).find(l => l.id === 'bag')!;
  control.clickWorld({x: bag.x, y: bag.y - 25});
  assert.equal(control.pendingInteract, 'bag');
  assert.deepEqual(log.actions, []);
  me.x = bag.x + 20; me.y = bag.y + 30;
  control.update(1 / 30, NO_KEYS);
  assert.deepEqual(log.actions, ['bag']);
  assert.equal(control.pendingInteract, undefined);
});

test('Walking to a clicked bug switches to tiptoe within 240px', () => {
  const fly = bugSpots.find(b => b.id === 'bug-butterfly-2')!;
  const {control, log, world} = harness(fly.x + 230, fly.y);
  const bug = worldTargets(world).find(l => l.id === 'bug-butterfly-2')!;
  control.clickWorld({x: bug.x, y: bug.y - 25});
  assert.equal(control.pendingInteract, 'bug-butterfly-2');
  control.update(1 / 30, keys({run: true}));
  assert.equal(last(log.inputs).sneak, true);
  assert.equal(last(log.inputs).run, false);
});

test('An open menu stops the walk and drops the joystick', () => {
  const {control, log} = harness();
  control.clickWorld(OPEN_GROUND);
  control.setJoystick(.6, 0);
  log.blocked = true;
  control.update(1 / 30, keys({right: true}));
  assert.deepEqual(last(log.inputs), {x: 0, y: 0, run: false, sneak: false});
  assert.equal(control.target, undefined);
  log.blocked = false;
  control.update(1 / 30, NO_KEYS);
  assert.deepEqual(last(log.inputs), {x: 0, y: 0, run: false, sneak: false}, 'the menu released the joystick');
});

test('Touching the joystick cancels a walk-to route', () => {
  const {control, log} = harness();
  control.clickWorld(OPEN_GROUND);
  control.pressJoystick();
  control.setJoystick(0, -1);
  assert.equal(control.target, undefined);
  control.update(1 / 30, NO_KEYS);
  assert.deepEqual(last(log.inputs), {x: 0, y: -1, run: false, sneak: false});
});

test('Pressing Enter on a hit button acts on that button\'s own target', () => {
  const {control, log, me, world} = harness();
  const bag = worldTargets(world).find(l => l.id === 'bag')!;
  me.x = bag.x + 20; me.y = bag.y + 30;
  control.activate('bag');
  assert.deepEqual(log.actions, ['bag']);
});

test('Each fixed step is steered on its own before the world advances by SIM_STEP', () => {
  const {control, log, me} = harness();
  log.steps = 2;
  control.clickWorld(OPEN_GROUND);
  const t = control.target!;
  me.x = t.x - 3; me.y = t.y;
  control.update(.25, NO_KEYS);
  assert.deepEqual(log.ticks, [SIM_STEP, SIM_STEP]);
  assert.equal(log.inputs.length, 2, 'one steering input per step');
  const v = last(log.inputs);
  assert.ok(Math.abs(Math.hypot(v.x, v.y) - 3 / (195 * SIM_STEP)) < 1e-9, `input ${Math.hypot(v.x, v.y)} is sized for one SIM_STEP`);
});

test('E acts on whatever is nearest, but not while a menu is open', () => {
  const {control, log} = harness();
  control.pressAction();
  assert.deepEqual(log.actions, [undefined]);
  log.blocked = true;
  control.pressAction();
  assert.equal(log.actions.length, 1);
});

test('A hunted animal that moves is followed with a fresh route', () => {
  const {control, world} = harness();
  const rabbit = world.animals!.find(a => a.id === 'rabbit-2')!;
  control.clickWorld({x: rabbit.x, y: rabbit.y - 25});
  assert.equal(control.pendingInteract, 'rabbit-2');
  rabbit.x -= 120;
  control.update(.25, NO_KEYS); control.update(.25, NO_KEYS); control.update(.25, NO_KEYS);
  const end = control.waypoints.length ? control.waypoints[control.waypoints.length - 1] : control.target!;
  assert.ok(Math.hypot(end.x - rabbit.x, end.y - rabbit.y) < 80, `route ends near the rabbit, got ${Math.round(end.x)},${Math.round(end.y)}`);
});
