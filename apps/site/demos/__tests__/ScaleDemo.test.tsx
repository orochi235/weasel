import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ScaleDemo } from '../ScaleDemo';

const position = (name: string) => Number(screen.getByLabelText(`${name} position`).textContent);

describe('ScaleDemo', () => {
  it('places one value on a linear and a log axis over the same domain', () => {
    render(<ScaleDemo />);
    expect(position('linearScale')).toBeCloseTo(74.7, 1);
    expect(position('logScale')).toBeCloseTo(365.3, 1);
    expect(screen.getByRole('img', { name: 'logScale axis' }).querySelectorAll('text').length).toBeGreaterThan(1);
  });

  it('moves both markers when the slider moves', () => {
    render(<ScaleDemo />);
    const before = [position('linearScale'), position('logScale')];
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowRight', shiftKey: true });
    expect(position('linearScale')).toBeGreaterThan(before[0]!);
    expect(position('logScale')).toBeGreaterThan(before[1]!);
  });
});
