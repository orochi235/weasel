/**
 * Property tests of the CSS values theme reads and writes: numbers and box shadows printed and read back,
 * `var()` expansion against an oracle, `currentColor` flattened, and the attribute selectors `applyTheme`
 * writes matching exactly the element they were written for.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { parseColor } from '@weasel-js/paint';
import { wzlAttr } from './axes';
import { expandVars, parseBoxShadow, type BoxShadow } from './boxShadow';
import { readCssNumber } from './cssNumber';
import { resolveCurrentColor } from './currentColor';
import type { ResolvedTheme } from './resolveTheme';
import { tokenPx } from './tokenPx';
import { runs, tally } from './pbt.fixture';

const RUNS = 300;

const finite = fc.oneof(
  fc.integer({ min: -1000, max: 1000 }),
  fc.double({ noNaN: true, noDefaultInfinity: true }),
).map((n) => n + 0);

describe('readCssNumber', () => {
  it('reads back any finite number printed with any unit', () => {
    fc.assert(fc.property(finite, fc.stringMatching(/^(?:[a-zA-Z]{0,4}|%)$/), fc.constantFrom('', ' ', '  '), (n, unit, pad) => {
      expect(readCssNumber(`${pad}${n}${unit}${pad}`)).toEqual({ value: n, unit });
    }), runs(RUNS));
  });

  it('reads nothing from a list, a function, or a word', () => {
    fc.assert(fc.property(finite, fc.constantFrom('4px 2px', 'calc(1px)', 'var(--a)', 'px', '', '1px,', '--1px', '1..2'), (n, text) => {
      expect(readCssNumber(text.replace('1', String(Math.abs(n))))).toBeUndefined();
    }), runs(RUNS));
  });
});

describe('tokenPx', () => {
  it('reads a px length or a bare zero, and throws for any other value', () => {
    const name = '--wzl-space-md' as keyof ResolvedTheme;
    fc.assert(fc.property(finite, fc.constantFrom('px', 'PX', '', 'rem', '%'), (n, unit) => {
      const resolved = { [name]: `${n}${unit}` } as unknown as ResolvedTheme;
      if (unit.toLowerCase() === 'px' || (unit === '' && n === 0)) expect(tokenPx(name, resolved)).toBe(n);
      else expect(() => tokenPx(name, resolved)).toThrow('is not a px length');
    }), runs(RUNS));
  });
});

const COLORS = ['#ff0000', 'rgb(1, 2, 3)', 'rgba(0, 0, 0, 0.5)', 'color-mix(in srgb, red 50%, transparent)', 'black', 'var(--wzl-x, #fff)'];
const px = (bare: boolean) => (n: number) => (n === 0 && bare ? '0' : `${n}px`);

const layer: fc.Arbitrary<BoxShadow & { lengths: number; colorFirst: boolean; named: boolean; bare: boolean }> = fc.record({
  inset: fc.boolean(),
  x: finite,
  y: finite,
  blur: finite,
  spread: finite,
  color: fc.constantFrom(...COLORS),
  lengths: fc.integer({ min: 2, max: 4 }),
  colorFirst: fc.boolean(),
  named: fc.boolean(),
  bare: fc.boolean(),
});

describe('parseBoxShadow', () => {
  it('reads back every layer printed, in order', () => {
    fc.assert(fc.property(fc.array(layer, { minLength: 1, maxLength: 4 }), (layers) => {
      const css = layers.map((l) => {
        const lengths = [l.x, l.y, l.blur, l.spread].slice(0, l.lengths).map(px(l.bare)).join(' ');
        const color = l.named ? l.color : '';
        const words = l.colorFirst ? [color, lengths] : [lengths, color];
        return [l.inset ? 'inset' : '', ...words].filter((w) => w !== '').join(' ');
      }).join(', ');
      const want = layers.map((l) => ({
        inset: l.inset,
        x: l.x,
        y: l.y,
        blur: l.lengths > 2 ? l.blur : 0,
        spread: l.lengths > 3 ? l.spread : 0,
        color: l.named ? l.color : 'currentColor',
      }));
      expect(parseBoxShadow(css)).toEqual(want);
    }), runs(RUNS));
  });

  it('reads any text or refuses it with an error', () => {
    fc.assert(fc.property(fc.string({ unit: fc.constantFrom('1', 'p', 'x', ' ', ',', '(', ')', 'i', 'n', 's', 'e', 't', '-', '.', '#') , maxLength: 30 }), (css) => {
      try {
        for (const l of parseBoxShadow(css)) for (const n of [l.x, l.y, l.blur, l.spread]) expect(Number.isFinite(n)).toBe(true);
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).not.toBeInstanceOf(TypeError);
      }
    }), runs(RUNS));
  });
});

/** A value in a small `var()` grammar: words, and references with or without a fallback. */
type Part = { word: string } | { ref: string; fallback?: Part[] };
const NAMES = ['--a', '--b', '--c', '--d'];
const parts: fc.Arbitrary<Part[]> = fc.letrec((tie) => ({
  parts: fc.array(tie('part'), { minLength: 1, maxLength: 3 }),
  part: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    fc.constantFrom('1px', '#fff', 'solid', 'inset').map((word) => ({ word })),
    fc.record({ ref: fc.constantFrom(...NAMES), fallback: fc.option(tie('parts'), { nil: undefined }) }, { requiredKeys: ['ref'] }),
  ),
})).parts as fc.Arbitrary<Part[]>;

