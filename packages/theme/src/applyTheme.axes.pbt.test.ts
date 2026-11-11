/**
 * Stateful property test of `applyTheme` over longer sequences than `applyTheme.pbt.test.ts` runs, with themes of
 * two axes each, axis and theme names and values drawn from pools holding `Object.prototype` members, and
 * selections that name unknown values or leave axes out. After every step each held element carries one attribute
 * per axis at the full selection's value, and the cascade gives it each token its theme resolves there.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { applyTheme, __resetThemeSheet } from './applyTheme';
import { fullSelection, wzlValue, type AxisDefs, type Selection } from './axes';
import { runs, tally, timeoutFor } from './pbt.fixture';
import { resolveTheme, themeAxes } from './resolveTheme';
import type { Theme } from './theme';

const RUNS = 60;
const ELEMENTS = 3;
const AXIS_NAMES = ['mode', 'density', 'constructor', 'toString'] as const;
const VALUES = ['a', 'b', 'constructor', '__proto__', 'valueOf'] as const;
const NAMES = ['t', 'constructor', '__proto__'] as const;
const hex = fc.integer({ min: 0, max: 0xffffff }).map((n) => `#${n.toString(16).padStart(6, '0')}`);

const axisDef = fc.subarray([...VALUES], { minLength: 1 }).chain((vs) =>
  fc.constantFrom(...vs).map((d) => ({ default: d, values: Object.fromEntries(vs.map((v) => [v, {}])) })),
);
const theme: fc.Arbitrary<Theme> = fc
  .tuple(fc.constantFrom(...NAMES), fc.subarray([...AXIS_NAMES], { minLength: 1, maxLength: 2 }))
  .chain(([name, axisNames]) =>
    fc.tuple(...axisNames.map(() => axisDef)).chain((defs) => {
      const axes: AxisDefs = Object.fromEntries(axisNames.map((a, i) => [a, defs[i]!]));
      const [first] = axisNames;
      const branches = Object.keys(axes[first!]!.values);
      return fc.tuple(fc.tuple(...branches.map(() => hex)), hex).map(([xs, y]): Theme => ({
        name,
        extends: null,
        axes,
        tokens: {
          x: { by: first!, ...Object.fromEntries(branches.map((v, i) => [v, { type: 'color', value: xs[i]! }])) },
          y: { type: 'color', value: y },
        },
      }));
    }),
  );
const selection: fc.Arbitrary<Selection> = fc.dictionary(fc.constantFrom(...AXIS_NAMES), fc.constantFrom(...VALUES, 'unknown'), { maxKeys: 2, noNullPrototype: true });

interface Model {
  readonly themes: readonly Theme[];
  held: ({ theme: number; sel: Selection; handle: number } | null)[];
  releases: { el: number; release: () => void }[];
}
interface Real {
  els: HTMLElement[];
}

const t = tally();
/** Attribute selectors outside `:where()`, which is all these rules' specificity counts; quoted values hold no brackets here. */
const specificity = (selector: string) => (selector.replace(/:where\([^)]*\)/g, '').match(/\[/g) ?? []).length;

function check(m: Model, r: Real): void {
  const rules = [...document.adoptedStyleSheets, ...document.styleSheets].flatMap((s) => [...s.cssRules]) as CSSStyleRule[];
  m.held.forEach((h, i) => {
    const el = r.els[i]!;
    if (h === null) {
      expect(el.getAttribute('data-wzl-theme')).toBeNull();
      return;
    }
    const th = m.themes[h.theme]!;
    const sel = fullSelection(themeAxes(th), h.sel);
    expect(el.getAttribute('data-wzl-theme')).toBe(wzlValue(th.name));
    for (const [axis, v] of Object.entries(sel)) expect(el.getAttribute(`data-wzl-${axis}`), axis).toBe(v);
    const mine = rules.filter((rule) => el.matches(rule.selectorText));
    for (const [name, css] of Object.entries(resolveTheme(th, sel) as Record<string, string>)) {
      t.count('token');
      let won: string | undefined;
      let best = -1;
      for (const rule of mine) {
        const v = rule.style.getPropertyValue(name).trim();
        if (v !== '' && specificity(rule.selectorText) >= best) [won, best] = [v, specificity(rule.selectorText)];
      }
      expect({ el: i, name, won }).toEqual({ el: i, name, won: css });
    }
  });
}

class Apply implements fc.Command<Model, Real> {
  constructor(readonly el: number, readonly theme: number, readonly sel: Selection) {}
  check = () => true;
  run(m: Model, r: Real): void {
    const release = applyTheme(r.els[this.el]!, m.themes[this.theme]!, this.sel);
    m.held[this.el] = { theme: this.theme, sel: this.sel, handle: m.releases.length };
    m.releases.push({ el: this.el, release });
    t.count('apply');
    check(m, r);
  }
  toString = () => `apply(${this.el}, ${this.theme}, ${JSON.stringify(this.sel)})`;
}

class Release implements fc.Command<Model, Real> {
  constructor(readonly pick: number) {}
  check = (m: Readonly<Model>) => m.releases.length > 0;
  run(m: Model, r: Real): void {
    const k = this.pick % m.releases.length;
    const { el, release } = m.releases[k]!;
    release();
    if (m.held[el]?.handle === k) m.held[el] = null;
    t.count('release');
    check(m, r);
  }
  toString = () => `release(${this.pick})`;
}

describe('applyTheme over long sequences, two axes, and prototype-named themes, axes, and values', () => {
  it('every held element carries its full selection and wins the cascade with its theme there', () => {
    const commands = [
      fc.tuple(fc.integer({ min: 0, max: ELEMENTS - 1 }), fc.integer({ min: 0, max: 2 }), selection).map(([e, th, s]) => new Apply(e, th, s)),
      fc.nat().map((k) => new Release(k)),
    ];
    fc.assert(
      fc.property(fc.tuple(theme, theme, theme), fc.commands(commands, { maxCommands: 80, size: '+1' }), (themes, cmds) => {
        document.head.innerHTML = '';
        document.body.innerHTML = '';
        document.adoptedStyleSheets = [];
        __resetThemeSheet();
        const els = Array.from({ length: ELEMENTS }, () => document.body.appendChild(document.createElement('div')));
        fc.modelRun(() => ({ model: { themes, held: els.map(() => null), releases: [] }, real: { els } }), cmds);
      }),
      runs(RUNS),
    );
    t.atLeast('apply', 300);
    t.atLeast('release', 100);
    t.atLeast('token', 1000);
  }, timeoutFor(RUNS, 300));
});
