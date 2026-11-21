import { describe, expect, it } from 'vitest';
import { inferTokenType, refitScale, tokenCategory, type TokenScale } from './tokenTypes';

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
    for (const unit of ['dvw', 'svw', 'lvw', 'dvh', 'vi', 'vb', 'dvmin', 'cqi', 'cqb', 'cqmin', 'cqmax', 'cap', 'rch']) {
      expect(inferTokenType(`50${unit}`)).toBe('dimension');
    }
    expect(inferTokenType('150ms')).toBe('duration');
    expect(inferTokenType('0.2s')).toBe('duration');
    expect(inferTokenType('200MS')).toBe('duration');
    expect(inferTokenType('0.2S')).toBe('duration');
    expect(inferTokenType('cubic-bezier(0.33, 1, 0.68, 1)')).toBe('cubicBezier');
    expect(inferTokenType('1.4')).toBe('number');
    expect(inferTokenType('0 1px 3px rgba(0, 0, 0, 0.3)')).toBe('shadow');
    expect(inferTokenType('inset 0 1px 2px red')).toBe('shadow');
    expect(inferTokenType('0 1px 2px red inset')).toBe('shadow');
    expect(inferTokenType('0 1px 2px red INSET, 0 0 1px blue')).toBe('shadow');
    expect(inferTokenType('0 2px 4px color-mix(in srgb, rgb(0 0 0) 20%, transparent)')).toBe('shadow');
    expect(inferTokenType('0 1px 2px rgb(from rgb(0 0 0) r g b / 50%), inset 0 0 1px red')).toBe('shadow');
    expect(inferTokenType('linear-gradient(red, blue)')).toBe('gradient');
  });

  it('calls anything it cannot place a string', () => {
    expect(inferTokenType('auto')).toBe('string');
    expect(inferTokenType('calc(100% - 4px)')).toBe('string');
    expect(inferTokenType('')).toBe('string');
  });
});

describe('refitScale', () => {
  const scale: TokenScale = { tokens: ['--a', '--b', '--c'], base: 2, rule: { kind: 'step', step: 1 } };

  it('fits a ratio of 1 when the steps do not grow by any positive ratio', () => {
    expect(refitScale(scale, 'ratio', [2, 3, -4]).rule).toEqual({ kind: 'ratio', ratio: 1 });
    expect(refitScale(scale, 'ratio', [2, 3, 0]).rule).toEqual({ kind: 'ratio', ratio: 1 });
  });

  it('fits a ratio and factors that regenerate the steps they were fitted to', () => {
    const amounts = [16, 21.33, 28.43, 37.9, 50.52];
    const steps = { ...scale, tokens: ['--a', '--b', '--c', '--d', '--e'], base: 16 };
    const ratio = refitScale(steps, 'ratio', amounts).rule;
    expect(ratio.kind === 'ratio' && Math.abs(16 * ratio.ratio ** 4 - 50.52)).toBeLessThan(0.05);
    const factors = refitScale(steps, 'factors', amounts).rule;
    const regenerated = factors.kind === 'factors' ? factors.factors.map((f) => 16 * f) : [];
    expect(regenerated).toHaveLength(5);
    regenerated.forEach((amount, i) => expect(Math.abs(amount - amounts[i]!)).toBeLessThan(0.005));
  });

  it('fits factors from the first positive step when the base is not positive', () => {
    const fours = { ...scale, tokens: ['--a', '--b', '--c', '--d'], base: 0, rule: { kind: 'step' as const, step: 4 } };
    expect(refitScale(fours, 'factors', [0, 4, 8, 12])).toEqual({ ...fours, base: 4, rule: { kind: 'factors', factors: [0, 1, 2, 3] } });
    expect(refitScale({ ...fours, base: -2 }, 'factors', [-1, 0, 0, 0])).toEqual({ ...fours, base: -2, rule: { kind: 'factors', factors: [1, 1, 1, 1] } });
  });
});
