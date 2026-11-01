// Fixed-step simulation clock: the solo world advances in equal steps however fast frames arrive,
// so a slow phone does not stretch the 300-second day.
export const SIM_STEP = 1 / 30;
export const MAX_STEPS_PER_FRAME = 5;
// Longest frame gap that still counts as play time; a backgrounded tab must not fast-forward the island.
export const MAX_FRAME_GAP = .25;
export type SimClock = {pending: number};

// Adds one frame's real time and returns how many fixed steps the world should advance now.
export function advanceClock(clock: SimClock, realDt: number): number {
  const dt = Number.isFinite(realDt) ? Math.min(Math.max(realDt, 0), MAX_FRAME_GAP) : 0;
  clock.pending = Math.min(clock.pending + dt, SIM_STEP * MAX_STEPS_PER_FRAME);
  let steps = 0;
  while (clock.pending >= SIM_STEP - 1e-9 && steps < MAX_STEPS_PER_FRAME) {
    clock.pending -= SIM_STEP;
    steps++;
  }
  if (clock.pending < 0) clock.pending = 0;
  return steps;
}
