import { describe, expect, it } from 'vitest';
import {
  createToolOptionValues, setToolOption, shareToolOptions, SHARED_TOOL_OPTIONS, toolOptionParams, toolOptionSteps,
  type ImmediateInvoker, type ToolOptions,
} from '@weasel-js/routing';
import { BRUSH_SIZE_PX, shareBrushSize } from './brushSize';

const brush = (max: number): ToolOptions => ({
  actionId: 'paint',
  prefs: {
    name: 'Brush',
    description: '',
    children: {
      radiusPx: { kind: 'number', name: 'Size', description: '', default: Math.min(40, max), min: 2, max, step: 1 },
      strength: { kind: 'number', name: 'Strength', description: '', default: 0.5 },
    },
  },
  size: { option: 'radiusPx', times: 1.25 },
});

describe('shareBrushSize', () => {
  it('names a brush’s size option, and nothing for a tool with none', () => {
    expect(shareBrushSize(brush(400))).toEqual({ radiusPx: BRUSH_SIZE_PX });
    expect(shareBrushSize({}, 'other')).toEqual({});
  });

  it('gives brushes one size, held to each one’s bounds, and leaves their other options their own', () => {
    const big = shareToolOptions(brush(400), shareBrushSize(brush(400)));
    const small = shareToolOptions(brush(30), shareBrushSize(brush(30)));
    const values = createToolOptionValues();
    setToolOption('smudge', big, values, 'radiusPx', 120);
    setToolOption('small', small, values, 'strength', 0.9);
    expect(values.get(SHARED_TOOL_OPTIONS)).toEqual({ [BRUSH_SIZE_PX]: 120 });
    expect(toolOptionParams('small', small, values)).toEqual({ radiusPx: 30, strength: 0.9 });
    expect(toolOptionParams('smudge', big, values)).toEqual({ radiusPx: 120, strength: 0.5 });
  });

  it('moves every sharing brush’s size when one’s step action runs', () => {
    const big = shareToolOptions(brush(400), shareBrushSize(brush(400)));
    const small = shareToolOptions(brush(30), shareBrushSize(brush(30)));
    const values = createToolOptionValues();
    const grow = toolOptionSteps('small', 'Small', small).actions.find((a) => a.id === 'small.grow')!;
    (grow.invoker as ImmediateInvoker).run({ activeTool: { active: 'small' }, toolOptionValues: values } as never, undefined);
    expect(toolOptionParams('smudge', big, values).radiusPx).toBe(30);
  });
});
