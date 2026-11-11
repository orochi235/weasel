/**
 * Property tests of a HUD menu's value rows: `hexColor` against paint's hex reading, written once and again; a
 * color picker's swatches, which one reads checked for the color held, through any sequence of choices and typing;
 * a number row's chips as a partition of its end, moving with the panel's width; and `caretAt` landing on the
 * cluster boundary nearest a point, in order along the row.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { tryNormalizeHex } from '@weasel-js/paint';
import type { MenuColorEntry, MenuEntry, MenuTextEntry } from '@weasel-js/menu';
import { draftText, runs, tally } from '../pbt.fixture';
import { DEFAULT_MENU_METRICS, type MenuMetrics } from './drawPanel';
import { DEFAULT_MENU_PALETTE, hexColor, withColorPickers } from './colorPicker';
import { clusterStops } from './textEdit';
import { caretAt, chipAt, numberChips } from './valueRows';

const RUNS = 300;

const hexDigit = fc.constantFrom(...'0123456789abcdefABCDEF');
const hexOf = (n: number) => fc.array(hexDigit, { minLength: n, maxLength: n }).map((d) => d.join(''));
/** Text a hex field could hold: hex of every length CSS reads, with or without `#`, padded, or anything at all. */
const typed = fc.oneof(
  { weight: 3, arbitrary: fc.tuple(fc.constantFrom('', '#'), fc.constantFrom(3, 4, 6, 8).chain(hexOf), fc.constantFrom('', ' ')).map((p) => p.join('')) },
  fc.string({ maxLength: 10 }),
  fc.constantFrom('red', 'transparent', '#', '#12345', 'zzz'),
);

