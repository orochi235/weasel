import { describe, expect, it } from 'vitest';
import { ActionDisabledReason } from '../interactions/actions/action';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { createToolOptionValues, toolOptionParams, type ToolOptionsSpec } from './toolOptions';
import { toolOptionSteps } from './toolOptionSteps';
import { defineTool } from './defineTool';
import { findScopedConflicts } from './routing/reflection/conflicts';

const brush: ToolOptionsSpec = {
  actionId: 'paint',
  prefs: { name: 'Brush', children: { size: { kind: 'number', name: 'Size', description: '', default: 10 } } },
  size: { option: 'size', plus: 1 },
};

const grow = (id: string) => toolOptionSteps(id, id, brush).actions.find((a) => a.id === `${id}.grow`)!;
const enabled = (id: string, deps: object) => (grow(id).enabled as (d: never) => unknown)(deps as never);

describe('step actions of a tool held on its key', () => {
  it('are enabled for the held tool and not for the active one under it', () => {
    const values = createToolOptionValues();
    const deps = { activeTool: { active: 'select', hotkeyStack: ['brush'] }, toolOptionValues: values };
    expect(enabled('brush', deps)).toBe(true);
    expect(enabled('select', deps)).toBe(ActionDisabledReason.NotApplicable);
    (grow('brush').invoker as ImmediateInvoker).run(deps as never, undefined);
    expect(toolOptionParams('brush', brush, values).size).toBe(11);
  });

  it('are enabled for the active tool while nothing is held', () => {
    const deps = { activeTool: { active: 'brush', hotkeyStack: [] }, toolOptionValues: createToolOptionValues() };
    expect(enabled('brush', deps)).toBe(true);
  });
});

describe('step bindings of two tools held on keys', () => {
  it('are not reported as a conflict, as only the live tool\'s step runs', () => {
    const tool = (id: string, key: string) => defineTool({ id, hotkey: key, options: brush, presentation: { label: id } });
    expect(findScopedConflicts({ registry: [tool('brush', 'b'), tool('eraser', 'e')] })).toEqual([]);
  });
});

describe('the wheel size step', () => {
  it('starts a burst of its own on each canvas\'s option values', () => {
    const wheel = toolOptionSteps('brush', 'Brush', brush).actions.find((a) => a.id === 'brush.wheelSize')!;
    const run = (values: ReturnType<typeof createToolOptionValues>, deltaY: number) =>
      (wheel.invoker as ImmediateInvoker).run({ activeTool: { active: 'brush', hotkeyStack: [] }, toolOptionValues: values } as never, { deltaY });
    const a = createToolOptionValues();
    const b = createToolOptionValues();
    run(a, -10);
    run(b, -10);
    expect(toolOptionParams('brush', brush, a).size).toBe(11);
    expect(toolOptionParams('brush', brush, b).size).toBe(11);
  });
});
