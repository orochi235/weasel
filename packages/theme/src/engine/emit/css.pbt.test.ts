/**
 * Property test of `emitCss` against a model of the cascade: an element stamped with a theme and a value on every
 * axis, as `applyTheme` stamps one, takes each custom property from the most specific matching rule, the later on a
 * tie, and expands every `var()`. For random definitions, a default theme and a theme extending it, what the sheet
 * gives each token at each selection is what the baked chain says, written as `cssValue` writes it.
 */
import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { enumerateSelections, type Selection } from '../../axes';
import { tokensAt } from '../../chainTokens';
import type { ThemeDefinition } from '../../definition';
import type { RawToken } from '../../dtcg/types';
import { outcome, runs, tally, timeoutFor } from '../../pbt.fixture';
import { bakeChain } from '../bake';
import { AXES, definition } from '../definition.fixture';
import { axisDependencies } from '../deps';
import type { Lookup } from '../merge';
import { cssValue, emitCss } from './css';

const RUNS = 120;
const SELECTIONS = enumerateSelections(AXES);
const VAR = /var\(--wzl-([\w-]+)\)/g;

interface Rule {
  readonly selectors: readonly string[];
  readonly decls: ReadonlyMap<string, string>;
}

/** The sheet's rules in source order. Comments are dropped; nothing the sheet writes nests. */
function parse(css: string): Rule[] {
  const rules: Rule[] = [];
  let selectors: string[] = [];
  let decls: Map<string, string> | null = null;
  for (const line of css.split('\n')) {
    if (decls === null) {
      if (line.endsWith(',')) selectors.push(line.slice(0, -1));
      else if (line.endsWith(' {')) {
        selectors.push(line.slice(0, -2));
        decls = new Map();
      }
    } else if (line === '}') {
      rules.push({ selectors, decls });
      selectors = [];
      decls = null;
    } else {
      const m = /^ {2}(--wzl-[\w-]+): (.*);$/.exec(line);
      if (m) decls.set(m[1]!, m[2]!);
    }
  }
  return rules;
}

/** The specificity of `selector` on an element with `attrs`, or -1 when it does not match. */
function match(selector: string, attrs: Readonly<Record<string, string>>): number {
  let rest = selector;
  let n = 0;
  if (rest.startsWith(':root')) {
    rest = rest.slice(5);
    n += 1;
  }
  for (const m of rest.matchAll(/\[data-wzl-([\w-]+)='([^'\\]*)'\]/g)) {
    if (attrs[m[1]!] !== m[2]) return -1;
    n += 1;
  }
  return rest.replace(/\[data-wzl-[\w-]+='[^'\\]*'\]/g, '') === '' ? n : -1;
}

/** Each custom property's value on the element, every `var()` expanded; `<unset>` for one nothing declares. */
function computed(rules: readonly Rule[], attrs: Readonly<Record<string, string>>): (name: string) => string {
  const won = new Map<string, { spec: number; value: string }>();
  for (const rule of rules) {
    const spec = Math.max(...rule.selectors.map((s) => match(s, attrs)));
    if (spec < 0) continue;
    for (const [p, v] of rule.decls) if ((won.get(p)?.spec ?? -1) <= spec) won.set(p, { spec, value: v });
  }
  return expander((n) => won.get(`--wzl-${n}`)?.value);
}

function expander(raw: (name: string) => string | undefined): (name: string) => string {
  const expand = (name: string, stack: readonly string[]): string => {
    if (stack.includes(name)) return '<cycle>';
    const v = raw(name);
    return v === undefined ? '<unset>' : v.replace(VAR, (_, n: string) => expand(n, [...stack, name]));
  };
  return (name) => expand(name, []);
}

/** What the baked tokens say each token is at a selection, written as the sheet writes it. */
const expected = (tokens: Readonly<Record<string, RawToken>>) =>
  expander((n) => (Object.hasOwn(tokens, n) ? cssValue(n, tokens[n]!) : undefined));

const pair = fc.tuple(definition('root'), definition('kid')).map(([root, kid]) => {
  const defs: ThemeDefinition[] = [root, { ...kid, extends: 'root' }];
  const lookup: Lookup = (n) => defs.find((d) => d.name === n);
  return { defs, lookup };
});

describe('emitCss against a model of the cascade', () => {
  it('gives every token, at every selection of either theme, the value its baked chain holds there', () => {
    const t = tally();
    fc.assert(fc.property(pair, ({ defs, lookup }) => {
      const inputs = outcome(() => defs.map((d, i) => ({ chain: bakeChain(d, lookup), deps: axisDependencies(d, lookup), isDefault: i === 0 })));
      if (typeof inputs === 'string') return;
      const sheet = emitCss(inputs.map(({ chain, deps, isDefault }) => ({ baked: chain.at(-1)!, deps, isDefault })));
      const rules = parse(sheet);
      for (const { chain } of inputs) {
        const theme = chain.at(-1)!.name;
        for (const sel of SELECTIONS) {
          const tokens = tokensAt(chain, sel);
          const want = expected(tokens);
          const got = computed(rules, { theme, ...(sel as Selection) });
          for (const n of Object.keys(tokens)) {
            if (want(n).includes('<cycle>')) continue;
            // A reference to a token the chain has none of here: the sheet cannot unset it, so it shows the value
            // the token has where it was declared (docs/unruled.md, 2026-11-11). Only a definition with issues does this.
            if (want(n).includes('<unset>')) {
              t.count('unset');
              continue;
            }
            t.count(theme);
            expect({ theme, sel, n, value: got(n) }).toEqual({ theme, sel, n, value: want(n) });
          }
        }
      }
    }), runs(RUNS));
    t.atLeast('root', 1000);
    t.atLeast('kid', 1000);
  }, timeoutFor(RUNS, 150));
});
