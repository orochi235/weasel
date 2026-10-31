import { describe, expect, it, vi } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { defineTool } from './defineTool';
import { createToolOptionValues, steppedOption, toolOptionParams, toolOptionSteps, type ToolOptions } from './toolOptions';

const OPTIONS: ToolOptions = {
  actionId: 'brush',
  prefs: {
    name: 'Brush',
    description: '',
    children: {
      radiusPx: { kind: 'number', name: 'Size', description: '', default: 40, min: 2, max: 100, step: 1 },
      strength: { kind: 'number', name: 'Strength', description: '', default: 0.6, min: 0.05, max: 1, step: 0.05 },
    },
  },
  size: { option: 'radiusPx', times: 1.25 },
  strength: { option: 'strength', plus: 0.1 },
};
const leaf = (key: string) => OPTIONS.prefs.children[key] as PrefNumber;

describe('steppedOption', () => {
  it('multiplies by `times`, rounded to the step and held to the bounds', () => {
    expect(steppedOption(leaf('radiusPx'), 40, OPTIONS.size!, 1)).toBe(50);
    expect(steppedOption(leaf('radiusPx'), 40, OPTIONS.size!, -1)).toBe(32);
    expect(steppedOption(leaf('radiusPx'), 90, OPTIONS.size!, 1)).toBe(100);
    expect(steppedOption(leaf('radiusPx'), 2, OPTIONS.size!, -1)).toBe(2);
  });

  it('adds `plus`, held to the bounds', () => {
    expect(steppedOption(leaf('strength'), 0.6, OPTIONS.strength!, 1)).toBe(0.7);
    expect(steppedOption(leaf('strength'), 0.95, OPTIONS.strength!, 1)).toBe(1);
    expect(steppedOption(leaf('strength'), 0.1, OPTIONS.strength!, -1)).toBe(0.05);
  });

  it('moves at least one step when rounding would undo it', () => {
    expect(steppedOption(leaf('radiusPx'), 3, OPTIONS.size!, 1)).toBe(4);
  });
});

describe('toolOptionParams', () => {
  it('reads held values over the defaults', () => {
    const values = createToolOptionValues();
    expect(toolOptionParams('b', OPTIONS, values)).toEqual({ radiusPx: 40, strength: 0.6 });
    values.set('b', 'radiusPx', 12);
    expect(toolOptionParams('b', OPTIONS, values)).toEqual({ radiusPx: 12, strength: 0.6 });
    expect(toolOptionParams('b', OPTIONS, undefined)).toEqual({ radiusPx: 40, strength: 0.6 });
  });
});

describe('toolOptionSteps', () => {
  const run = (action: { invoker?: unknown }, deps: object) => (action.invoker as ImmediateInvoker).run(deps as never, undefined);

  it('steps the size and strength of the active tool only', () => {
    const values = createToolOptionValues();
    const { actions } = toolOptionSteps('b', 'Brush', OPTIONS);
    expect(actions.map((a) => a.id)).toEqual(['b.grow', 'b.shrink', 'b.raise', 'b.lower']);
    const [grow, , raise] = actions;
    const active = { activeTool: { active: 'b' }, toolOptionValues: values };
    expect(grow.enabled!(active as never)).toBe(true);
    expect(grow.enabled!({ activeTool: { active: 'select' }, toolOptionValues: values } as never)).not.toBe(true);
    run(grow, active);
    run(raise, active);
    expect(values.get('b')).toEqual({ radiusPx: 50, strength: 0.7 });
  });

  it('binds `[` `]` and Shift+`[` `]`, which defineTool adds to the tool', () => {
    const tool = defineTool({
      id: 'b', options: OPTIONS, presentation: { label: 'Brush' },
      bindings: [{ spec: { kind: 'drag' }, actionId: 'brush' }],
    });
    expect(tool.options).toBe(OPTIONS);
    expect(tool.bindings!.map((b) => b.actionId)).toEqual(['brush', 'b.grow', 'b.shrink', 'b.raise', 'b.lower']);
    expect(tool.bindings![1].spec).toMatchObject({ kind: 'key', key: ']' });
    expect(tool.bindings![3].spec).toMatchObject({ kind: 'key', mods: { shift: true } });
    expect(tool.actions!.map((a) => a.label)).toEqual(['Grow Brush', 'Shrink Brush', 'Raise Brush strength', 'Lower Brush strength']);
  });

  it('leaves out the steps an option set does not name', () => {
    const { actions } = toolOptionSteps('b', 'Brush', { ...OPTIONS, strength: undefined });
    expect(actions.map((a) => a.id)).toEqual(['b.grow', 'b.shrink']);
  });

  it('notifies subscribers of a set', () => {
    const values = createToolOptionValues();
    const listener = vi.fn();
    values.subscribe(listener);
    values.set('b', 'radiusPx', 3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
