import test from 'node:test';
import assert from 'node:assert/strict';
import {advanceClock, SIM_STEP, MAX_STEPS_PER_FRAME, type SimClock} from '../src/clock.ts';

test('A 60 fps frame runs at most one step and keeps the remainder', () => {
  const c: SimClock = {pending: 0};
  assert.deepEqual([0, 0, 0, 0].map(() => advanceClock(c, 1 / 60)), [0, 1, 0, 1]);
});

test('An 8 fps frame catches up so game time keeps real-time pace', () => {
  const c: SimClock = {pending: 0};
  let steps = 0;
  for (let i = 0; i < 80; i++) steps += advanceClock(c, 1 / 8);
  assert.ok(Math.abs(steps * SIM_STEP - 10) <= SIM_STEP, `simulated ${steps * SIM_STEP}s for 10 real seconds`);
});

test('A very slow frame is capped at five steps instead of freezing the page', () => {
  const c: SimClock = {pending: 0};
  assert.equal(advanceClock(c, .5), MAX_STEPS_PER_FRAME);
  assert.ok(c.pending < SIM_STEP, 'no backlog is carried past the cap');
});

test('Returning from a hidden tab does not burst-run the world', () => {
  const c: SimClock = {pending: 0};
  assert.equal(advanceClock(c, 30), MAX_STEPS_PER_FRAME);
  assert.equal(advanceClock(c, 1 / 60), 0);
});

test('Negative or NaN frame times are ignored', () => {
  const c: SimClock = {pending: 0};
  assert.equal(advanceClock(c, -1), 0);
  assert.equal(advanceClock(c, Number.NaN), 0);
  assert.equal(c.pending, 0);
});
