import { describe, it, expect } from 'vitest';
import { isBoldWeight, resolveRuns, SCRIPT_METRICS, type ResolvedRun } from './resolveRuns';
import { SMALL_CAPS_SCALE, smallCapsScale } from './smallCaps';
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

  it('inherits an unfilled node style as `fill: null`, not as the default black', () => {
    const style = resolveTextStyle({}, { fill: null });
    expect(resolveRuns([{ text: 'a' }], style)[0].fill).toBeNull();
  });

  it('bold flag wins over numeric fontWeight inheritance when both could apply (run.bold === true sets 700)', () => {
    const style = resolveTextStyle({ fontWeight: 300 });
    const runs: StyledRun[] = [{ text: 'a', bold: true }];
    expect(resolveRuns(runs, style)[0].fontWeight).toBe(700);
  });

  it('a run fontWeight overrides both the node weight and the bold flag', () => {
    const style = resolveTextStyle({ fontWeight: 700 });
    const out = resolveRuns([
      { text: 'a', fontWeight: 300 },
      { text: 'b', fontWeight: 600, bold: true },
      { text: 'c', bold: true },
    ], style);
    expect(out.map((r) => r.fontWeight)).toEqual([300, 600, 700]);
  });

  it('isBoldWeight reads 600 and up as bold, including the CSS keywords', () => {
    expect([100, 400, 500, 600, 700, 900].map(isBoldWeight)).toEqual([false, false, false, true, true, true]);
    expect(isBoldWeight('bold')).toBe(true);
    expect(isBoldWeight('normal')).toBe(false);
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

  it("takes a node-level script as every run's default", () => {
    const style = resolveTextStyle({ fontSize: 100, script: 'super' });
    const [inherited, own] = resolveRuns([{ text: 'a' }, { text: 'b', script: 'sub' }], style);
    expect(inherited.fontSize).toBeCloseTo(58.3, 6);
    expect(inherited.baselineShift).toBeCloseTo(33.3, 6);
    // A run naming its own script replaces the node's rather than stacking.
    expect(own.fontSize).toBeCloseTo(58.3, 6);
    expect(own.baselineShift).toBeCloseTo(-33.3, 6);
  });

  it('holds the line open at the inherited size when a relative size shrinks a run', () => {
    const style = resolveTextStyle({ fontSize: 100 });
    const [plain, sup, scaled, absolute] = resolveRuns(
      [
        { text: 'a' },
        { text: 'b', script: 'super' },
        { text: 'c', fontScale: 0.5 },
        { text: 'd', script: 'super', fontSize: 20 },
      ],
      style,
    );
    expect(plain.strutSize).toBeUndefined();
    expect(sup.strutSize).toBe(100);
    expect(scaled.strutSize).toBe(100);
    // An absolute size is the run's own; nothing inherited is left to hold.
    expect(absolute.strutSize).toBeUndefined();
  });

  it('returns an empty array for empty input', () => {
    const style = resolveTextStyle({});
    expect(resolveRuns([], style)).toEqual([]);
  });
});

describe('resolveRuns screen-pixel sizes', () => {
  it("divides a run's own `{ px }` fontSize by the view scale", () => {
    const style = resolveTextStyle({ fontSize: 10 });
    expect(resolveRuns([{ text: 'a', fontSize: { px: 24 } }], style, 4)[0].fontSize).toBe(6);
  });

  it("divides a run's own `{ px }` letterSpacing by the view scale", () => {
    const style = resolveTextStyle({});
    expect(resolveRuns([{ text: 'a', letterSpacing: { px: 8 } }], style, 4)[0].letterSpacing).toBe(2);
  });

  it('inherits the style size already resolved, not re-divided', () => {
    const style = resolveTextStyle({ fontSize: { px: 24 } }, undefined, 4);
    expect(resolveRuns([{ text: 'a' }], style, 4)[0].fontSize).toBe(6);
  });
});

describe('resolveRuns text-transform', () => {
  it("applies a run's transform to its text", () => {
    const style = resolveTextStyle({});
    const out = resolveRuns([{ text: 'ab ' }, { text: 'cd', textTransform: 'uppercase' }], style);
    expect(out.map((r) => r.text)).toEqual(['ab ', 'CD']);
    expect(out[1].srcMap).toBeUndefined();
  });

  it('inherits the node transform, and a run can turn it off with none', () => {
    const style = resolveTextStyle({ textTransform: 'uppercase' });
    const out = resolveRuns([{ text: 'ab' }, { text: 'cd', textTransform: 'none' }], style);
    expect(out.map((r) => r.text)).toEqual(['AB', 'cd']);
  });

  it('reports a source map when a transform changes a length', () => {
    const style = resolveTextStyle({});
    const [run] = resolveRuns([{ text: 'aß', textTransform: 'uppercase' }], style);
    expect(run.text).toBe('ASS');
    expect(run.srcMap).toEqual({ length: 2, starts: [0, 1, 1], ends: [1, 2, 2] });
  });
});

