import { describe, it, expect } from 'vitest';
import { resolveRuns, type ResolvedRun } from './resolveRuns';
import { resolveTextStyle } from '../textStyle';
import type { StyledRun } from '../runs';

describe('resolveRuns', () => {
  it('fills run defaults from node style when run fields are absent', () => {
    const style = resolveTextStyle({ fontSize: 18, fontFamily: 'inter', fontWeight: 400, fontStyle: 'normal' });
    const runs: StyledRun[] = [{ text: 'hello' }];
    const out = resolveRuns(runs, style);
    expect(out).toHaveLength(1);
    const r = out[0] as ResolvedRun;
    expect(r.text).toBe('hello');
    expect(r.fontFamily).toBe('inter');
    expect(r.fontSize).toBe(18);
    expect(r.fontWeight).toBe(400);
    expect(r.fontStyle).toBe('normal');
    expect(r.fill).toEqual(style.fill);
  });

  it('promotes bold/italic flags into fontWeight/fontStyle overrides', () => {
    const style = resolveTextStyle({ fontWeight: 400, fontStyle: 'normal' });
    const runs: StyledRun[] = [
      { text: 'a' },
      { text: 'b', bold: true },
      { text: 'c', italic: true },
      { text: 'd', bold: true, italic: true },
    ];
    const out = resolveRuns(runs, style);
    expect(out.map((r) => r.fontWeight)).toEqual([400, 700, 400, 700]);
    expect(out.map((r) => r.fontStyle)).toEqual(['normal', 'normal', 'italic', 'italic']);
  });

  it('per-run fontSize / fontFamily / fill override node defaults', () => {
    const style = resolveTextStyle({ fontSize: 16, fontFamily: 'inter', fill: { fill: 'solid', color: '#000' } });
    const runs: StyledRun[] = [
      {
        text: 'big',
        fontSize: 32,
        fontFamily: 'mono',
        fill: { fill: 'solid', color: '#f00' },
      },
    ];
    const r = resolveRuns(runs, style)[0];
    expect(r.fontSize).toBe(32);
    expect(r.fontFamily).toBe('mono');
    expect(r.fill).toEqual({ fill: 'solid', color: '#f00' });
  });

  it('bold flag wins over numeric fontWeight inheritance when both could apply (run.bold === true sets 700)', () => {
    const style = resolveTextStyle({ fontWeight: 300 });
    const runs: StyledRun[] = [{ text: 'a', bold: true }];
    expect(resolveRuns(runs, style)[0].fontWeight).toBe(700);
  });

  it('resolves letterSpacing run-over-style, defaulting to 0', () => {
    const styled = resolveTextStyle({ letterSpacing: 3 });
    expect(resolveRuns([{ text: 'a' }], styled)[0].letterSpacing).toBe(3);
    expect(resolveRuns([{ text: 'a', letterSpacing: 8 }], styled)[0].letterSpacing).toBe(8);
    // A run may deliberately zero out inherited tracking.
    expect(resolveRuns([{ text: 'a', letterSpacing: 0 }], styled)[0].letterSpacing).toBe(0);
    // Absent on both → 0.
    expect(resolveRuns([{ text: 'a' }], resolveTextStyle({}))[0].letterSpacing).toBe(0);
  });

  it('resolves underline/strikethrough additively — a run may turn them on, never off', () => {
    const plain = resolveTextStyle({});
    expect(resolveRuns([{ text: 'a' }], plain)[0].underline).toBe(false);
    expect(resolveRuns([{ text: 'a' }], plain)[0].strikethrough).toBe(false);

    expect(resolveRuns([{ text: 'a', underline: true }], plain)[0].underline).toBe(true);
    expect(resolveRuns([{ text: 'a', strikethrough: true }], plain)[0].strikethrough).toBe(true);

    const decorated = resolveTextStyle({ underline: true, strikethrough: true });
    expect(resolveRuns([{ text: 'a' }], decorated)[0].underline).toBe(true);
    expect(resolveRuns([{ text: 'a' }], decorated)[0].strikethrough).toBe(true);

    // The additive contract (see runs/rangeStyle.ts header): run-level `false`
    // is not an un-set. `||`, not `??` — a `??` here would make "turn the
    // node's underline off for this range" look supported while the range-style
    // layer discards the `false` that would express it.
    expect(resolveRuns([{ text: 'a', underline: false }], decorated)[0].underline).toBe(true);
    expect(resolveRuns([{ text: 'a', strikethrough: false }], decorated)[0].strikethrough).toBe(true);
  });

  it('returns an empty array for empty input', () => {
    const style = resolveTextStyle({});
    expect(resolveRuns([], style)).toEqual([]);
  });
});