describe('hexColor', () => {
  it('writes six digits, or eight with alpha, exactly when paint reads hex, and writes its own output back unchanged', () => {
    const seen = tally();
    fc.assert(fc.property(typed, fc.boolean(), fc.option(typed, { nil: undefined }), (text, alpha, keep) => {
      const out = hexColor(text, alpha, keep);
      const read = tryNormalizeHex(text);
      expect(out === undefined).toBe(read === undefined);
      if (out === undefined) { seen.hit('refused'); return; }
      expect(out).toMatch(alpha ? /^#[0-9a-f]{8}$/ : /^#[0-9a-f]{6}$/);
      expect(out.slice(0, 7)).toBe(read!.slice(0, 7));
      expect(hexColor(out, alpha, keep)).toBe(out);
      if (alpha) {
        const typedAlpha = read!.length === 9;
        const kept = keep === undefined ? undefined : tryNormalizeHex(keep, 'rgba')?.slice(7);
        expect(out.slice(7)).toBe(typedAlpha ? read!.slice(7) : kept ?? 'ff');
        seen.hit(typedAlpha ? 'typed alpha' : kept ? 'kept alpha' : 'opaque');
      }
    }), runs(RUNS));
    for (const k of ['refused', 'typed alpha', 'kept alpha', 'opaque']) seen.atLeast(k, 10);
  });
});

describe('withColorPickers', () => {
  const palette = fc.oneof(
    fc.constant(DEFAULT_MENU_PALETTE),
    fc.array(fc.oneof(hexOf(6).map((h) => `#${h}`), hexOf(8).map((h) => `#${h}`), fc.constantFrom('red', 'rebeccapurple')), { minLength: 1, maxLength: 6 }),
  );
  type Act = { t: 'choose'; i: number } | { t: 'type'; text: string } | { t: 'write'; value: string | undefined };
  const act: fc.Arbitrary<Act> = fc.oneof(
    fc.record({ t: fc.constant('choose' as const), i: fc.nat() }),
    fc.record({ t: fc.constant('type' as const), text: typed }),
    fc.record({ t: fc.constant('write' as const), value: fc.option(typed, { nil: undefined }) }),
  );

  it('reads a swatch checked exactly when choosing it would write the color held', () => {
    const seen = tally();
    fc.assert(fc.property(palette, fc.boolean(), fc.option(typed, { nil: undefined }), fc.array(act, { maxLength: 12 }), (pal, alpha, start, acts) => {
      let held = start;
      const c = { colorValue: () => held, setColor: (_e: MenuColorEntry, v: string) => { held = v; } };
      const row: MenuColorEntry = { kind: 'color', key: 'c', label: 'C', value: start, alpha, set: () => {} };
      const { entries } = withColorPickers([row], pal, () => c);
      const sub = entries[0] as Extract<MenuEntry, { kind: 'submenu' }>;
      const swatches = sub.entries.filter((e): e is Extract<MenuEntry, { kind: 'item' }> => e.kind === 'item');
      const hex = sub.entries.find((e): e is MenuTextEntry => e.kind === 'text')!;
      const check = () => {
        for (const s of swatches) {
          // What choosing it writes, read without running it.
          const writes = hexColor(s.label, alpha, held) ?? s.label;
          expect(s.checked).toBe(held !== undefined && (hexColor(held, alpha) ?? held) === writes);
          if (s.checked) seen.hit('checked');
        }
      };
      check();
      for (const a of acts) {
        if (a.t === 'choose') { swatches[a.i % swatches.length]!.run(); seen.hit('chose'); }
        else if (a.t === 'type') hex.set!(a.text);
        else held = a.value;
        check();
      }
    }), runs(RUNS));
    seen.atLeast('checked', 50);
  });
});

const metrics: fc.Arbitrary<MenuMetrics> = fc.oneof(
  fc.constant(DEFAULT_MENU_METRICS),
  fc.record({
    rowHeight: fc.integer({ min: 12, max: 40 }), padX: fc.integer({ min: 0, max: 16 }), padY: fc.integer({ min: 0, max: 12 }),
    separatorHeight: fc.integer({ min: 1, max: 16 }), minWidth: fc.integer({ min: 0, max: 300 }), fontSize: fc.integer({ min: 8, max: 24 }),
  }),
);

describe('number row chips', () => {
  it('step down over the minus chip, up over the plus chip, and neither elsewhere, alike at any panel width', () => {
    fc.assert(fc.property(metrics, fc.integer({ min: 0, max: 600 }), fc.integer({ min: -50, max: 650 }), fc.integer({ min: -300, max: 300 }), (m, w, x, d) => {
      const { minus, value, plus, width } = numberChips(w, m);
      expect(minus.x + minus.w).toBeLessThanOrEqual(value.x);
      expect(value.x + value.w).toBeLessThanOrEqual(plus.x);
      expect(plus.x + plus.w - minus.x).toBe(width);
      expect(plus.x + plus.w).toBe(w - m.padX);
      const want = x >= plus.x && x < plus.x + plus.w ? 1 : x >= minus.x && x < minus.x + minus.w ? -1 : null;
      expect(chipAt(w, m, x)).toBe(want);
      expect(chipAt(w + d, m, x + d)).toBe(want);
    }), runs(RUNS));
  });
});

describe('caretAt', () => {
  it('lands on the cluster boundary nearest the point, left to right in order, and nowhere left of the text', () => {
    const seen = tally();
    fc.assert(fc.property(draftText, metrics, fc.integer({ min: 60, max: 400 }), fc.double({ min: 2, max: 12, noNaN: true }),
      fc.array(fc.integer({ min: -100, max: 450 }), { minLength: 2, maxLength: 8 }), (draft, m, w, perChar, xs) => {
        const measure = (t: string) => Array.from(t).length * perChar;
        const right = w - m.padX - 3;
        const n = Array.from(draft).length;
        const xAt = (i: number) => right - (n - i) * perChar;
        const stops = clusterStops(draft);
        let last = -1;
        for (const x of [...xs].sort((a, b) => a - b)) {
          const at = caretAt(draft, w, m, x, measure);
          if (x < xAt(0) - m.padX) { expect(at).toBeUndefined(); seen.hit('over label'); continue; }
          expect(at).toBeDefined();
          expect(stops).toContain(at);
          const best = Math.min(...stops.map((s) => Math.abs(xAt(s) - x)));
          expect(Math.abs(xAt(at!) - x)).toBeCloseTo(best, 9);
          expect(at!).toBeGreaterThanOrEqual(last);
          last = at!;
          seen.hit('placed');
        }
      }), runs(RUNS));
    seen.atLeast('over label', 20);
    seen.atLeast('placed', 100);
  });
});
