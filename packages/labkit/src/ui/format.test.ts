import { describe, expect, it } from 'vitest';
import { formatZoom } from './format';

describe('formatZoom', () => {
  it('shows a percentage up to and including 2x', () => {
    expect(formatZoom(0.5)).toBe('50%');
    expect(formatZoom(1)).toBe('100%');
    expect(formatZoom(1.5)).toBe('150%');
    expect(formatZoom(2)).toBe('200%');
  });

  it('switches to a multiplier above 2x', () => {
    expect(formatZoom(2.5)).toBe('2.5x');
    expect(formatZoom(4)).toBe('4x');
    expect(formatZoom(16)).toBe('16x');
  });

  it('rounds the multiplier to one decimal and drops a trailing zero', () => {
    expect(formatZoom(3.04)).toBe('3x');
    expect(formatZoom(3.06)).toBe('3.1x');
  });

  it('passes non-finite zoom through rather than printing NaN%', () => {
    expect(formatZoom(Number.NaN)).toBe('NaN');
    expect(formatZoom(Number.POSITIVE_INFINITY)).toBe('Infinity');
  });
});
