/**
 * Property tests of the eligibility algebra: `rulesExclusive` and `ruleCanHoldIn` are proofs, so each is
 * checked against `evaluate` over every context the rules can tell apart; `evaluate`'s connectives against
 * their boolean meaning; `describeRule` on any tree.
 */
import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import type { ActiveMode } from '@weasel-js/modes';
import type { DeviceProfile, ModifierState, NodeId } from '../vocabulary';
import { runs, tally, timeoutFor } from '../pbt.fixture';
import { describeRule, evaluate, type Rule, type Selector } from './rule';
import { ruleCanHoldIn, rulesExclusive } from './exclusive';
import type { RuleCtx } from './ruleCtx';

const MODES = ['m1', 'm2', 'm3'] as const;
const TAGS = ['c1', 'c2', 'c3'] as const;
const KINDS = ['k1', 'k2'] as const;
const MOD_KEYS = ['alt', 'ctrl', 'meta', 'shift'] as const;

const bool = fc.boolean();
const selectorFields: { [K in keyof Selector]-?: fc.Arbitrary<Selector[K]> } = {
  selection: fc.record({ is: fc.integer({ min: 0, max: 3 }), atLeast: fc.integer({ min: 0, max: 3 }), empty: bool }, { requiredKeys: [] }),
  mode: fc.oneof(
    fc.constantFrom(...MODES),
    fc.constantFrom(...MODES).map((not) => ({ not })),
    fc.subarray([...MODES]).map((m) => ({ in: m })),
  ),
  capability: fc.oneof(
    fc.constantFrom(...TAGS),
    fc.subarray([...TAGS]),
    fc.subarray([...TAGS]).map((t) => ({ in: t })),
    fc.constantFrom(...TAGS).map((not) => ({ not })),
  ),
  gesturing: bool,
  actionIs: fc.constantFrom(...KINDS),
  modifierHeld: fc.constantFrom(...MOD_KEYS),
  focused: bool,
  hovering: bool,
  hoveringSelected: bool,
  zoomAtLeast: fc.constantFrom(0.5, 1, 2),
  editingAnchors: bool,
  resizable: bool,
  coarsePointer: bool,
  canHover: bool,
};
/** A selector testing up to two fields. */
const selector: fc.Arbitrary<Selector> = fc.array(
  fc.oneof(...Object.entries(selectorFields).map(([k, arb]) => (arb as fc.Arbitrary<unknown>).map((v) => ({ [k]: v })))),
  { maxLength: 2 },
).map((parts) => Object.assign({}, ...parts) as Selector);

const rule: fc.Arbitrary<Rule> = fc.letrec<{ rule: Rule }>((tie) => ({
  rule: fc.oneof(
    { depthSize: 'small', withCrossShrink: true },
    selector,
    fc.array(tie('rule'), { maxLength: 2 }).map((all) => ({ all })),
    fc.array(tie('rule'), { maxLength: 2 }).map((any) => ({ any })),
    tie('rule').map((not) => ({ not })),
  ),
})).rule;

/** The context dimensions each selector key reads. */
const DIMS_OF: Record<keyof Selector, readonly Dim[]> = {
  selection: ['selection'], mode: ['mode'], capability: ['caps'], gesturing: ['action'], actionIs: ['action'],
  modifierHeld: ['modifiers'], focused: ['focused'], hovering: ['hover'], hoveringSelected: ['hover', 'selection'],
  zoomAtLeast: ['zoom'], editingAnchors: ['editingAnchors'], resizable: ['resizable'], coarsePointer: ['device'],
  canHover: ['device'],
};

type Dim = 'selection' | 'mode' | 'caps' | 'action' | 'modifiers' | 'focused' | 'hover' | 'zoom' | 'editingAnchors' | 'resizable' | 'device';

const ids = (n: number) => ['a', 'b', 'c'].slice(0, n) as NodeId[];
const device = (coarsePointer: boolean, canHover: boolean): DeviceProfile => ({ coarsePointer, canHover, dpr: 1, targetScale: 1 });
const subsets = <T>(xs: readonly T[]): T[][] => xs.reduce<T[][]>((acc, x) => [...acc, ...acc.map((s) => [...s, x])], [[]]);

const VALUES: { [D in Dim]: readonly Partial<RuleCtx>[] } = {
  selection: [0, 1, 2, 3].map((n) => ({ selection: ids(n) })),
  mode: MODES.map((mode) => ({ mode })),
  caps: subsets(TAGS).map((s) => ({ allowedCapabilities: new Set(s) })),
  action: [null, ...KINDS].map((kind) => ({ action: { kind, id: kind } })),
  modifiers: Array.from({ length: 16 }, (_, i) => ({
    modifiers: { alt: (i & 1) !== 0, ctrl: (i & 2) !== 0, meta: (i & 4) !== 0, shift: (i & 8) !== 0 } satisfies ModifierState,
  })),
  focused: [{ focused: false }, { focused: true }],
  hover: [null, 'a', 'z'].map((hover) => ({ hover: hover as NodeId | null })),
  zoom: [undefined, 0.5, 1, 2].map((zoom) => ({ zoom })),
  editingAnchors: [undefined, false, true].map((editingAnchors) => ({ editingAnchors })),
  resizable: [undefined, false, true].map((selectionResizable) => ({ selectionResizable })),
  device: [undefined, device(false, false), device(false, true), device(true, false), device(true, true)].map((d) => ({ device: d })),
};

