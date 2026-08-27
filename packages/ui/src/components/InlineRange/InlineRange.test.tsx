import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { InlineRange } from './InlineRange';

const fillOf = (el: HTMLElement): string | null =>
  el.style.getPropertyValue('--slider-fill') || null;

describe('InlineRange', () => {
  it('reports the value as a percentage of its range', () => {
    render(<InlineRange aria-label="Width" min={0} max={20} value={5} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Width'))).toBe('25%');
  });

  it('measures from `min`, not from zero', () => {
    render(<InlineRange aria-label="Width" min={10} max={20} value={15} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Width'))).toBe('50%');
  });

  it('clamps a value outside the range instead of overflowing the track', () => {
    render(<InlineRange aria-label="Over" min={0} max={20} value={50} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Over'))).toBe('100%');
  });

  // A degenerate range divides by zero, which would render `NaN%` and drop the
  // background entirely rather than failing loudly.
  it('survives a zero-width range', () => {
    render(<InlineRange aria-label="Flat" min={5} max={5} value={5} onChange={() => {}} />);
    expect(fillOf(screen.getByLabelText('Flat'))).toBe('0%');
  });

  it('forwards input events to the caller', () => {
    const seen: string[] = [];
    render(
      <InlineRange
        aria-label="Opacity"
        min={0}
        max={100}
        value={40}
        onChange={(e) => seen.push((e.target as HTMLInputElement).value)}
      />,
    );
    fireEvent.change(screen.getByLabelText('Opacity'), { target: { value: '70' } });
    expect(seen).toEqual(['70']);
  });

  it('keeps a caller class alongside its own', () => {
    render(<InlineRange aria-label="W" className="mine" value={1} onChange={() => {}} />);
    expect(screen.getByLabelText('W').className).toContain('mine');
  });
});
