/**
 * Style resolution laws: one object reused for resolution after resolution reads as a fresh one each time,
 * defaults fill exactly the fields a style leaves out, resolving again changes nothing, and `resolveAlign`
 * mirrors `start` and `end` under right to left.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { Fill, Stroke } from '@weasel-js/paint';
import {
  DEFAULT_TEXT_STYLE, resolveAlign, resolveTextStyle, resolveTextStyleInto, type TextPaint, type TextStyle,
} from './textStyle';
import { runs, tally } from './pbt.fixture';

const RUNS = 300;

const length = fc.oneof(
  fc.double({ min: -50, max: 200, noNaN: true }),
  fc.record({ px: fc.double({ min: 0, max: 80, noNaN: true }) }),
);

const style: fc.Arbitrary<TextStyle> = fc.record({
  fontSize: length,
  fontFamily: fc.constantFrom('inter', 'serif', 'Iowan Old Style', ''),
  fontWeight: fc.oneof(fc.integer({ min: 100, max: 900 }), fc.constantFrom('bold', '300')),
  fontStyle: fc.constantFrom('normal' as const, 'italic' as const),
  align: fc.constantFrom('left' as const, 'center' as const, 'right' as const, 'start' as const, 'end' as const, 'justify' as const),
  direction: fc.constantFrom('ltr' as const, 'rtl' as const, 'auto' as const),
  lineHeight: fc.double({ min: 0, max: 4, noNaN: true }),
  tabSize: fc.integer({ min: 0, max: 16 }),
  wrap: fc.boolean(),
  caretColor: fc.constantFrom('#f00', 'red', 'rgb(0 0 0)'),
  selectionBackground: fc.constantFrom('none', '#0f08', 'blue'),
  selectionColor: fc.constantFrom('#fff', 'black'),
  letterSpacing: length,
  underline: fc.boolean(),
  strikethrough: fc.boolean(),
  overline: fc.boolean(),
  textTransform: fc.constantFrom('none' as const, 'uppercase' as const, 'lowercase' as const, 'capitalize' as const),
  fontVariantCaps: fc.constantFrom('normal' as const, 'small-caps' as const),
  script: fc.constantFrom('super' as const, 'sub' as const),
  lang: fc.constantFrom('', 'tr', 'sr', 'ur-PK'),
}, { requiredKeys: [] });

const fill: fc.Arbitrary<Fill | null | undefined> = fc.constantFrom(
  undefined, null, { paint: { kind: 'solid', color: '#123' } }, { paint: { kind: 'solid', color: '#abc' }, opacity: 0.5 } as Fill,
);
const stroke: fc.Arbitrary<Stroke | null | undefined> = fc.constantFrom(
  undefined, null, { paint: { kind: 'solid', color: '#f00' }, width: 2 } as Stroke,
);
const paint: fc.Arbitrary<TextPaint | undefined> = fc.option(fc.record({ fill, stroke }, { requiredKeys: [] }), { nil: undefined });
const scale = fc.constantFrom(1, 0.5, 2, 3.75);

describe('text style resolution, property', () => {
  it('reads the same into a reused object as into a fresh one, whatever it resolved before', () => {
    const t = tally();
    fc.assert(fc.property(fc.array(fc.tuple(fc.option(style, { nil: undefined }), paint, scale), { minLength: 1, maxLength: 6 }), (steps) => {
      const out = { ...DEFAULT_TEXT_STYLE };
      for (const [s, p, k] of steps) {
        const reused = resolveTextStyleInto(out, s, p, k);
        expect(reused).toBe(out);
        const fresh = resolveTextStyle(s, p, k);
        // A field the fresh object leaves out is `undefined` on the reused one.
        expect(JSON.parse(JSON.stringify(reused))).toEqual(JSON.parse(JSON.stringify(fresh)));
        for (const key of Object.keys(reused) as (keyof typeof reused)[]) {
          if (!(key in fresh)) expect(reused[key], key).toBeUndefined();
        }
        if (out.script === undefined && steps.some(([x]) => x?.script)) t.count('cleared');
      }
    }), runs(RUNS));
    t.atLeast('cleared', 20);
  });

  it('takes every field the style names and the default for every one it leaves out', () => {
    const t = tally();
    fc.assert(fc.property(style, paint, scale, (s, p, k) => {
      const r = resolveTextStyle(s, p, k);
      for (const key of ['fontFamily', 'fontWeight', 'fontStyle', 'align', 'direction', 'lineHeight', 'tabSize', 'wrap',
        'underline', 'strikethrough', 'overline', 'textTransform', 'fontVariantCaps', 'script'] as const) {
        expect(r[key], key).toEqual(s[key] ?? DEFAULT_TEXT_STYLE[key]);
      }
      expect(r.lang).toBe(s.lang || undefined);
      expect(r.selectionColor).toBe(s.selectionColor ?? null);
      if (s.selectionBackground === 'none') expect(r.selectionBackground).toBeNull();
      else if (s.selectionBackground !== undefined) expect(r.selectionBackground).toBe(s.selectionBackground);
      else expect(r.selectionBackground).toContain(r.caretColor);
      for (const v of [r.fontSize, r.letterSpacing]) expect(Number.isFinite(v)).toBe(true);
      if (typeof s.fontSize === 'object') {
        t.count('px');
        expect(r.fontSize).toBeCloseTo(s.fontSize.px / k, 9);
      }
      expect(r.stroke).toEqual(p?.stroke ?? undefined);
    }), runs(RUNS));
    t.atLeast('px', 40);
  });

  it('changes nothing when resolved again from what it resolved', () => {
    fc.assert(fc.property(style, paint, scale, (s, p, k) => {
      const once = resolveTextStyle(s, p, k);
      const { fill: f, stroke: st, ...typo } = once;
      const back: TextStyle = { ...typo, selectionBackground: typo.selectionBackground ?? 'none', selectionColor: typo.selectionColor ?? undefined };
      const twice = resolveTextStyle(back, { fill: f, stroke: st }, 1);
      expect(twice).toEqual(once);
    }), runs(RUNS));
  });

  it('mirrors start and end under right to left, and leaves an absolute edge alone', () => {
    const mirror = { left: 'right', right: 'left', center: 'center' } as const;
    fc.assert(fc.property(
      fc.constantFrom('left' as const, 'center' as const, 'right' as const, 'start' as const, 'end' as const, 'justify' as const),
      (align) => {
        const ltr = resolveAlign(align, 'ltr');
        const rtl = resolveAlign(align, 'rtl');
        if (align === 'left' || align === 'center' || align === 'right') {
          expect(ltr).toBe(align);
          expect(rtl).toBe(align);
        } else {
          expect(rtl).toBe(mirror[ltr]);
          expect(ltr).toBe(align === 'end' ? 'right' : 'left');
        }
      },
    ), runs(60));
  });
});
