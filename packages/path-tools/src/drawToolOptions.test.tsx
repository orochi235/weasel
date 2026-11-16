import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { createToolOptionValues, setToolOption, toolOptionParams } from '@weasel-js/routing';
import { toolOptionPaint, useRectTool, type InsertToolOptions } from '@weasel-js/core';
import { usePenTool } from './pen/usePenTool';
import { usePencilTool } from './pencil/usePencilTool';

describe('the pen\'s and pencil\'s tool options', () => {
  it('share the shape tools\' fill and stroke width', () => {
    const t = renderHook(() => ({ rect: useRectTool(), pen: usePenTool() })).result.current;
    const values = createToolOptionValues();
    setToolOption('rect', t.rect.options!, values, 'fill', { color: '#123456' });
    setToolOption('rect', t.rect.options!, values, 'strokeWidth', 5);
    expect(toolOptionParams('pen', t.pen.options!, values)).toMatchObject({ fill: { color: '#123456' }, strokeWidth: 5 });
  });

  it('default their colors in the one spelling every tool uses', () => {
    const t = renderHook(() => ({ pen: usePenTool(), pencil: usePencilTool() })).result.current;
    for (const [id, tool] of Object.entries(t)) {
      for (const [key, leaf] of Object.entries(tool.options!.prefs.children)) {
        if ((leaf as { kind?: string }).kind !== 'paint') continue;
        const value = (leaf as { default: Parameters<typeof toolOptionPaint>[0] }).default;
        expect(value, `${id}.${key}`).toEqual(toolOptionPaint(value));
      }
    }
  });

  it('carry the pencil\'s behaviors onto its insert binding', () => {
    // Only identity is under test, so any object stands in for a behavior.
    const behaviors = [{}] as NonNullable<InsertToolOptions['behaviors']>;
    const { result } = renderHook(() => usePencilTool({ behaviors }));
    expect(result.current.bindings?.find((b) => b.actionId === 'insert')?.opts?.behaviors).toEqual(behaviors);
  });
});
