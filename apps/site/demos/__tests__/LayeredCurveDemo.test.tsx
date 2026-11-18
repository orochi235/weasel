import { Profiler } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayeredCurveDemo, createPartitionLayer } from '../LayeredCurveDemo';

const anchors = (container: HTMLElement, layer: string) =>
  [...container.querySelectorAll(`[data-layer-id="${layer}"] [aria-label]`)].map((el) => el.getAttribute('aria-label'));

describe('LayeredCurveDemo', () => {
  it('re-anchors both curves to the seam when the slider moves it, in one commit', () => {
    let commits = 0;
    const { container } = render(
      <Profiler id="demo" onRender={() => { commits++; }}>
        <LayeredCurveDemo />
      </Profiler>,
    );
    expect(commits).toBe(1);
    fireEvent.change(screen.getByRole('slider', { name: 'bevel width (b):' }), { target: { value: '0.4' } });
    expect(commits).toBe(2);
    expect(anchors(container, 'bevel').at(-1)).toBe('Point 3 at 0.4, 0.78');
    expect(anchors(container, 'spline')[0]).toBe('Point 1 at 0.4, 0.78');
  });

  it('gives the curves their points back when the seam returns', () => {
    const { container } = render(<LayeredCurveDemo />);
    const before = [anchors(container, 'bevel'), anchors(container, 'spline')];
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.05' } });
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.25' } });
    expect([anchors(container, 'bevel'), anchors(container, 'spline')]).toEqual(before);
  });
});

describe('the partition handle', () => {
  const layer = createPartitionLayer();
  const ctx = { toPlot: (p: { x: number }) => ({ x: p.x * 640, y: 0 }), plotSize: { width: 640, height: 380 } } as never;
  const hit = (x: number, y: number) => layer.hitTest!({ x: 0.25 }, { x, y }, ctx);

  it('claims a press on the handle it draws', () => {
    expect(hit(160, 190)).toEqual({ kind: 'handle' });
  });

  it('leaves the seam anchors above and below it to their curves', () => {
    expect(hit(160, 80)).toBeNull();
    expect(hit(160, 330)).toBeNull();
  });
});
