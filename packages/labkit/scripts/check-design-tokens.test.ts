import { describe, expect, it } from 'vitest';
import { findOffenders } from './check-design-tokens';

describe('findOffenders', () => {
  it('flags a raw font-size', () => {
    const out = findOffenders('a.less', '.x { font-size: 12px; }');
    expect(out).toHaveLength(1);
    expect(out[0].match).toContain('font-size');
  });

  it('accepts a tokenized one', () => {
    expect(findOffenders('a.less', '.x { font-size: var(--wzl-font-size); }')).toEqual([]);
  });

  it('does not mistake a token name ending in a digit for a literal', () => {
    expect(findOffenders('a.less', '.x { font-size: var(--wzl-font-size-2xs); }')).toEqual([]);
  });

  it('accepts a relative keyword size', () => {
    expect(findOffenders('a.less', '.x { font-size: 100%; }')).toEqual([]);
  });

  it('flags a fallback that disagrees with its token', () => {
    const out = findOffenders('a.less', '.x { font-size: var(--wzl-font-size-sm, 12px); }');
    expect(out).toHaveLength(1);
    expect(out[0].match).toMatch(/disagrees/);
  });

  it('accepts a fallback that agrees', () => {
    expect(findOffenders('a.less', '.x { font-size: var(--wzl-font-size-sm, 11px); }')).toEqual([]);
  });

  it('accepts a literal on an allowlisted file', () => {
    expect(findOffenders('theme/base.less', '.x { background: #fff; }')).toEqual([]);
  });

  it('accepts 50% and 0 radii', () => {
    expect(findOffenders('a.less', '.x { border-radius: 50%; }')).toEqual([]);
    expect(findOffenders('a.less', '.x { border-radius: 0; }')).toEqual([]);
  });

  it('accepts a multi-corner radius written from tokens', () => {
    expect(
      findOffenders(
        'a.less',
        '.x { border-radius: var(--wzl-radius-pill) 0 0 var(--wzl-radius-pill); }',
      ),
    ).toEqual([]);
  });

  it('flags a raw font-weight but not a tokenized one', () => {
    expect(findOffenders('a.less', '.x { font-weight: 600; }')).toHaveLength(1);
    expect(findOffenders('a.less', '.x { font-weight: var(--wzl-font-weight-bold); }')).toEqual([]);
    expect(findOffenders('a.less', '.x { font-weight: normal; }')).toEqual([]);
  });

  it('flags a stray danger color and names the token', () => {
    const out = findOffenders('a.less', '.x { color: #ff5b5b; }');
    expect(out).toHaveLength(1);
    expect(out[0].match).toContain('--wzl-danger');
  });

  it('accepts the danger token itself', () => {
    expect(findOffenders('a.less', '.x { color: var(--wzl-danger); }')).toEqual([]);
  });

  it('flags a stray danger color even on an allowlisted file', () => {
    expect(findOffenders('theme/base.less', '.x { color: #ff5b5b; }')).toHaveLength(1);
  });
});
