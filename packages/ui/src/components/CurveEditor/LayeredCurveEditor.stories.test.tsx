import { Profiler, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
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

  it('drags the seam anchors in y, and leaves the seam where it is', () => {
    render(RimContour.render!({ initialB: 0.4, width: 600 }, {} as never));
    const svg = document.querySelector('svg')!;
    // The plot is 600 × 360 over [0, 1] both ways: the seam's anchors sit at x 0.4, y 0.78.
    fireEvent.pointerDown(svg, { clientX: 240, clientY: 79.2, button: 0, pointerId: 1 });
    fireEvent.pointerMove(document, { clientX: 240, clientY: 180, pointerId: 1, buttons: 1 });
    fireEvent.pointerUp(document, { clientX: 240, clientY: 180, pointerId: 1 });
    expect(seam('bevel', 'last')).toBe('at 0.4, 0.5');
  });
});
