import { describe, it, expect } from 'vitest';
import { styleAtRange, applyStyleToRange, MIXED_STYLE } from './rangeStyle';
import type { StyledRun } from '../runs';

const runs: StyledRun[] = [
  { text: 'Hello ' },
  { text: 'brave', bold: true },
  { text: ' world' },
];

describe('styleAtRange', () => {
  it('reports a concrete value when the whole range agrees', () => {
    expect(styleAtRange(runs, 6, 11).bold).toBe(true);
  });

  it('reports MIXED_STYLE when the range straddles a boundary', () => {
    expect(styleAtRange(runs, 0, 11).bold).toBe(MIXED_STYLE);
  });

  it('treats an absent flag as false, not undefined', () => {
    expect(styleAtRange(runs, 0, 5).bold).toBe(false);
  });

  it('returns an empty style for a collapsed range', () => {
    expect(styleAtRange(runs, 3, 3)).toEqual({});
  });

  it('returns an empty style for an inverted range', () => {
    expect(styleAtRange(runs, 9, 2)).toEqual({});
  });

  it('returns an empty style for empty runs', () => {
    expect(styleAtRange([], 0, 10)).toEqual({});
  });

  it('omits a non-boolean key no run in range sets', () => {
    const style = styleAtRange(runs, 0, 5);
    expect('fontSize' in style).toBe(false);
    expect(style.fontSize).toBeUndefined();
  });

  it('reports MIXED_STYLE when one run sets a value and another leaves it inherited', () => {
    const mixed: StyledRun[] = [{ text: 'ab', fontSize: 24 }, { text: 'cd' }];
    expect(styleAtRange(mixed, 0, 4).fontSize).toBe(MIXED_STYLE);
  });

  it('reads a range that covers exactly one whole run', () => {
    expect(styleAtRange(runs, 6, 11)).toEqual({
      bold: true,
      italic: false,
      underline: false,
      strikethrough: false,
    });
  });

  it('clamps a range that overruns the text length', () => {
    expect(styleAtRange(runs, 6, 999).bold).toBe(MIXED_STYLE);
    expect(styleAtRange(runs, 11, 999).bold).toBe(false);
  });

  it('clamps a negative start', () => {
    expect(styleAtRange(runs, -5, 5).bold).toBe(false);
  });

  it('treats a non-numeric offset as an empty range', () => {
    expect(styleAtRange(runs, Number.NaN, 5)).toEqual({});
  });

  it('ignores zero-length runs', () => {
    const withEmpty: StyledRun[] = [
      { text: 'ab' },
      { text: '', bold: true },
      { text: 'cd' },
    ];
    expect(styleAtRange(withEmpty, 0, 4).bold).toBe(false);
  });

  it('compares fill structurally, not by reference', () => {
    const same: StyledRun[] = [
      { text: 'ab', fill: { color: '#f00' } },
      { text: 'cd', fill: { color: '#f00' } },
    ];
    expect(same[0].fill).not.toBe(same[1].fill);
    expect(styleAtRange(same, 0, 4).fill).toEqual({ color: '#f00' });

    const differing: StyledRun[] = [
      { text: 'ab', fill: { color: '#f00' } },
      { text: 'cd', fill: { color: '#0f0' } },
    ];
    expect(styleAtRange(differing, 0, 4).fill).toBe(MIXED_STYLE);
  });

  it('reports the newer flags alongside bold/italic', () => {
    const decorated: StyledRun[] = [
      { text: 'ab', underline: true, letterSpacing: 2 },
      { text: 'cd', underline: true, letterSpacing: 2 },
    ];
    const style = styleAtRange(decorated, 0, 4);
    expect(style.underline).toBe(true);
    expect(style.strikethrough).toBe(false);
    expect(style.letterSpacing).toBe(2);
  });
});