const print = (ps: readonly Part[]): string => ps.map((p) => ('word' in p ? p.word : p.fallback ? `var(${p.ref}, ${print(p.fallback)})` : `var(${p.ref})`)).join(' ');

/** What a browser substitutes: a defined name expands its value, an undefined one its fallback; a loop through defined names fails. */
function expand(ps: readonly Part[], tokens: Readonly<Record<string, Part[]>>, seen: readonly string[]): string {
  return ps.map((p) => {
    if ('word' in p) return p.word;
    if (seen.includes(p.ref)) throw new Error('cycle');
    if (Object.hasOwn(tokens, p.ref)) return expand(tokens[p.ref]!, tokens, [...seen, p.ref]);
    if (p.fallback) return expand(p.fallback, tokens, seen);
    throw new Error('missing');
  }).join(' ');
}

describe('expandVars', () => {
  it('substitutes as a browser does, and throws for a loop or a name with no value', () => {
    const t = tally();
    fc.assert(fc.property(fc.dictionary(fc.constantFrom(...NAMES), parts, { maxKeys: 4 }), parts, (tokens, value) => {
      const printed = Object.fromEntries(Object.entries(tokens).map(([k, v]) => [k, print(v)]));
      let want: string;
      try {
        want = expand(value, tokens, []);
      } catch (e) {
        const why = (e as Error).message;
        t.count(why);
        expect(() => expandVars(print(value), printed)).toThrow(why === 'cycle' ? /refers to itself/ : /no fallback/);
        return;
      }
      t.count(value.some((p) => 'ref' in p) ? 'expands' : 'plain');
      expect(expandVars(print(value), printed)).toBe(want);
    }), runs(RUNS));
    t.atLeast('expands', 50);
    t.atLeast('cycle', 20);
    t.atLeast('missing', 20);
  });
});

describe('expandVars fuzzed', () => {
  it('expands any text or refuses it with an error', () => {
    const text = fc.array(fc.constantFrom('var(', ')', ',', ' ', '--a', '--b', 'constructor', '__proto__', '1px', '('), { maxLength: 10 }).map((ws) => ws.join(''));
    fc.assert(fc.property(text, fc.dictionary(fc.constantFrom('--a', '--b'), text, { maxKeys: 2 }), (value, tokens) => {
      try {
        expect(typeof expandVars(value, tokens)).toBe('string');
      } catch (e) {
        expect(e).toBeInstanceOf(Error);
        expect(e).not.toBeInstanceOf(TypeError);
        expect((e as Error).message).toMatch(/^expandVars: /);
      }
    }), runs(RUNS));
  });
});

describe('resolveCurrentColor', () => {
  const byte = fc.integer({ min: 0, max: 255 });
  const pct = fc.integer({ min: 0, max: 100 });
  const hex = (n: number) => n.toString(16).padStart(2, '0');

  it('flattens each form it knows to the current color at that alpha', () => {
    fc.assert(fc.property(byte, byte, byte, pct, fc.constantFrom('rel', 'relPct', 'mix', 'bare'), (r, g, b, p, form) => {
      const current = `#${hex(r)}${hex(g)}${hex(b)}`;
      const css = form === 'rel' ? `rgb(from currentColor r g b / ${p / 100})`
        : form === 'relPct' ? `rgb(from currentcolor r g b / ${p}%)`
          : form === 'mix' ? `color-mix(in oklab, currentColor ${p}%, transparent)` : 'currentColor';
      const [R, G, B, A] = parseColor(resolveCurrentColor(css, current));
      expect([R, G, B].map((c) => Math.round(c * 255))).toEqual([r, g, b]);
      expect(A).toBeCloseTo(form === 'bare' ? 1 : p / 100, 3);
    }), runs(RUNS));
  });

  it('leaves anything without currentColor alone, and refuses any other use of it with an error', () => {
    fc.assert(fc.property(fc.string({ maxLength: 20 }), fc.boolean(), (text, mention) => {
      const css = mention ? `${text}currentColor${text}` : text;
      if (!/currentcolor/i.test(css)) {
        expect(resolveCurrentColor(css, '#000')).toBe(css);
        return;
      }
      try {
        resolveCurrentColor(css, '#000');
      } catch (e) {
        expect((e as Error).message).toMatch(/cannot flatten/);
      }
    }), runs(RUNS));
  });
});

describe('wzlAttr', () => {
  // The BMP only: jsdom's selector engine matches no character past it, though a browser does. No NUL: CSS
  // reads one as U+FFFD, escaped or not, so no selector can match it (docs/unruled.md).
  const char = fc.string({ unit: 'binary', minLength: 1, maxLength: 1 }).filter((c) => c.length === 1 && c !== '\0');
  const text = fc.string({ unit: fc.oneof(fc.constantFrom("'", '"', '\\', '\n', '\r', '\f', '\t', ' ', ']', '[', 'a', '-', '0', 'é'), char), maxLength: 8 });

  it('selects the element whose attribute holds the value, and no other', () => {
    fc.assert(fc.property(text, text, (value, other) => {
      fc.pre(value !== other);
      const root = document.createElement('div');
      const el = document.createElement('div');
      const not = document.createElement('div');
      el.setAttribute('data-wzl-theme', value);
      not.setAttribute('data-wzl-theme', other);
      root.append(el, not);
      expect(root.querySelectorAll(wzlAttr('theme', value))).toEqual(root.querySelectorAll('div:first-child'));
    }), runs(RUNS));
  });
});
