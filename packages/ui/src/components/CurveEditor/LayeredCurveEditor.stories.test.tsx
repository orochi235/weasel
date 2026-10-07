import { Profiler, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { RimContour } from './LayeredCurveEditor.stories';

const seam = (layer: string, at: 'first' | 'last'): string | null => {
  const labels = [...document.querySelectorAll(`[data-layer-id="${layer}"] [aria-label]`)];
  const el = at === 'first' ? labels[0] : labels.at(-1);
  return el?.getAttribute('aria-label')?.replace(/^Point \d+ /, '') ?? null;
};

describe('RimContour story', () => {
  it('commits both curves anchored to initialB, on mount and when the arg changes', () => {
    const seen: (string | null)[][] = [];
    const story = (initialB: number): ReactNode => (
      <Profiler id="rim" onRender={() => { seen.push([seam('bevel', 'last'), seam('spline', 'first')]); }}>
        {RimContour.render!({ initialB, width: 600 }, {} as never)}
      </Profiler>
    );
    const { rerender } = render(story(0.4));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(([bevel, spline]) => bevel === 'at 0.4, 0.78' && spline === 'at 0.4, 0.78')).toBe(true);
    seen.length = 0;
    rerender(story(0.5));
    expect(seen.length).toBeGreaterThan(0);
    expect(seen.every(([bevel, spline]) => bevel === 'at 0.5, 0.78' && spline === 'at 0.5, 0.78')).toBe(true);
  });
});
