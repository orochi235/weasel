import { describe, it, expect } from 'vitest';
import { setFlagOverRange, nodeHasFlag } from './flagRange';
import { styleAtRange } from './rangeStyle';
import type { StyledRun } from '../runs';
import type { TextStyle } from '../textStyle';

const plain: StyledRun[] = [{ text: 'one two three' }];
/** `[0, 4)` is 'one ', `[4, 7)` is 'two', `[7, 13)` is ' three'. */
const TWO: [number, number] = [4, 7];

/** What the reader sees at `offset`, resolving run over node. */
function effective(runs: StyledRun[], style: TextStyle, key: 'underline' | 'strikethrough', offset: number): boolean {
  let pos = 0;
  for (const r of runs) {
    if (offset < pos + r.text.length) return (r[key] ?? false) || (style[key] ?? false);
    pos += r.text.length;
  }
  return false;
}

describe('nodeHasFlag', () => {
  it('reads bold off fontWeight and italic off fontStyle', () => {
    expect(nodeHasFlag({ fontWeight: 700 }, 'bold')).toBe(true);
    expect(nodeHasFlag({ fontWeight: 'bold' }, 'bold')).toBe(true);
    expect(nodeHasFlag({ fontWeight: 400 }, 'bold')).toBe(false);
    expect(nodeHasFlag({}, 'bold')).toBe(false);
    expect(nodeHasFlag({ fontStyle: 'italic' }, 'italic')).toBe(true);
    expect(nodeHasFlag({ fontStyle: 'normal' }, 'italic')).toBe(false);
  });

  it('reads the decorations off their own booleans', () => {
    expect(nodeHasFlag({ underline: true }, 'underline')).toBe(true);
    expect(nodeHasFlag({ underline: false }, 'underline')).toBe(false);
    expect(nodeHasFlag({}, 'strikethrough')).toBe(false);
  });
});

describe('setFlagOverRange — the additive paths are unchanged', () => {
  it('turning a flag on writes the run and leaves the style alone', () => {
    const style: TextStyle = {};
    const r = setFlagOverRange(plain, style, ...TWO, 'underline', true);
    expect(r.applied).toBe(true);
    expect(r.style).toBe(style);
    expect(styleAtRange(r.runs, ...TWO).underline).toBe(true);
    expect(styleAtRange(r.runs, 0, 4).underline).toBe(false);
  });

  it('turning it off in a node that never set it just deletes the key', () => {
    const on = setFlagOverRange(plain, {}, ...TWO, 'underline', true).runs;
    const r = setFlagOverRange(on, {}, ...TWO, 'underline', false);
    expect(r.applied).toBe(true);
    expect(r.runs).toEqual([{ text: 'one two three' }]);
  });
});

