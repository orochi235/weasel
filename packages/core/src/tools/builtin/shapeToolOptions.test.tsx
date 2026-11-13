import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { usePolygonTool } from './polygon';
import { useStarTool } from './star';
import { useRectTool } from './rect';
import { useLineTool } from './line';
import { useEllipseTool } from './ellipse';
import { usePenTool } from './pen';
import { useTextTool } from './text';
import { DEFAULT_SHAPE_PAINT, toolOptionPaint } from './shared/styleOptions';
import { useStickyTool } from './sticky';
import { usePencilTool } from './pencil';
import { createToolOptionValues, setToolOption, toolOptionParams, toolOptionSlot } from '@weasel-js/routing';

describe('polygon and star tool options', () => {
  it('usePolygonTool shows the label it is given', () => {
    const { result } = renderHook(() => usePolygonTool({ label: 'Hexagon' }));
    expect(result.current.presentation?.label).toBe('Hexagon');
  });

  it('useStarTool shows the label it is given', () => {
    const { result } = renderHook(() => useStarTool({ label: 'Burst' }));
    expect(result.current.presentation?.label).toBe('Burst');
  });

  it('useStarTool takes its points and inner radius as its options’ defaults, from the latest render', () => {
    const { result, rerender } = renderHook(
      ({ innerRatio }: { innerRatio: number }) => useStarTool({ innerRatio, points: 7 }),
      { initialProps: { innerRatio: 0.5 } },
    );
    rerender({ innerRatio: 0.2 });
    expect(toolOptionParams('star', result.current.options!, undefined)).toMatchObject({ innerRadiusRatio: 0.2, points: 7 });
    const insert = (result.current.bindings ?? []).find((b) => b.actionId === 'insert');
    expect(insert?.opts?.params).toEqual({ kind: 'star' });
  });
});

describe('shape tools’ style options', () => {
  const tools = () => renderHook(() => ({
    rect: useRectTool(), line: useLineTool(), polygon: usePolygonTool(), pen: usePenTool(), text: useTextTool(),
    own: useEllipseTool({ share: { fill: null } }),
  })).result.current;

  it('share one fill, stroke, and stroke width, each tool reading its own default until one is set', () => {
    const t = tools();
    const values = createToolOptionValues();
    expect(toolOptionParams('line', t.line.options!, values).stroke).toEqual(DEFAULT_SHAPE_PAINT);
    expect(toolOptionParams('rect', t.rect.options!, values).stroke).toBeNull();
    setToolOption('rect', t.rect.options!, values, 'fill', { color: '#123456' });
    setToolOption('line', t.line.options!, values, 'strokeWidth', 5);
    for (const id of ['polygon', 'pen'] as const) {
      expect(toolOptionParams(id, t[id].options!, values).fill).toEqual({ color: '#123456' });
    }
    // Text keeps a fill of its own kind, so a white shape fill never sets white text.
    expect(toolOptionSlot('text', t.text.options!, 'fill')).toEqual({ owner: 'shared', key: 'textFill' });
    expect(toolOptionParams('pen', t.pen.options!, values).strokeWidth).toBe(5);
    expect(toolOptionParams('ellipse', t.own.options!, values).fill).toEqual(DEFAULT_SHAPE_PAINT);
  });

  it('keep a polygon’s sides per tool', () => {
    const t = tools();
    expect(t.polygon.options!.share?.sides).toBeUndefined();
    expect(toolOptionSlot('polygon', t.polygon.options!, 'sides')).toEqual({ owner: 'polygon', key: 'sides' });
  });
});

describe('tool option colors', () => {
  it('default in one spelling, so the same color reads as one value across tools', () => {
    const t = renderHook(() => ({
      rect: useRectTool(), line: useLineTool(), polygon: usePolygonTool(), star: useStarTool(), pen: usePenTool(),
      pencil: usePencilTool(), text: useTextTool(), sticky: useStickyTool(), ellipse: useEllipseTool(),
    })).result.current;
    for (const [id, tool] of Object.entries(t)) {
      for (const [key, leaf] of Object.entries(tool.options!.prefs.children)) {
        if ((leaf as { kind?: string }).kind !== 'paint') continue;
        const value = (leaf as { default: Parameters<typeof toolOptionPaint>[0] }).default;
        expect(value, `${id}.${key}`).toEqual(toolOptionPaint(value));
      }
    }
    const black = { color: '#000000' };
    expect(toolOptionParams('text', t.text.options!, undefined).fill).toEqual(black);
    expect(toolOptionParams('sticky', t.sticky.options!, undefined).ink).toEqual(black);
    expect(toolOptionPaint({ kind: 'solid', color: '#000000ff' })).toEqual(black);
    expect(toolOptionPaint({ color: '#11223380', opacity: 0.5 })).toEqual({ color: '#112233', opacity: 0.25098039215686274 });
  });
});
