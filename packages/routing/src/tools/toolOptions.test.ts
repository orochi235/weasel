import { describe, expect, it, vi } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { defineTool } from './defineTool';
import {
  createToolOptionValues, steppedOption, toolOptionParams, toolOptionSteps, WHEEL_SIZE_BURST_MS, WHEEL_SIZE_STEP_PX, type ToolOptions,
} from './toolOptions';

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

  it('reads a held value that is not a finite number as the default', () => {
    const values = createToolOptionValues();
    values.set('b', 'radiusPx', Number.NaN);
    values.set('b', 'strength', Infinity);
    expect(toolOptionParams('b', OPTIONS, values)).toEqual({ radiusPx: 40, strength: 0.6 });
  });

  it('reads the default of an option named like an Object.prototype member', () => {
    const named: ToolOptions = {
      ...OPTIONS,
      prefs: { ...OPTIONS.prefs, children: { toString: { kind: 'number', name: 'T', description: '', default: 3 } } },
    };
    expect(toolOptionParams('b', named, createToolOptionValues())).toEqual({ toString: 3 });
  });
});

describe('toolOptionSteps', () => {
  const run = (action: { invoker?: unknown }, deps: object) => (action.invoker as ImmediateInvoker).run(deps as never, undefined);

  it('steps the size and strength of the active tool only', () => {
    const values = createToolOptionValues();
    const { actions } = toolOptionSteps('b', 'Brush', OPTIONS);
    expect(actions.map((a) => a.id)).toEqual(['b.grow', 'b.shrink', 'b.raise', 'b.lower', 'b.wheelSize']);
    const [grow, , raise] = actions;
    const active = { activeTool: { active: 'b' }, toolOptionValues: values };
    expect(grow.enabled!(active as never)).toBe(true);
    expect(grow.enabled!({ activeTool: { active: 'select' }, toolOptionValues: values } as never)).not.toBe(true);
    run(grow, active);
    run(raise, active);
    expect(values.get('b')).toEqual({ radiusPx: 50, strength: 0.7 });
  });

  it('binds `[` `]`, Shift+`[` `]`, and Shift+wheel, which defineTool adds to the tool', () => {
    const tool = defineTool({
      id: 'b', options: OPTIONS, presentation: { label: 'Brush' },
      bindings: [{ spec: { kind: 'drag' }, actionId: 'brush' }],
    });
    expect(tool.options).toBe(OPTIONS);
    expect(tool.bindings!.map((b) => b.actionId)).toEqual(['brush', 'b.grow', 'b.shrink', 'b.raise', 'b.lower', 'b.wheelSize']);
    expect(tool.bindings![5].spec).toEqual({ kind: 'wheel', mods: { shift: true } });
    expect(tool.bindings![1].spec).toMatchObject({ kind: 'key', key: ']' });
    expect(tool.bindings![3].spec).toMatchObject({ kind: 'key', mods: { shift: true } });
    expect(tool.actions!.map((a) => a.label)).toEqual([
      'Grow Brush', 'Shrink Brush', 'Raise Brush strength', 'Lower Brush strength', 'Resize Brush with the wheel',
    ]);
  });

  it('leaves out the steps an option set does not name', () => {
    const { actions } = toolOptionSteps('b', 'Brush', { ...OPTIONS, strength: undefined });
    expect(actions.map((a) => a.id)).toEqual(['b.grow', 'b.shrink', 'b.wheelSize']);
    expect(toolOptionSteps('b', 'Brush', { ...OPTIONS, size: undefined }).actions.map((a) => a.id)).toEqual(['b.raise', 'b.lower']);
  });

  it('notifies subscribers of a set', () => {
    const values = createToolOptionValues();
    const listener = vi.fn();
    values.subscribe(listener);
    values.set('b', 'radiusPx', 3);
    expect(listener).toHaveBeenCalledTimes(1);
  });
});

describe('the Shift+wheel size step', () => {
  const setup = () => {
    const values = createToolOptionValues();
    const wheel = toolOptionSteps('b', 'Brush', OPTIONS).actions.find((a) => a.id === 'b.wheelSize')!;
    const deps = { activeTool: { active: 'b' }, toolOptionValues: values };
    const turn = (delta: { deltaX?: number; deltaY?: number }) =>
      (wheel.invoker as ImmediateInvoker).run(deps as never, delta);
    const size = () => toolOptionParams('b', OPTIONS, values).radiusPx;
    return { turn, size };
  };

  it('grows on up and shrinks on down, one step per notch', () => {
    vi.useFakeTimers();
    try {
      const { turn, size } = setup();
      turn({ deltaY: -4 });
      expect(size()).toBe(50);
      vi.advanceTimersByTime(WHEEL_SIZE_BURST_MS + 1);
      turn({ deltaY: 4 });
      expect(size()).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });

  it("reads deltaX when deltaY is 0, as macOS sends a Shift+wheel", () => {
    const { turn, size } = setup();
    turn({ deltaX: -100, deltaY: 0 });
    expect(size()).toBe(50);
  });

  it('steps a burst of small deltas once per WHEEL_SIZE_STEP_PX of travel after the first', () => {
    vi.useFakeTimers();
    try {
      const { turn, size } = setup();
      turn({ deltaY: -2 });
      for (let travelled = 0; travelled < WHEEL_SIZE_STEP_PX * 2; travelled += 2) {
        vi.advanceTimersByTime(10);
        turn({ deltaY: -2 });
      }
      // 40 → 50 at once, then two more steps of 1.25×, each rounded to whole px: 63, 79.
      expect(size()).toBe(79);
    } finally {
      vi.useRealTimers();
    }
  });

  it('steps at once when a burst turns back', () => {
    vi.useFakeTimers();
    try {
      const { turn, size } = setup();
      turn({ deltaY: -2 });
      vi.advanceTimersByTime(10);
      turn({ deltaY: -2 });
      vi.advanceTimersByTime(10);
      turn({ deltaY: 2 });
      expect(size()).toBe(40);
    } finally {
      vi.useRealTimers();
    }
  });
});