const BASE: RuleCtx = {
  focused: false, selection: [], multiActive: false, modifiers: { alt: false, ctrl: false, meta: false, shift: false },
  action: { kind: null, id: null }, hover: null, mode: 'm1', allowedCapabilities: new Set(),
};

function dimsOf(r: Rule, into = new Set<Dim>()): Set<Dim> {
  if ('all' in r) r.all.forEach((x) => dimsOf(x, into));
  else if ('any' in r) r.any.forEach((x) => dimsOf(x, into));
  else if ('not' in r) dimsOf(r.not, into);
  else for (const k of Object.keys(r) as (keyof Selector)[]) for (const d of DIMS_OF[k]) into.add(d);
  return into;
}

const MAX_CONTEXTS = 3000;

/** Every context that differs in the dimensions `dims`, the rest at {@link BASE}; past
 *  {@link MAX_CONTEXTS}, an even spread of them, the corners included. */
function contexts(dims: Iterable<Dim>, base: RuleCtx = BASE): RuleCtx[] {
  const ds = [...dims];
  const total = ds.reduce((n, d) => n * VALUES[d].length, 1);
  const pick = (i: number): RuleCtx => {
    let c = base;
    for (const d of ds) {
      const vs = VALUES[d];
      c = { ...c, ...vs[i % vs.length] };
      i = Math.floor(i / vs.length);
    }
    return c;
  };
  if (total <= MAX_CONTEXTS) return Array.from({ length: total }, (_, i) => pick(i));
  // A stride coprime with the total walks every residue of each dimension.
  let stride = Math.floor(total / MAX_CONTEXTS) + 1;
  const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
  while (gcd(stride, total) !== 1) stride++;
  return Array.from({ length: MAX_CONTEXTS }, (_, i) => pick((i * stride) % total));
}

describe('rulesExclusive', () => {
  it('claims two rules exclusive only when no context passes both', () => {
    const t = tally();
    fc.assert(fc.property(rule, rule, (a, b) => {
      if (!rulesExclusive(a, b)) return;
      t.hit('claimed');
      const both = contexts(new Set([...dimsOf(a), ...dimsOf(b)])).find((c) => evaluate(a, c) && evaluate(b, c));
      expect(both).toBeUndefined();
    }), runs(400));
    t.expectHit('claimed');
  }, timeoutFor(400, 5));

  it('is a proof under every rule it is composed into', () => {
    fc.assert(fc.property(rule, rule, rule, (a, b, c) => {
      if (rulesExclusive(a, b)) {
        expect(rulesExclusive({ all: [a, c] }, b)).toBe(true);
        expect(rulesExclusive(a, { all: [c, b] })).toBe(true);
        expect(rulesExclusive({ any: [a] }, b)).toBe(true);
      }
    }), runs(300));
  }, timeoutFor(300, 2));

  it('proves a rule exclusive with its negation, and the never-rule with anything', () => {
    fc.assert(fc.property(rule, rule, (a, b) => {
      expect(rulesExclusive({ not: a }, a)).toBe(true);
      expect(rulesExclusive(a, { not: a })).toBe(true);
      expect(rulesExclusive({ any: [] }, b)).toBe(true);
    }), runs(300));
  }, timeoutFor(300, 2));
});

describe('ruleCanHoldIn', () => {
  const activeMode = fc.record({ id: fc.constantFrom(...MODES), tags: fc.subarray([...TAGS]) })
    .map(({ id, tags }): ActiveMode => ({ id, allowedCapabilities: new Set(tags) }));

  it('says a rule cannot hold in a mode only when no context in that mode passes it, and says it can when one is settled true', () => {
    const t = tally();
    fc.assert(fc.property(rule, activeMode, (r, mode) => {
      const base: RuleCtx = { ...BASE, mode: mode.id, allowedCapabilities: mode.allowedCapabilities };
      const dims = [...dimsOf(r)].filter((d) => d !== 'mode' && d !== 'caps');
      const passing = contexts(dims, base).some((c) => evaluate(r, c));
      if (!ruleCanHoldIn(r, mode)) {
        t.hit('cannot');
        expect(passing).toBe(false);
      } else if (passing) t.hit('can');
    }), runs(400));
    t.expectHit('cannot', 'can');
  }, timeoutFor(400, 5));
});

describe('evaluate', () => {
  const ctx = fc.constantFrom(...contexts(['selection', 'mode', 'caps', 'focused', 'hover']));

  it('reads all, any, and not as their boolean connectives', () => {
    fc.assert(fc.property(fc.array(rule, { maxLength: 3 }), ctx, (rs, c) => {
      const each = rs.map((r) => evaluate(r, c));
      expect(evaluate({ all: rs }, c)).toBe(each.every(Boolean));
      expect(evaluate({ any: rs }, c)).toBe(each.some(Boolean));
      expect(evaluate({ not: { all: rs } }, c)).toBe(evaluate({ any: rs.map((not) => ({ not })) }, c));
    }), runs(300));
  }, timeoutFor(300, 2));

  it('describes any rule without throwing', () => {
    fc.assert(fc.property(rule, (r) => {
      expect(typeof describeRule(r)).toBe('string');
    }), runs(300));
  }, timeoutFor(300, 1));
});