describe('setFlagOverRange — un-setting a flag the node sets', () => {
  it('clears the node flag and raises it on the complement', () => {
    const style: TextStyle = { underline: true };
    const r = setFlagOverRange(plain, style, ...TWO, 'underline', false);

    expect(r.applied).toBe(true);
    expect(r.style.underline).toBeUndefined();
    expect(r.runs.map((x) => x.text)).toEqual(['one ', 'two', ' three']);
    expect(r.runs[0].underline).toBe(true);
    expect(r.runs[1].underline).toBeUndefined();
    expect(r.runs[2].underline).toBe(true);
  });

  it('leaves the rendered result identical outside the range', () => {
    const style: TextStyle = { underline: true };
    const before = [0, 3, 4, 6, 7, 12].map((i) => effective(plain, style, 'underline', i));
    expect(before).toEqual([true, true, true, true, true, true]);

    const r = setFlagOverRange(plain, style, ...TWO, 'underline', false);
    const after = [0, 3, 4, 6, 7, 12].map((i) => effective(r.runs, r.style, 'underline', i));
    expect(after).toEqual([true, true, false, false, true, true]);
  });

  it('handles a range at the start, where one complement span is empty', () => {
    const r = setFlagOverRange(plain, { underline: true }, 0, 4, 'underline', false);
    expect(r.runs.map((x) => x.text)).toEqual(['one ', 'two three']);
    expect(r.runs[0].underline).toBeUndefined();
    expect(r.runs[1].underline).toBe(true);
  });

  it('handles a range at the end', () => {
    const r = setFlagOverRange(plain, { underline: true }, 7, 13, 'underline', false);
    expect(r.runs.map((x) => x.text)).toEqual(['one two', ' three']);
    expect(r.runs[0].underline).toBe(true);
    expect(r.runs[1].underline).toBeUndefined();
  });

  it('un-setting the whole range clears the flag outright, with no runs left over', () => {
    const r = setFlagOverRange(plain, { underline: true }, 0, 13, 'underline', false);
    expect(r.style.underline).toBeUndefined();
    expect(r.runs).toEqual([{ text: 'one two three' }]);
  });

  it('does the same for strikethrough', () => {
    const r = setFlagOverRange(plain, { strikethrough: true }, ...TWO, 'strikethrough', false);
    expect(r.style.strikethrough).toBeUndefined();
    expect(r.runs[1].strikethrough).toBeUndefined();
    expect(r.runs[0].strikethrough).toBe(true);
  });

  it('drops italic to normal at the node and raises it on the complement', () => {
    const r = setFlagOverRange(plain, { fontStyle: 'italic' }, ...TWO, 'italic', false);
    expect(r.applied).toBe(true);
    expect(r.style.fontStyle).toBe('normal');
    expect(r.runs[0].italic).toBe(true);
    expect(r.runs[1].italic).toBeUndefined();
  });

  it('drops a 700 node weight to 400 and raises bold on the complement', () => {
    const r = setFlagOverRange(plain, { fontWeight: 700 }, ...TWO, 'bold', false);
    expect(r.applied).toBe(true);
    expect(r.style.fontWeight).toBe(400);
    expect(r.runs[0].bold).toBe(true);
    expect(r.runs[1].bold).toBeUndefined();
  });

  it("refuses a node weight `run.bold` can't reproduce, rather than downgrading it", () => {
    // `run.bold` resolves to exactly 700 everywhere, so pushing a 900 node
    // weight onto its runs would silently lighten the text that was NOT edited.
    const style: TextStyle = { fontWeight: 900 };
    const r = setFlagOverRange(plain, style, ...TWO, 'bold', false);
    expect(r.applied).toBe(false);
    expect(r.style).toBe(style);
    expect(r.runs).toEqual(plain);
  });

  it('preserves other run styling across the rewrite', () => {
    const styled: StyledRun[] = [
      { text: 'one ', fontSize: 20 },
      { text: 'two three', fill: { fill: 'solid', color: '#f00' } },
    ];
    const r = setFlagOverRange(styled, { underline: true }, ...TWO, 'underline', false);
    expect(r.runs[0]).toMatchObject({ text: 'one ', fontSize: 20, underline: true });
    expect(r.runs.find((x) => x.text === 'two')).toMatchObject({
      fill: { fill: 'solid', color: '#f00' },
    });
    expect(r.runs.find((x) => x.text === 'two')?.underline).toBeUndefined();
  });

  it('is idempotent — un-setting an already-unset span changes nothing', () => {
    const once = setFlagOverRange(plain, { underline: true }, ...TWO, 'underline', false);
    const twice = setFlagOverRange(once.runs, once.style, ...TWO, 'underline', false);
    expect(twice.runs).toEqual(once.runs);
    expect(twice.style).toEqual(once.style);
  });

  it('round-trips: un-set then re-set restores a node-styled equivalent', () => {
    const off = setFlagOverRange(plain, { underline: true }, ...TWO, 'underline', false);
    const back = setFlagOverRange(off.runs, off.style, ...TWO, 'underline', true);
    // Every character is underlined again, now expressed entirely in runs.
    for (const i of [0, 4, 7, 12]) {
      expect(effective(back.runs, back.style, 'underline', i)).toBe(true);
    }
    expect(back.runs).toEqual([{ text: 'one two three', underline: true }]);
  });

  it('treats an empty range as clearing the node flag onto every run', () => {
    const r = setFlagOverRange(plain, { underline: true }, 5, 5, 'underline', false);
    expect(r.style.underline).toBeUndefined();
    expect(r.runs).toEqual([{ text: 'one two three', underline: true }]);
  });
});
