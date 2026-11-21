import { afterEach, describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import Shield from './Shield';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

function shieldPath(width: number, height: number, params: Record<string, number>) {
  vi.stubGlobal('ResizeObserver', class { observe() {} disconnect() {} });
  vi.spyOn(SVGElement.prototype, 'getBoundingClientRect').mockReturnValue(DOMRect.fromRect({ width, height }));
  const C = Shield.Component!;
  const { container } = render(
    <svg viewBox="0 0 100 100"><C variant="solid" focused={false} params={params} phase={0} /></svg>,
  );
  return container.querySelector('path')!.getAttribute('d')!;
}

describe('shield top corners', () => {
  it('end at or above the shoulder on a short shield', () => {
    const d = shieldPath(80, 38, { erosion: 1, shoulderY: 20 });
    const arcEndY = Number(/A [\d.]+ [\d.]+ 0 0 1 100 ([\d.]+)/.exec(d)![1]);
    expect(arcEndY).toBeLessThanOrEqual(20);
  });

  it('meet at most in the middle of a narrow shield', () => {
    const d = shieldPath(16, 60, { erosion: 1 });
    const [, start, end] = /M ([\d.]+) 0 L ([\d.]+) 0/.exec(d)!.map(Number);
    expect(start).toBeLessThanOrEqual(end);
  });
});
