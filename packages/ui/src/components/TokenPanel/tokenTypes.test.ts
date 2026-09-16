import { describe, expect, it } from 'vitest';
import { inferTokenType, tokenCategory } from './tokenTypes';

describe('tokenCategory', () => {
  it('files each DTCG type under its section', () => {
    const at = (type: string, group = 'x') => tokenCategory({ name: '--x', type, group, value: '' });
    expect(at('color')).toBe('color');
    expect(at('fontFamily')).toBe('type');
    expect(at('fontWeight')).toBe('type');
    expect(at('duration')).toBe('motion');
    expect(at('cubicBezier')).toBe('motion');
    expect(at('shadow')).toBe('depth');
    expect(at('gradient')).toBe('depth');
    expect(at('dimension', 'space')).toBe('size');
    expect(at('string')).toBe('other');
  });

  it('puts type-scale dimensions and numbers under Type, and a z scale under Depth', () => {
    const at = (type: string, group: string) => tokenCategory({ name: '--x', type, group, value: '' });
    expect(at('dimension', 'font')).toBe('type');
    expect(at('dimension', 'tracking')).toBe('type');
    expect(at('number', 'leading')).toBe('type');
    expect(at('number', 'z')).toBe('depth');
  });
});

describe('inferTokenType', () => {
  it('reads a type from the shape of a value', () => {
    expect(inferTokenType('#fff')).toBe('color');
    expect(inferTokenType('rgba(14, 15, 18, 0.1)')).toBe('color');
    expect(inferTokenType('oklch(0.7 0.1 250)')).toBe('color');
    expect(inferTokenType('12px')).toBe('dimension');
    expect(inferTokenType('-0.5rem')).toBe('dimension');
    expect(inferTokenType('150ms')).toBe('duration');
    expect(inferTokenType('0.2s')).toBe('duration');
    expect(inferTokenType('cubic-bezier(0.33, 1, 0.68, 1)')).toBe('cubicBezier');
    expect(inferTokenType('1.4')).toBe('number');
    expect(inferTokenType('0 1px 3px rgba(0, 0, 0, 0.3)')).toBe('shadow');
    expect(inferTokenType('linear-gradient(red, blue)')).toBe('gradient');
  });

  it('calls anything it cannot place a string', () => {
    expect(inferTokenType('auto')).toBe('string');
    expect(inferTokenType('calc(100% - 4px)')).toBe('string');
    expect(inferTokenType('')).toBe('string');
  });
});
