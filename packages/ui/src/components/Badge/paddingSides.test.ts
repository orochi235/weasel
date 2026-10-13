import { describe, expect, it } from 'vitest';
import { liftPadding, paddingStyle } from './paddingSides';

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

describe('liftPadding', () => {
  it('leaves a style with no padding as it is', () => {
    expect(liftPadding(undefined)).toEqual({});
    expect(liftPadding({ marginLeft: 4 })).toEqual({ marginLeft: 4 });
  });

  it('moves a padding shorthand onto the per-side properties', () => {
    expect(liftPadding({ padding: '1px 2px', color: 'red' })).toEqual({
      color: 'red',
      '--badge-pad-top': '1px', '--badge-pad-right': '2px', '--badge-pad-bottom': '1px', '--badge-pad-left': '2px',
    });
  });

  it('moves one side, as a number or a length, and leaves the others unset', () => {
    expect(liftPadding({ paddingLeft: 12, paddingTop: '0.5em' })).toEqual({ '--badge-pad-left': '12px', '--badge-pad-top': '0.5em' });
  });

  it('lets a side override the shorthand beside it', () => {
    expect(liftPadding({ padding: 4, paddingRight: 9 })).toMatchObject({ '--badge-pad-left': '4px', '--badge-pad-right': '9px' });
  });

  it('moves the block pair, and an inline pair only when both sides are alike', () => {
    expect(liftPadding({ paddingBlock: '1px 2px', paddingInline: 3 })).toEqual({
      '--badge-pad-top': '1px', '--badge-pad-bottom': '2px', '--badge-pad-left': '3px', '--badge-pad-right': '3px',
    });
    expect(liftPadding({ paddingInline: '1px 2px' })).toEqual({ paddingInline: '1px 2px' });
  });

  it('passes on a padding that is not a shorthand of one to four parts', () => {
    expect(liftPadding({ padding: '' })).toEqual({ padding: '' });
  });
});
