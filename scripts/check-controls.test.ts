import { describe, expect, it } from 'vitest';
import { offenders, ranks } from './check-controls';

const RANKS = ranks(`
:root {
  --wzl-control-h-xs: 18px;
  --wzl-control-h-sm: 20px;
  --wzl-control-h: 24px;
  --wzl-tb-height: 28px;
}
`);

const file = (source: string) => [{ path: 'x.css', source }];

describe('ranks', () => {
  it('reads the control ranks at the default density', () => {
    expect([...RANKS]).toEqual([
      [18, 'control-h-xs'],
      [20, 'control-h-sm'],
      [24, 'control-h'],
      [28, 'tb-height'],
    ]);
  });

  it('gives a shared value to the narrowest rank, so the suggestion is the tighter one', () => {
    const shared = ranks(':root {\n  --wzl-control-h-sm: 24px;\n  --wzl-control-h: 24px;\n}');
    expect(shared.get(24)).toBe('control-h-sm');
  });
});

describe('offenders', () => {
  it('catches a height frozen at a rank', () => {
    expect(offenders(file('.a { height: 24px; }'), RANKS)).toMatchObject([{ line: 1, token: 'control-h' }]);
  });

  it('catches min-height and block-size too', () => {
    expect(offenders(file('.a { min-height: 20px; }'), RANKS)).toHaveLength(1);
    expect(offenders(file('.a { block-size: 18px; }'), RANKS)).toHaveLength(1);
  });

  // An off-ladder value is a question about which rung it belongs on, not a substitution.
  it('passes an off-ladder height', () => {
    expect(offenders(file('.a { height: 22px; }'), RANKS)).toEqual([]);
    expect(offenders(file('.a { height: 26px; }'), RANKS)).toEqual([]);
  });

  // A width matching a rank is usually a square icon well, not a control height.
  it('passes width', () => {
    expect(offenders(file('.a { width: 24px; }'), RANKS)).toEqual([]);
  });

  it('passes a length inside a var() fallback, which belongs to that property', () => {
    expect(offenders(file('.a { height: var(--tb-h, 24px); }'), RANKS)).toEqual([]);
  });

  it('passes a height already on a rank', () => {
    expect(offenders(file('.a { height: var(--wzl-control-h); }'), RANKS)).toEqual([]);
  });

  it('passes a negative or fractional length', () => {
    expect(offenders(file('.a { height: 24.5px; }'), RANKS)).toEqual([]);
  });

  it('passes a box marked not-a-control, on the declaration or the line above', () => {
    expect(offenders(file('.a { height: 24px; /* not-a-control */ }'), RANKS)).toEqual([]);
    expect(offenders(file('.a {\n  /* not-a-control */\n  height: 24px;\n}'), RANKS)).toEqual([]);
  });

  it('still catches a box two lines below the marker, so the marker cannot leak', () => {
    expect(offenders(file('.a {\n  /* not-a-control */\n  width: 1px;\n  height: 24px;\n}'), RANKS)).toHaveLength(1);
  });
});