describe('resolveRuns small caps', () => {
  // No font is registered here, so every run takes the default scale.
  const small = 20 * SMALL_CAPS_SCALE;

  it('draws lowercase as capitals at the small-caps size, and leaves the rest full size', () => {
    const style = resolveTextStyle({ fontSize: 20 });
    const [run] = resolveRuns([{ text: 'Ab1c', fontVariantCaps: 'small-caps' }], style);
    expect(run.text).toBe('AB1C');
    expect(run.fontSize).toBe(20);
    expect(run.sizeMap).toEqual([20, small, 20, small]);
    expect(run.srcMap).toBeUndefined();
  });

  it('inherits the node variant, and a run can turn it off with normal', () => {
    const style = resolveTextStyle({ fontSize: 20, fontVariantCaps: 'small-caps' });
    const out = resolveRuns([{ text: 'ab' }, { text: 'cd', fontVariantCaps: 'normal' }], style);
    expect(out.map((r) => r.text)).toEqual(['AB', 'cd']);
    expect(out[1].sizeMap).toBeUndefined();
  });

  it('carries no size map for a run with nothing to shrink', () => {
    const [run] = resolveRuns([{ text: 'AB 12', fontVariantCaps: 'small-caps' }], resolveTextStyle({ fontSize: 20 }));
    expect(run.sizeMap).toBeUndefined();
  });

  it('sees the transformed text, so uppercase leaves nothing small and lowercase makes everything small', () => {
    const style = resolveTextStyle({ fontSize: 20 });
    const [up, low] = resolveRuns([
      { text: 'Ab', fontVariantCaps: 'small-caps', textTransform: 'uppercase' },
      { text: 'Ab', fontVariantCaps: 'small-caps', textTransform: 'lowercase' },
    ], style);
    expect(up.sizeMap).toBeUndefined();
    expect(low.text).toBe('AB');
    expect(low.sizeMap).toEqual([small, small]);
  });

  it('maps a lowercase letter whose capital is longer back to its one source character', () => {
    const [run] = resolveRuns([{ text: 'aßb', fontVariantCaps: 'small-caps' }], resolveTextStyle({ fontSize: 20 }));
    expect(run.text).toBe('ASSB');
    expect(run.srcMap).toEqual({ length: 3, starts: [0, 1, 1, 2], ends: [1, 2, 2, 3] });
    expect(run.sizeMap).toEqual([small, small, small, small]);
  });

  it('composes with a transform that already changed a length', () => {
    // `ß` → `SS` under uppercase, then `ﬁ` → `FI` under small caps.
    const [run] = resolveRuns(
      [{ text: 'ßﬁ', fontVariantCaps: 'small-caps', textTransform: 'uppercase' }],
      resolveTextStyle({ fontSize: 20 }),
    );
    // Uppercase already turned `ﬁ` into `FI`, so nothing is left to shrink.
    expect(run.text).toBe('SSFI');
    expect(run.srcMap).toEqual({ length: 2, starts: [0, 0, 1, 1], ends: [1, 1, 2, 2] });
    expect(run.sizeMap).toBeUndefined();
    const [capped] = resolveRuns(
      [{ text: 'ßﬁ', fontVariantCaps: 'small-caps', textTransform: 'capitalize' }],
      resolveTextStyle({ fontSize: 20 }),
    );
    // Capitalize titlecases `ß` to `Ss`; small caps then shrinks the `s` and
    // spells out `ﬁ`.
    expect(capped.text).toBe('SSFI');
    expect(capped.srcMap).toEqual({ length: 2, starts: [0, 0, 1, 1], ends: [1, 1, 2, 2] });
    expect(capped.sizeMap).toEqual([20, small, small, small]);
  });

  it('scales the size a script or fontScale already settled on', () => {
    const [run] = resolveRuns([{ text: 'Ab', fontVariantCaps: 'small-caps', fontScale: 0.5 }], resolveTextStyle({ fontSize: 20 }));
    expect(run.fontSize).toBe(10);
    expect(run.sizeMap).toEqual([10, 10 * SMALL_CAPS_SCALE]);
  });
});

describe('smallCapsScale', () => {
  it("is the face's x-height over its cap height, and the default without both", () => {
    expect(smallCapsScale({ xHeight: 0.5, capHeight: 0.8 })).toBeCloseTo(0.625, 12);
    expect(smallCapsScale({ xHeight: 0.5 })).toBe(SMALL_CAPS_SCALE);
    expect(smallCapsScale(undefined)).toBe(SMALL_CAPS_SCALE);
  });
});
