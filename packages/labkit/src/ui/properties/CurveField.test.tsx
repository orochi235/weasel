import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

// CurveEditor uses weasel's own bundled React and fails in jsdom.
// Mock it out — these tests only assert on readouts and the flip button.
vi.mock('../../passthrough/weasel-ui', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../passthrough/weasel-ui')>();
  return { ...real, CurveEditor: () => null };
});

import { CurveField } from './CurveField';

describe('CurveField', () => {
  it('flip button mirrors x → 1-x and resorts', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, -1, 0.3, 0.4, 1, 0.7]}
        min={-1}
        max={1}
        step={0.02}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip horizontally/i }).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    // After flip: (0,-1) → (1,-1), (0.3,0.4) → (0.7,0.4), (1,0.7) → (0,0.7).
    // Sort by x ascending: (0,0.7), (0.7,0.4), (1,-1).
    expect(onChange.mock.calls[0][0]).toEqual([0, 0.7, 0.7, 0.4, 1, -1]);
  });

  it('flip vertically mirrors y through (min+max)/2 and keeps x order', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, -1, 0.3, 0.4, 1, 0.7]}
        min={-1}
        max={1}
        step={0.02}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip vertically/i }).click();
    expect(onChange).toHaveBeenCalledTimes(1);
    // (min+max)/2 = 0. -1 → 1, 0.4 → -0.4, 0.7 → -0.7. x order preserved.
    expect(onChange.mock.calls[0][0]).toEqual([0, 1, 0.3, -0.4, 1, -0.7]);
  });

  it('flip vertically with [0,1] range mirrors through 0.5', () => {
    const onChange = vi.fn();
    render(
      <CurveField
        values={[0, 0, 0.5, 0.25, 1, 1]}
        min={0}
        max={1}
        step={0.01}
        width={200}
        height={110}
        onChange={onChange}
      />,
    );
    screen.getByRole('button', { name: /flip vertically/i }).click();
    expect(onChange.mock.calls[0][0]).toEqual([0, 1, 0.5, 0.75, 1, 0]);
  });
});
