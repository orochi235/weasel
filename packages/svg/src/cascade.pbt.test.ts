/**
 * The style cascade against a model of CSS Cascade 5 as SVG 2 applies it: presentation attributes below every
 * author rule, rules by specificity and then source order, `style=""` above rules, `!important` reversing all of
 * it, and a declaration CSS rejects dropped so the one below stands. Then inheritance down a chain of groups,
 * with `inherit`, `initial`, and `currentColor` (CSS Color 4: computed as the keyword, used as the element's own
 * `color`).
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { parseSvg } from './parse';
import type { SvgNode, SvgPaint } from './types';
import { runs, timeoutFor } from './pbt.fixture';
import { escapeAttr, escapeText } from './xmlEscape';

const N = 200;

/** Each color as authored, with what it reads as. */
const HEX: Record<string, string> = {
  red: '#ff0000', blue: '#0000ff', lime: '#00ff00', '#123456': '#123456', 'rgb(1, 2, 3)': '#010203', '#ABC': '#aabbcc',
};
const colorText = fc.constantFrom(...Object.keys(HEX));
// None with a parenthesis: `isDeclarationInvalid` keeps a function it cannot read, which may be CSS it does not know.
const INVALID = ['nonsense', '#12', '12px', 'evenodd', '#ggg'];

/** Selectors matching `<rect id="r" class="a b">` inside the root, with their specificity as one comparable number. */
const SELECTORS: Record<string, number> = {
  '*': 0, rect: 1, 'svg rect': 2, '.a': 100, 'rect.a': 101, '.a.b': 200, '#r': 10000, 'rect#r': 10001,
  ':is(#r, rect)': 10000, ':where(#r)': 0, '[id="r"]': 100,
};

type Value = { text: string; valid: boolean };
const value: fc.Arbitrary<Value> = fc.oneof(
  { weight: 4, arbitrary: colorText.map((text) => ({ text, valid: true })) },
  { weight: 1, arbitrary: fc.constant({ text: 'none', valid: true }) },
  { weight: 1, arbitrary: fc.constantFrom(...INVALID).map((text) => ({ text, valid: false })) },
);
const decl = fc.record({ v: value, important: fc.boolean() });
const rule = fc.record({ selector: fc.constantFrom(...Object.keys(SELECTORS)), d: decl });

/** Where a declaration sits in the cascade: higher wins. */
function weight(origin: 'attr' | 'rule' | 'inline', important: boolean, spec: number, order: number): number[] {
  const tier = origin === 'attr' ? 0 : important ? (origin === 'rule' ? 3 : 4) : (origin === 'rule' ? 1 : 2);
  return [tier, origin === 'rule' ? spec : 0, order];
}
const later = (a: number[], b: number[]): boolean => {
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return a[i]! > b[i]!;
  return false;
};

function paintOf(nodes: readonly SvgNode[]): SvgPaint {
  const leaf = (ns: readonly SvgNode[]): SvgNode | undefined => {
    for (const n of ns) {
      if (n.kind === 'group') { const l = leaf(n.children); if (l) return l; } else return n;
    }
    return undefined;
  };
  const l = leaf(nodes);
  if (!l || l.kind !== 'path') throw new Error('no leaf');
  return l.fill;
}
const read = (p: SvgPaint): string => (p.kind === 'solid' ? p.color : p.kind);

