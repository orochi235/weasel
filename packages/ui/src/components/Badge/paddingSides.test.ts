import { describe, expect, it } from 'vitest';
import { paddingStyle } from './paddingSides';

const sides = (padding: number | string) => {
  const style = paddingStyle(padding) as Record<string, string>;
  return ['top', 'right', 'bottom', 'left'].map((side) => style[`--badge-pad-${side}`]);
};

describe('paddingStyle', () => {
  it('sets nothing without a padding', () => {
    expect(paddingStyle(undefined)).toEqual({});
  });

  it('expands a shorthand the way CSS does', () => {
    expect(sides(4)).toEqual(['4px', '4px', '4px', '4px']);
    expect(sides('1px 2px')).toEqual(['1px', '2px', '1px', '2px']);
    expect(sides('1px 2px 3px')).toEqual(['1px', '2px', '3px', '2px']);
    expect(sides('1px 2px 3px 4px')).toEqual(['1px', '2px', '3px', '4px']);
  });

  it('keeps a function with spaces in it as one side', () => {
    expect(sides('calc(1px + 2px) var(--x, 3px)')).toEqual(['calc(1px + 2px)', 'var(--x, 3px)', 'calc(1px + 2px)', 'var(--x, 3px)']);
  });

  it('passes on what is not a shorthand of one to four parts', () => {
    expect(paddingStyle('1px 2px 3px 4px 5px')).toEqual({ padding: '1px 2px 3px 4px 5px' });
    expect(paddingStyle('')).toEqual({ padding: '' });
  });
});
