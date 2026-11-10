import { describe, expect, it } from 'vitest';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import {
  createToolOptionValues, heldToolOptions, keepToolOptions, setToolOption, shareToolOptions, SHARED_TOOL_OPTIONS,
  toolOptionParams, type ToolOptions,
} from './toolOptions';
import { toolOptionSteps } from './toolOptionSteps';

const RED = { color: '#ff0000' };
const BLUE = { color: '#0000ff' };

const shape = (fill: unknown): ToolOptions => ({
  actionId: ['insert', 'reshape'],
  prefs: {
    name: 'Shape',
    children: {
      fill: { kind: 'paint', name: 'Fill', description: '', default: fill },
      sides: { kind: 'number', name: 'Sides', description: '', default: 6, min: 3, max: 12, step: 1 },
      mode: { kind: 'enum', name: 'Mode', description: '', default: 'a', options: [{ value: 'a', label: 'A' }, { value: 'b', label: 'B' }] },
      closed: { kind: 'boolean', name: 'Closed', description: '', default: true },
    },
  },
  share: { fill: 'fill' },
  size: { option: 'sides', plus: 1 },
});

describe('shared tool options', () => {
  it('reads and writes a shared option in one slot for every tool naming its key', () => {
    const values = createToolOptionValues();
    const rect = shape(RED);
    const star = shape(BLUE);
    expect(toolOptionParams('rect', rect, values).fill).toEqual(RED);
    expect(toolOptionParams('star', star, values).fill).toEqual(BLUE);
    setToolOption('rect', rect, values, 'fill', BLUE);
    expect(values.get(SHARED_TOOL_OPTIONS)).toEqual({ fill: BLUE });
    expect(toolOptionParams('star', star, values).fill).toEqual(BLUE);
    expect(values.get('rect')).toEqual({});
  });

  it('keeps an option per tool when a use site shares it with nobody', () => {
    const values = createToolOptionValues();
    const own = shareToolOptions(shape(RED), { fill: null });
    setToolOption('rect', own, values, 'fill', BLUE);
    expect(values.get('rect')).toEqual({ fill: BLUE });
    expect(values.get(SHARED_TOOL_OPTIONS)).toEqual({});
  });

  it('shares an option the def keeps per tool when the use site names a key', () => {
    const values = createToolOptionValues();
    const a = shareToolOptions(shape(RED), { sides: 'count' });
    const b = shareToolOptions(shape(RED), { sides: 'count' });
    const grow = toolOptionSteps('a', 'A', a).actions.find((x) => x.id === 'a.grow')!;
    (grow.invoker as ImmediateInvoker).run({ activeTool: { active: 'a' }, toolOptionValues: values } as never, undefined);
    expect(toolOptionParams('b', b, values).sides).toBe(7);
  });

  it('holds a shared number to each tool’s own bounds', () => {
    const values = createToolOptionValues();
    const wide = shareToolOptions(shape(RED), { sides: 'count' });
    const narrow: ToolOptions = {
      ...wide,
      prefs: { ...wide.prefs, children: { sides: { kind: 'number', name: 'Sides', description: '', default: 4, min: 3, max: 5 } } },
    };
    setToolOption('wide', wide, values, 'sides', 10);
    expect(toolOptionParams('narrow', narrow, values).sides).toBe(5);
    expect(toolOptionParams('wide', wide, values).sides).toBe(10);
  });

  it('reads a held value its leaf cannot hold as the default', () => {
    const values = createToolOptionValues();
    const rect = shape(RED);
    values.set('rect', 'mode', 'nope');
    values.set('rect', 'closed', 'yes');
    expect(heldToolOptions('rect', rect, values)).toEqual({});
    values.set('rect', 'mode', 'b');
    expect(toolOptionParams('rect', rect, values)).toMatchObject({ mode: 'b', closed: true });
  });

  it('keeps a no-paint fill as held', () => {
    const values = createToolOptionValues();
    setToolOption('rect', shape(RED), values, 'fill', null);
    expect(toolOptionParams('rect', shape(RED), values).fill).toBeNull();
  });

  it('writes back only what the params change, into each option’s slot', () => {
    const values = createToolOptionValues();
    const rect = shape(RED);
    keepToolOptions('rect', rect, values, { fill: { color: '#ff0000' }, sides: 8, other: 1 });
    expect(values.get(SHARED_TOOL_OPTIONS)).toEqual({});
    expect(values.get('rect')).toEqual({ sides: 8 });
    keepToolOptions('rect', rect, values, { fill: BLUE });
    expect(values.get(SHARED_TOOL_OPTIONS)).toEqual({ fill: BLUE });
  });
});
