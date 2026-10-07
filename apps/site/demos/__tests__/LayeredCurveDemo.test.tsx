import { Profiler } from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { LayeredCurveDemo } from '../LayeredCurveDemo';

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
    fireEvent.change(screen.getByRole('slider'), { target: { value: '0.4' } });
    expect(commits).toBe(2);
    expect(anchors(container, 'bevel').at(-1)).toBe('Point 3 at 0.4, 0.78');
    expect(anchors(container, 'spline')[0]).toBe('Point 1 at 0.4, 0.78');
  });
});
