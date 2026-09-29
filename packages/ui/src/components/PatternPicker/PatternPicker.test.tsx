import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, screen } from '@testing-library/react';
import { composePatternTransform, decomposePatternTransform } from '@weasel-js/core';
import { PatternPicker, seedPattern, type PatternFill } from './PatternPicker';

function rotationInput(): HTMLInputElement {
  return screen.getByRole('textbox', { name: 'Rotation' }) as HTMLInputElement;
}

function commit(value: string): void {
  const input = rotationInput();
  fireEvent.change(input, { target: { value } });
  fireEvent.blur(input);
}

describe('PatternPicker rotation', () => {
  it('shows an untransformed pattern at 0°', () => {
    render(<PatternPicker value={seedPattern('hatch', '#123456')} color="#123456" onChange={() => {}} />);
    expect(rotationInput().value).toMatch(/^0/);
  });

  it('shows the rotation a transform carries, in degrees', () => {
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: Math.PI / 4, scaleX: 2 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={() => {}} />);
    expect(rotationInput().value).toMatch(/^45/);
  });

  it('commits a rotation as the paint transform, keeping scale and skew', () => {
    const onChange = vi.fn();
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ scaleX: 2, skewX: 0.2 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    commit('30');
    const next = onChange.mock.calls[0][0] as PatternFill;
    const parts = decomposePatternTransform(next.transform);
    expect(parts.rotation).toBeCloseTo(Math.PI / 6, 9);
    expect(parts.scaleX).toBeCloseTo(2, 9);
    expect(parts.skewX).toBeCloseTo(0.2, 9);
    expect(next.pattern).toBe(value.pattern);
  });

  it('drops the transform when rotation returns to an identity', () => {
    const onChange = vi.fn();
    const value: PatternFill = {
      ...seedPattern('hatch', '#123456'),
      transform: composePatternTransform({ rotation: 1 }),
    };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    commit('0');
    expect(onChange.mock.calls[0][0]).not.toHaveProperty('transform');
  });

  it('keeps the rotation across a tile pick', () => {
    const onChange = vi.fn();
    const transform = composePatternTransform({ rotation: 0.5 });
    const value: PatternFill = { ...seedPattern('hatch', '#123456'), transform };
    render(<PatternPicker value={value} color="#123456" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'dots' }));
    const next = onChange.mock.calls[0][0] as PatternFill;
    expect((next.pattern as { tile: string }).tile).toBe('dots');
    expect(next.transform).toEqual(transform);
  });
});