describe('the style cascade, property', () => {
  it('takes the declaration that ranks highest of attribute, rules, and style="", skipping any CSS rejects', () => {
    let fromRule = 0, fromInline = 0, fromAttr = 0, skipped = 0;
    fc.assert(fc.property(
      fc.option(value, { nil: undefined }), fc.array(rule, { maxLength: 4 }), fc.array(decl, { maxLength: 2 }),
      (attr, rules, inline) => {
        const candidates: { v: Value; w: number[]; origin: string }[] = [];
        if (attr) candidates.push({ v: attr, w: weight('attr', false, 0, 0), origin: 'attr' });
        rules.forEach((r, i) => candidates.push({ v: r.d.v, w: weight('rule', r.d.important, SELECTORS[r.selector]!, i), origin: 'rule' }));
        inline.forEach((d, i) => candidates.push({ v: d.v, w: weight('inline', d.important, 0, i), origin: 'inline' }));
        let best: (typeof candidates)[number] | undefined;
        for (const c of candidates) {
          if (!c.v.valid) { skipped++; continue; }
          if (!best || later(c.w, best.w)) best = c;
        }
        const want = best ? (best.v.text === 'none' ? 'none' : HEX[best.v.text]!) : '#000000';
        if (best?.origin === 'rule') fromRule++;
        if (best?.origin === 'inline') fromInline++;
        if (best?.origin === 'attr') fromAttr++;

        const css = rules.map((r) => `${r.selector} { fill: ${r.d.v.text}${r.d.important ? ' !important' : ''} }`).join('\n');
        const style = inline.map((d) => `fill: ${d.v.text}${d.important ? ' !important' : ''}`).join('; ');
        const xml = '<svg xmlns="http://www.w3.org/2000/svg">'
          + (css ? `<style>${escapeText(css)}</style>` : '')
          + `<rect id="r" class="a b" width="4" height="4"${attr ? ` fill="${escapeAttr(attr.text)}"` : ''}`
          + `${style ? ` style="${escapeAttr(style)}"` : ''}/></svg>`;
        expect(read(paintOf(parseSvg(xml).nodes)), xml).toBe(want);
      },
    ), runs(N));
    for (const n of [fromRule, fromInline, fromAttr, skipped]) expect(n).toBeGreaterThan(runs(N).numRuns / 20);
  }, timeoutFor(N, 20));

  const fillKw = fc.oneof(
    { weight: 3, arbitrary: colorText },
    { weight: 1, arbitrary: fc.constantFrom('none', 'inherit', 'initial', 'currentColor', 'unset') },
  );
  const colorKw = fc.oneof({ weight: 3, arbitrary: colorText }, { weight: 1, arbitrary: fc.constantFrom('inherit', 'currentColor', 'initial') });
  const level = fc.record({
    fill: fc.option(fillKw, { nil: undefined }),
    color: fc.option(colorKw, { nil: undefined }),
    inStyle: fc.boolean(),
  });

  it('inherits fill and color down any chain of groups, currentColor used as each element\'s own color', () => {
    let current = 0, inherited = 0;
    fc.assert(fc.property(fc.array(level, { minLength: 1, maxLength: 5 }), (levels) => {
      // Computed values, root first: `fill` keeps `currentColor` as a keyword, `color` is a color.
      let fill = 'black', color = 'black';
      for (const l of levels) {
        if (l.color !== undefined && l.color !== 'inherit' && l.color !== 'currentColor') color = l.color === 'initial' ? 'black' : l.color;
        if (l.fill !== undefined && l.fill !== 'inherit' && l.fill !== 'unset') fill = l.fill === 'initial' ? 'black' : l.fill;
      }
      const leaf = levels[levels.length - 1]!;
      if (fill === 'currentColor') current++;
      if (leaf.fill === undefined || leaf.fill === 'inherit') inherited++;
      const used = fill === 'currentColor' ? color : fill;
      const want = used === 'none' ? 'none' : used === 'black' ? '#000000' : HEX[used]!;

      const attrs = (l: (typeof levels)[number]): string => {
        const decls = [['fill', l.fill], ['color', l.color]].filter((d): d is [string, string] => d[1] !== undefined);
        if (decls.length === 0) return '';
        return l.inStyle
          ? ` style="${escapeAttr(decls.map(([k, v]) => `${k}: ${v}`).join('; '))}"`
          : decls.map(([k, v]) => ` ${k}="${escapeAttr(v)}"`).join('');
      };
      const open = levels.slice(0, -1).map((l) => `<g${attrs(l)}>`).join('');
      const close = '</g>'.repeat(levels.length - 1);
      const xml = `<svg xmlns="http://www.w3.org/2000/svg">${open}<rect width="4" height="4"${attrs(leaf)}/>${close}</svg>`;
      expect(read(paintOf(parseSvg(xml).nodes)), xml).toBe(want);
    }), runs(N));
    expect(current).toBeGreaterThan(runs(N).numRuns / 50);
    expect(inherited).toBeGreaterThan(runs(N).numRuns / 10);
  }, timeoutFor(N, 20));
});
