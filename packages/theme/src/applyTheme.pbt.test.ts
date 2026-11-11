/**
 * Stateful property test of `applyTheme` and the sheet behind it: random applications of themes (two sharing a
 * name, values hostile to CSS among their tokens) to a few elements, and random calls of the releases they
 * returned, stale ones included. After every step each element carries the attributes of what it holds, wins
 * the cascade with its own theme's values, each declarable token landing as one custom property, and the sheet
 * holds no rule that no element holds.
 */
import fc from 'fast-check';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { refTarget } from './dtcg/resolve';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { resolveTheme } from './resolveTheme';
import type { Theme } from './theme';

const RUNS = 100;
const ELEMENTS = 3;
const MODES = ['dark', 'light'] as const;

/** Values no declaration can be cut short by, which therefore must land. */
const SAFE = ['#ff0000', '4px', 'serif', "'Open Sans', sans-serif", 'var(--a, [x] f(1))', 'url(a.png)'];
/** Values that may be left out; a stray closer among them, which a browser drops. */
const HOSTILE = ['serif; } * { color: red', "'a\n;}", 'serif /*', 'serif \\', 'f(', '[', "'open", 'a { b', 'serif)', 'a ]'];
const value = fc.oneof({ weight: 3, arbitrary: fc.constantFrom(...SAFE) }, fc.constantFrom(...HOSTILE), fc.string({ maxLength: 6 }).filter((v) => refTarget(v) === null));

const theme = (name: string): fc.Arbitrary<Theme> =>
  fc.record({ x: value, y: value, z: value }).map(({ x, y, z }) => ({
    name,
    extends: null,
    axes: { mode: { default: 'dark', values: { dark: { scheme: 'dark' }, light: {} } } },
    tokens: {
      x: { by: 'mode', dark: { type: 'unknown', value: x }, light: { type: 'unknown', value: y } },
      y: { type: 'unknown', value: z },
    },
  }));

interface Model {
  readonly themes: readonly Theme[];
  /** What each element holds: a theme index, a mode, and the handle of the application. */
  held: ({ theme: number; mode: string; handle: number } | null)[];
  releases: { el: number; release: () => void }[];
}
interface Real {
  els: HTMLElement[];
}

const t = tally();
/** jsdom reserializes a declaration's whitespace and quotes. */
const squash = (css: string | undefined) => css?.replace(/\s+/g, '').replace(/'/g, '"');

function rules(): CSSStyleRule[] {
  return [...document.adoptedStyleSheets, ...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
}

function check(m: Model, r: Real): void {
  const all = rules();
  const live = new Set<string>();
  m.held.forEach((h, i) => {
    const el = r.els[i]!;
    if (h === null) {
      expect(el.getAttribute('data-wzl-theme')).toBeNull();
      expect(el.getAttribute('data-wzl-mode')).toBeNull();
      return;
    }
    const th = m.themes[h.theme]!;
    expect(el.getAttribute('data-wzl-theme')).toBe(th.name);
    expect(el.getAttribute('data-wzl-mode')).toBe(h.mode);
    if (el.hasAttribute('data-wzl-variant')) t.count('variant');
    const resolved = resolveTheme(th, { mode: h.mode }) as Record<string, string>;
    live.add(`${th.name}\0${h.mode}\0${JSON.stringify(resolved)}`);
    const mine = all.filter((rule) => el.matches(rule.selectorText));
    expect(mine.length).toBeGreaterThan(0);
    for (const [name, css] of Object.entries(resolved)) {
      const won = mine.map((rule) => rule.style.getPropertyValue(name)).filter((v) => v !== '').at(-1);
      if (SAFE.includes(css)) {
        t.count('safe value');
        expect(squash(won)).toBe(squash(css));
      } else if (won === undefined) {
        t.count('left out');
      } else {
        // Whatever it was reserialized as; that it cut short no other declaration, the safe values show.
        t.count('landed');
      }
    }
  });
  // Two holds whose values differ only in tokens left out share one rule, so `live` bounds the count from above.
  expect(all.length).toBeLessThanOrEqual(live.size);
  for (const rule of all) expect(r.els.some((el, i) => m.held[i] !== null && el.matches(rule.selectorText)), rule.cssText).toBe(true);
}

const elIndex = fc.integer({ min: 0, max: ELEMENTS - 1 });

class Apply implements fc.Command<Model, Real> {
  constructor(readonly el: number, readonly theme: number, readonly mode: string) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const release = applyTheme(r.els[this.el]!, m.themes[this.theme]!, { mode: this.mode });
    m.held[this.el] = { theme: this.theme, mode: this.mode, handle: m.releases.length };
    m.releases.push({ el: this.el, release });
    t.count('apply');
    check(m, r);
  }
  toString = () => `apply(${this.el}, ${this.theme}, ${this.mode})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.releases.length > 0;
  run(m: Model, r: Real): void {
    const k = this.pick % m.releases.length;
    const { el, release } = m.releases[k]!;
    release();
    if (m.held[el]?.handle === k) {
      m.held[el] = null;
      t.count('release');
    } else {
      t.count('stale release');
    }
    check(m, r);
  }
  toString = () => `release(${this.pick})`;
}

describe('applyTheme against a model', () => {
  let warn: ReturnType<typeof vi.spyOn>;
  beforeEach(() => {
    warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => warn.mockRestore());

  it('every element shows its own theme, and the sheet holds just the rules in use', () => {
    const commands = [
      fc.tuple(elIndex, fc.integer({ min: 0, max: 2 }), fc.constantFrom(...MODES)).map(([e, th, mo]) => new Apply(e, th, mo)),
      fc.nat().map((k) => new Release(k)),
    ];
    fc.assert(
      fc.property(fc.tuple(theme('a'), theme('a'), theme("b'\r\\")), fc.commands(commands, { maxCommands: 30, size: '+1' }), (themes, cmds) => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.adoptedStyleSheets = [];
        __resetThemeSheet();
        const els = Array.from({ length: ELEMENTS }, () => document.body.appendChild(document.createElement('div')));
        fc.modelRun(() => ({ model: { themes, held: els.map(() => null), releases: [] }, real: { els } }), cmds);
      }),
      runs(RUNS),
    );
    t.atLeast('apply', 100);
    t.atLeast('release', 30);
    t.atLeast('stale release', 30);
    t.atLeast('safe value', 200);
    t.atLeast('left out', 100);
    t.atLeast('landed', 50);
    t.atLeast('variant', 100);
  }, timeoutFor(RUNS, 60));
});
