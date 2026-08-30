import { describe, it, expect } from 'vitest';
import { resolveRuns, SCRIPT_METRICS, type ResolvedRun } from './resolveRuns';
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
    const style = resolveTextStyle({ fontSize: 16, fontFamily: 'inter' }, { fill: { fill: 'solid', color: '#000' } });
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

  it('resolves overline additively, like the other two decorations', () => {
    const plain = resolveTextStyle({});
    expect(resolveRuns([{ text: 'a' }], plain)[0].overline).toBe(false);
    expect(resolveRuns([{ text: 'a', overline: true }], plain)[0].overline).toBe(true);
    const decorated = resolveTextStyle({ overline: true });
    expect(resolveRuns([{ text: 'a' }], decorated)[0].overline).toBe(true);
    expect(resolveRuns([{ text: 'a', overline: false }], decorated)[0].overline).toBe(true);
  });

  it('expands `script` into a baseline shift and a smaller size', () => {
    const style = resolveTextStyle({ fontSize: 100 });
    const [plain, sup, sub] = resolveRuns(
      [{ text: 'x' }, { text: '2', script: 'super' }, { text: '2', script: 'sub' }],
      style,
    );
    expect(plain.baselineShift).toBe(0);
    expect(plain.fontSize).toBe(100);

    expect(sup.fontSize).toBeCloseTo(58.3, 6);
    expect(sup.baselineShift).toBeCloseTo(33.3, 6);
    // Sub mirrors super: same size, opposite sign.
    expect(sub.fontSize).toBeCloseTo(58.3, 6);
    expect(sub.baselineShift).toBeCloseTo(-33.3, 6);
  });

  it('measures the shift against the inherited size, not the shrunken one', () => {
    // Were the shift measured against the run's own (already-scaled) size, a
    // superscript would climb less the smaller it was set.
    const style = resolveTextStyle({ fontSize: 100 });
    const [run] = resolveRuns([{ text: '2', script: 'super' }], style);
    expect(run.baselineShift).toBeCloseTo(100 * SCRIPT_METRICS.super.shift, 6);
    expect(run.baselineShift).not.toBeCloseTo(run.fontSize * SCRIPT_METRICS.super.shift, 3);
  });

  it('lets baselineShift and fontScale each override half of a script preset', () => {
    const style = resolveTextStyle({ fontSize: 100 });
    const [shifted] = resolveRuns([{ text: '2', script: 'super', baselineShift: 0.5 }], style);
    // The named shift wins; the preset's size survives.
    expect(shifted.baselineShift).toBeCloseTo(50, 6);
    expect(shifted.fontSize).toBeCloseTo(58.3, 6);

    const [scaled] = resolveRuns([{ text: '2', script: 'super', fontScale: 0.25 }], style);
    expect(scaled.fontSize).toBeCloseTo(25, 6);
    expect(scaled.baselineShift).toBeCloseTo(33.3, 6);
  });

  it('takes an absolute fontSize over a relative fontScale when both are named', () => {
    const style = resolveTextStyle({ fontSize: 100 });
    expect(resolveRuns([{ text: 'a', fontScale: 0.5 }], style)[0].fontSize).toBe(50);
    expect(resolveRuns([{ text: 'a', fontScale: 0.5, fontSize: 12 }], style)[0].fontSize).toBe(12);
    // A run naming neither is untouched.
    expect(resolveRuns([{ text: 'a' }], style)[0].fontSize).toBe(100);
  });

  it('carries a raw baselineShift with no script at all', () => {
    const style = resolveTextStyle({ fontSize: 40 });
    const [run] = resolveRuns([{ text: 'a', baselineShift: -0.25 }], style);
    expect(run.baselineShift).toBeCloseTo(-10, 6);
    // No script, so no size change came with it.
    expect(run.fontSize).toBe(40);
  });

  it('returns an empty array for empty input', () => {
    const style = resolveTextStyle({});
    expect(resolveRuns([], style)).toEqual([]);
  });
});