describe('applyStyleToRange', () => {
  it('splits runs at the range boundaries', () => {
    const out = applyStyleToRange(runs, 0, 5, { underline: true });
    expect(out.map((r) => r.text)).toEqual(['Hello', ' ', 'brave', ' world']);
    expect(out[0].underline).toBe(true);
    expect(out[1].underline).toBeUndefined();
  });

  it('coalesces adjacent runs that end up identical', () => {
    const out = applyStyleToRange([{ text: 'ab' }, { text: 'cd', bold: true }], 2, 4, { bold: false });
    expect(out).toEqual([{ text: 'abcd' }]);
  });

  it('round-trips: what it sets is what styleAtRange reads back', () => {
    const out = applyStyleToRange(runs, 2, 9, { fontSize: 24 });
    expect(styleAtRange(out, 2, 9).fontSize).toBe(24);
  });

  it('is a no-op for a collapsed range', () => {
    expect(applyStyleToRange(runs, 4, 4, { bold: true })).toEqual(runs);
  });

  it('is a no-op for an inverted range', () => {
    expect(applyStyleToRange(runs, 9, 2, { bold: true })).toEqual(runs);
  });

  it('clamps a range that overruns the text length', () => {
    const out = applyStyleToRange(runs, 6, 999, { italic: true });
    expect(out.at(-1)?.italic).toBe(true);
  });

  it('treats a non-numeric offset as an empty range', () => {
    expect(applyStyleToRange(runs, 0, Number.NaN, { bold: true })).toEqual(runs);
  });

  it('clamps a negative start', () => {
    const out = applyStyleToRange(runs, -5, 5, { underline: true });
    expect(out[0]).toEqual({ text: 'Hello', underline: true });
  });

  it('does not mutate the input runs', () => {
    const input: StyledRun[] = [{ text: 'ab' }, { text: 'cd', bold: true }];
    const snapshot = structuredClone(input);
    applyStyleToRange(input, 0, 4, { italic: true });
    expect(input).toEqual(snapshot);
  });

  it('deletes a key set to false rather than storing it', () => {
    const out = applyStyleToRange([{ text: 'ab', bold: true }], 0, 2, { bold: false });
    expect(out).toEqual([{ text: 'ab' }]);
    expect('bold' in out[0]).toBe(false);
  });

  it('deletes a key set to undefined', () => {
    const out = applyStyleToRange([{ text: 'ab', fontSize: 24 }], 0, 2, { fontSize: undefined });
    expect(out).toEqual([{ text: 'ab' }]);
    expect('fontSize' in out[0]).toBe(false);
  });

  it('stores a numeric zero rather than treating it as a deletion', () => {
    const out = applyStyleToRange([{ text: 'ab' }], 0, 2, { letterSpacing: 0 });
    expect(out).toEqual([{ text: 'ab', letterSpacing: 0 }]);
  });

  it('leaves the runs structurally unchanged when the patch matches what is there', () => {
    const out = applyStyleToRange(runs, 6, 11, { bold: true });
    expect(out).toEqual(runs);
  });

  it('applies to a range covering exactly one whole run without splitting it', () => {
    const out = applyStyleToRange(runs, 6, 11, { fontSize: 18 });
    expect(out.map((r) => r.text)).toEqual(['Hello ', 'brave', ' world']);
    expect(out[1]).toEqual({ text: 'brave', bold: true, fontSize: 18 });
  });

  it('ignores a `text` key in the patch', () => {
    const patch = { text: 'nope', bold: true } as Partial<StyledRun>;
    const out = applyStyleToRange(runs, 0, 6, patch);
    expect(out.map((r) => r.text).join('')).toBe('Hello brave world');
  });

  it('applies an untouched key to nothing and only coalesces', () => {
    const out = applyStyleToRange([{ text: 'ab' }, { text: 'cd' }], 0, 4, {});
    expect(out).toEqual([{ text: 'abcd' }]);
  });

  it('drops zero-length runs from the output', () => {
    const withEmpty: StyledRun[] = [{ text: 'ab' }, { text: '' }, { text: 'cd', bold: true }];
    const out = applyStyleToRange(withEmpty, 0, 2, { italic: true });
    expect(out).toEqual([
      { text: 'ab', italic: true },
      { text: 'cd', bold: true },
    ]);
  });

  it('coalesces neighbors whose fill is equal but not identical', () => {
    const out = applyStyleToRange(
      [
        { text: 'ab', fill: { color: '#f00' } },
        { text: 'cd', fill: { color: '#f00' }, bold: true },
      ],
      2,
      4,
      { bold: false },
    );
    expect(out).toEqual([{ text: 'abcd', fill: { color: '#f00' } }]);
  });

  it('does not coalesce neighbors whose fill differs', () => {
    const out = applyStyleToRange(
      [
        { text: 'ab', fill: { color: '#f00' } },
        { text: 'cd', fill: { color: '#0f0' } },
      ],
      0,
      4,
      { bold: true },
    );
    expect(out).toHaveLength(2);
  });

  it('coalesces gradient fills structurally', () => {
    const grad = (): StyledRun['fill'] => ({
      fill: 'linear-gradient',
      from: { x: 0, y: 0 },
      to: { x: 1, y: 1 },
      stops: [
        { offset: 0, color: '#000' },
        { offset: 1, color: '#fff' },
      ],
    });
    const out = applyStyleToRange(
      [{ text: 'ab', fill: grad() }, { text: 'cd', fill: grad(), bold: true }],
      2,
      4,
      { bold: false },
    );
    expect(out).toHaveLength(1);
    expect(out[0].text).toBe('abcd');
  });

  it('splits a single run into three pieces for an interior range', () => {
    const out = applyStyleToRange([{ text: 'abcdef' }], 2, 4, { bold: true });
    expect(out).toEqual([
      { text: 'ab' },
      { text: 'cd', bold: true },
      { text: 'ef' },
    ]);
  });
});
