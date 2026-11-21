import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import Perforated from './Perforated';

function holeCount(holePitch: number) {
  const C = Perforated.Component!;
  const { container } = render(
    <svg viewBox="0 0 100 100"><C variant="solid" focused={false} params={{ holePitch }} phase={0} /></svg>,
  );
  return container.querySelectorAll('ellipse').length;
}

describe('perforated holes', () => {
  // jsdom lays the badge out at useSvgBox's 100 x 100 px default.
  it('space at least a pixel apart at a tiny pitch', () => {
    expect(holeCount(0.05)).toBe(400);
  });

  it('draw at a zero or negative pitch', () => {
    expect(holeCount(0)).toBe(400);
    expect(holeCount(-3)).toBe(400);
  });
});
