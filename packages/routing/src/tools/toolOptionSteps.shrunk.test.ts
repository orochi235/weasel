/** A wheel delta the Shift+wheel size step's property test shrank to. */
import { afterEach, expect, it, vi } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { createToolOptionValues, type ToolOptions } from './toolOptions';
import { toolOptionSteps, WHEEL_SIZE_MAX_STEPS } from './toolOptionSteps';

afterEach(() => { vi.useRealTimers(); });

it('returns from a huge wheel delta mid-burst, taking at most its cap of steps', () => {
  vi.useFakeTimers();
  const options: ToolOptions = {
    actionId: 'brush', size: { option: 'n', plus: 1 },
    prefs: { name: 'B', description: '', children: { n: { kind: 'number', name: 'N', description: '', default: 0 } as PrefNumber } },
  };
  const values = createToolOptionValues();
  const run = (toolOptionSteps('b', 'B', options).actions.find((a) => a.id === 'b.wheelSize')!.invoker as ImmediateInvoker).run;
  const deps = { activeTool: { active: 'b' }, toolOptionValues: values } as never;
  run(deps, { deltaY: -1 });
  run(deps, { deltaY: -1e300 });
  expect(values.get('b').n).toBe(1 + WHEEL_SIZE_MAX_STEPS);
});
