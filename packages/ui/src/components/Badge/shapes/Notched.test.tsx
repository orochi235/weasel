import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Notched from './Notched';

function arcRadii(params: { erosion?: number; eccentricity?: number }) {
  const C = Notched.Component!;
  const { container } = render(
    <svg viewBox="0 0 100 100"><C variant="solid" focused={false} params={params} phase={0} /></svg>,
  );
  const d = container.querySelector('path')!.getAttribute('d')!;
  const [, rx, ry] = /A ([\d.]+) ([\d.]+)/.exec(d)!.map(Number);
  return { rx, ry };
}

describe('notched corner arcs', () => {
  it.each([
    [0.6, 2],
    [0.5, 0.3],
    [1, 5],
    [1, 0.2],
  ])('stay within half the badge at erosion %f, eccentricity %f', (erosion, eccentricity) => {
    const { rx, ry } = arcRadii({ erosion, eccentricity });
    expect(rx).toBeLessThan(50);
    expect(ry).toBeLessThan(50);
    expect(rx / ry).toBeCloseTo(eccentricity * eccentricity, 6);
  });

  it('keeps the default radius at eccentricity 1', () => {
    expect(arcRadii({ erosion: 0.5, eccentricity: 1 })).toEqual({ rx: 24.5, ry: 24.5 });
  });
});
