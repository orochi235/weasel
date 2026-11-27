import { describe, expect, it, vi } from 'vitest';
import type { PrefNumber } from '@weasel-js/prefs-schema';
import type { ImmediateInvoker } from '../interactions/actions/invoker';
import { defineTool } from './defineTool';
import { createToolOptionValues, steppedOption, toolOptionParams, withToolOptionDefault, type ToolOptionsSpec } from './toolOptions';
import { toolOptionSteps, WHEEL_SIZE_BURST_MS, WHEEL_SIZE_STEP_PX } from './toolOptionSteps';

const OPTIONS: ToolOptionsSpec = {
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

  it('moves an off-grid value on to the next grid point when a small step would round it back past where it began', () => {
    const ones: PrefNumber = { kind: 'number', name: 'S', description: '', default: 10, step: 1 };
    expect(steppedOption(ones, 10.4, { option: 's', times: 1.005 }, 1)).toBe(11);
    expect(steppedOption(ones, 10.6, { option: 's', times: 1.005 }, -1)).toBe(10);
    expect(steppedOption(ones, 10.4, { option: 's', plus: 0.2 }, 1)).toBe(11);
    expect(steppedOption(ones, 10.6, { option: 's', plus: 0.2 }, -1)).toBe(10);
  });

  it('moves at least one step on a fractional step, where rounding lands a float error away from the start', () => {
    const tenths: PrefNumber = { kind: 'number', name: 'S', description: '', default: 0.3, min: 0, max: 10, step: 0.1 };
    expect(steppedOption(tenths, 0.3, { option: 's', times: 1.1 }, 1)).toBe(0.4);
    expect(steppedOption(tenths, 0.3, { option: 's', times: 1.1 }, -1)).toBe(0.2);
  });

  it('moves a scaled option off 0 and up from below it', () => {
    const free: PrefNumber = { kind: 'number', name: 'S', description: '', default: 0 };
    const step = { option: 's', times: 1.25 };
    expect(steppedOption(free, 0, step, 1)).toBe(1);
    expect(steppedOption(free, 0, step, -1)).toBe(-1);
    expect(steppedOption(free, -4, step, 1)).toBe(-3);
    expect(steppedOption(free, 4, step, 1)).toBe(5);
  });

  it('keeps a step on a value past 12 significant digits, rather than rounding it to 12', () => {
    const big: PrefNumber = { kind: 'number', name: 'Big', description: '', default: 0 };
    expect(steppedOption(big, 1000000000009, { option: 'big', plus: 0.2 }, 1)).toBeCloseTo(1000000000009.2, 3);
    expect(steppedOption(leaf('strength'), 0.6, OPTIONS.strength!, 1)).toBe(0.7);
  });

  it('steps an unbounded infinity back to the largest double', () => {
    const free: PrefNumber = { kind: 'number', name: 'S', description: '', default: 0 };
    expect(steppedOption(free, Infinity, { option: 's', times: 2 }, -1)).toBe(Number.MAX_VALUE);
    expect(steppedOption(free, -Infinity, { option: 's', plus: 1 }, 1)).toBe(-Number.MAX_VALUE);
  });

  it('steps between an endless end and the infinity it stands for', () => {
    const reach: PrefNumber = { kind: 'number', name: 'R', description: '', default: 10, min: 1, max: 100, step: 1, endless: 'max' };
    const step = { option: 'r', times: 1.25 };
    expect(steppedOption(reach, 100, step, 1)).toBe(Infinity);
    expect(steppedOption(reach, Infinity, step, 1)).toBe(Infinity);
    expect(steppedOption(reach, Infinity, step, -1)).toBe(100);
    expect(steppedOption(reach, 1, step, -1)).toBe(1);
  });
});

describe('withToolOptionDefault', () => {
  it('holds a starting value to the leaf\'s bounds, as it holds a held value', () => {
    expect(toolOptionParams('b', withToolOptionDefault(OPTIONS, 'radiusPx', 500), undefined).radiusPx).toBe(100);
    expect(toolOptionParams('b', withToolOptionDefault(OPTIONS, 'radiusPx', 0), undefined).radiusPx).toBe(2);
    expect(toolOptionParams('b', withToolOptionDefault(OPTIONS, 'radiusPx', 12), undefined).radiusPx).toBe(12);
  });

  it('keeps the declared default, and warns, for a starting value the leaf cannot read', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      expect(withToolOptionDefault(OPTIONS, 'radiusPx', 'big')).toBe(OPTIONS);
      expect(withToolOptionDefault(OPTIONS, 'radiusPx', Number.NaN)).toBe(OPTIONS);
      expect(warn).toHaveBeenCalledTimes(2);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('createToolOptionValues', () => {
  it('notifies nobody, and keeps the owner\'s record, for a write of the value an option holds', () => {
    const values = createToolOptionValues();
    let calls = 0;
    values.subscribe(() => { calls++; });
    values.set('b', 'radiusPx', Number.NaN);
    values.set('b', 'dash', [4, 2]);
    const held = values.get('b');
    values.set('b', 'radiusPx', Number.NaN);
    values.set('b', 'dash', [4, 2]);
    expect(calls).toBe(2);
    expect(values.get('b')).toBe(held);
    values.set('b', 'radiusPx', 3);
    expect(calls).toBe(3);
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

  it('reads a held NaN as the default', () => {
    const values = createToolOptionValues();
    values.set('b', 'radiusPx', Number.NaN);
    expect(toolOptionParams('b', OPTIONS, values)).toEqual({ radiusPx: 40, strength: 0.6 });
  });

  it('reads an infinity its leaf has no endless end for as the bound it passes, as a tool sharing the option may hold one', () => {
    const values = createToolOptionValues();
    values.set('b', 'radiusPx', -Infinity);
    values.set('b', 'strength', Infinity);
    expect(toolOptionParams('b', OPTIONS, values)).toEqual({ radiusPx: 2, strength: 1 });
    const unbounded: ToolOptionsSpec = {
      ...OPTIONS,
      prefs: { ...OPTIONS.prefs, children: { reach: { kind: 'number', name: 'Reach', description: '', default: 10 } } },
    };
    values.set('b', 'reach', Infinity);
    expect(toolOptionParams('b', unbounded, values)).toEqual({ reach: 10 });
  });

  it('reads the infinity an endless end stands for as held', () => {
    const endless: ToolOptionsSpec = {
      ...OPTIONS,
      prefs: {
        ...OPTIONS.prefs,
        children: { reach: { kind: 'number', name: 'Reach', description: '', default: 10, min: 0, max: 100, endless: 'max' } },
      },
    };
    const values = createToolOptionValues();
    values.set('b', 'reach', Infinity);
    expect(toolOptionParams('b', endless, values)).toEqual({ reach: Infinity });
  });

  it('reads the default of an option named like an Object.prototype member', () => {
    const named: ToolOptionsSpec = {
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
