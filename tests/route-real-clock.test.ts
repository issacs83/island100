import test from 'node:test';
import assert from 'node:assert/strict';
import {emptyWorld, addPlayer, setInput, step} from '../src/shared.ts';
import {CAMP} from '../src/exploration.ts';
import {advanceClock, SIM_STEP, type SimClock} from '../src/clock.ts';
import {IslandController, NO_KEYS, type ControlBridge} from '../src/island-controller.ts';

// The controller wired to the real world step and fixed-step clock, the way main.ts runs solo play.
function soloRig() {
  const world = emptyWorld(), me = addPlayer(world, 'solo', '박하준');
  me.ready = true; me.looted = true; me.quiz = true; world.phase = 4; me.x = CAMP.x; me.y = CAMP.y;
  const clock: SimClock = {pending: 0}, ticks: number[] = [];
  const bridge: ControlBridge = {
    world: () => world, me: () => me, input: v => setInput(me, v), action: () => {}, notice: () => {}, blocked: () => false,
    advance: dt => advanceClock(clock, dt), tick: dt => { ticks.push(dt); step(world, dt); },
  };
  return {control: new IslandController(bridge), ticks};
}
const SPOTS = [[160, 60], [-220, 140], [300, -90], [-120, -60], [80, 170], [240, 120]];

for (const [hz, run, limit] of [[120, false, 8], [144, false, 8], [60, true, 4], [14, false, 8]] as const) {
  test(`A walk-to route finishes at ${hz} fps${run ? ' while running' : ''}`, () => {
    const stuck: string[] = [];
    for (const [dx, dy] of SPOTS) {
      const {control} = soloRig();
      control.goTo(CAMP.x + dx, CAMP.y + dy);
      for (let f = 0; f < hz * limit && control.target; f++) control.update(1 / hz, {...NO_KEYS, run});
      if (control.target) stuck.push(`${dx},${dy}`);
    }
    assert.deepEqual(stuck, [], `routes that never finished within ${limit}s`);
  });
}

test('The solo world only ever advances in fixed 1/30 s steps', () => {
  const {control, ticks} = soloRig();
  control.goTo(CAMP.x + 160, CAMP.y + 60);
  for (let f = 0; f < 120; f++) control.update(1 / 120, NO_KEYS);
  assert.ok(ticks.length >= 29 && ticks.length <= 31, `${ticks.length} steps in one second`);
  assert.ok(ticks.every(t => t === SIM_STEP), 'every step is SIM_STEP');
});
