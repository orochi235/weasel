/** Plain examples of the Shift+wheel size step, the first a wheel delta its property test shrank to. */
import { afterEach, expect, it, vi } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { createToolOptionValues, type ToolOptions } from './toolOptions';
import { toolOptionSteps, WHEEL_SIZE_MAX_STEPS } from './toolOptionSteps';

afterEach(() => { vi.useRealTimers(); });

function wheel() {
  const options: ToolOptions = {
    actionId: 'brush', size: { option: 'n', plus: 1 },
    prefs: { name: 'B', description: '', children: { n: { kind: 'number', name: 'N', description: '', default: 0 } as PrefNumber } },
  };
  const values = createToolOptionValues();
  const run = (toolOptionSteps('b', 'B', options).actions.find((a) => a.id === 'b.wheelSize')!.invoker as ImmediateInvoker).run;
  const deps = { activeTool: { active: 'b' }, toolOptionValues: values } as never;
  return { values, run: (deltaY: number) => run(deps, { deltaY }) };
}

it('returns from a huge wheel delta mid-burst, taking at most its cap of steps', () => {
  vi.useFakeTimers();
  const { values, run } = wheel();
  run(-1);
  run(-1e300);
  expect(values.get('b').n).toBe(1 + WHEEL_SIZE_MAX_STEPS);
});

it('steps at once on the first notch after the clock is set back', () => {
  vi.useFakeTimers();
  vi.setSystemTime(3_600_000);
  const { values, run } = wheel();
  run(-1);
  vi.setSystemTime(0);
  run(-1);
  expect(values.get('b').n).toBe(2);
});

