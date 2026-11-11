/**
 * Property test of the Shift+wheel size step against a count of its steps: a burst of wheel events one way steps
 * once at its first event and once per {@link WHEEL_SIZE_STEP_PX} of travel after it, a rest or a turn the other way
 * starts a new burst, a delta that is no number moves nothing, and a delta of any size returns.
 */
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import fc from 'fast-check';
import type { PrefNumber } from '@weasel-js/prefs';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { runs, tally } from '../pbt.fixture';
import { createToolOptionValues, type ToolOptions } from './toolOptions';
import { toolOptionSteps, WHEEL_SIZE_BURST_MS, WHEEL_SIZE_MAX_STEPS, WHEEL_SIZE_STEP_PX } from './toolOptionSteps';

// An option with no bounds that steps by one, so its value counts the steps taken.
const OPTIONS: ToolOptions = {
  actionId: 'brush',
  prefs: { name: 'Brush', description: '', children: { n: { kind: 'number', name: 'N', description: '', default: 0 } as PrefNumber } },
  size: { option: 'n', plus: 1 },
};

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

const delta = fc.oneof(
  { weight: 6, arbitrary: fc.integer({ min: -200, max: 200 }) },
  fc.constantFrom(NaN, Infinity, -Infinity, 1e300, -1e300, 0.5),
);

it('steps once a burst and once per wheel step of travel after, whatever the deltas', () => {
  const t = tally();
  fc.assert(fc.property(fc.array(fc.tuple(delta, fc.integer({ min: 0, max: 300 })), { maxLength: 40 }), (events) => {
    vi.setSystemTime(1_000_000);
    const values = createToolOptionValues();
    const wheel = toolOptionSteps('b', 'Brush', OPTIONS).actions.find((a) => a.id === 'b.wheelSize')!;
    const deps = { activeTool: { active: 'b' }, toolOptionValues: values };
    let want = 0;
    let travel = 0;
    let last = -Infinity;
    for (const [d, wait] of events) {
      vi.setSystemTime(Date.now() + wait);
      (wheel.invoker as ImmediateInvoker).run(deps as never, { deltaY: d });
      if (!Number.isFinite(d) || d === 0) { t.hit('ignored'); continue; }
      const dir = d < 0 ? 1 : -1;
      const now = Date.now();
      if (now - last > WHEEL_SIZE_BURST_MS || (travel !== 0 && Math.sign(travel) !== Math.sign(d))) {
        travel = 0;
        want += dir;
      } else {
        travel += d;
        const steps = Math.floor(Math.abs(travel) / WHEEL_SIZE_STEP_PX);
        travel -= Math.sign(travel) * steps * WHEEL_SIZE_STEP_PX;
        want += dir * Math.min(steps, WHEEL_SIZE_MAX_STEPS);
        if (steps > WHEEL_SIZE_MAX_STEPS) t.hit('huge');
      }
      last = now;
      const held = values.get('b').n ?? 0;
      expect(held, `after ${d}`).toBe(want);
    }
  }), runs(300));
  t.expectHit('ignored', 'huge');
});
