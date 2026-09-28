import type { ActiveMode, CapabilityTag } from '@weasel-js/modes';
import { checkCapability, checkMode, isAllRule, isAnyRule, isNotRule, isWhenRule, type Rule, type Selector } from './rule';

/**
 * Whether two rules can never hold at once — no `RuleCtx` passes both.
 *
 * Conservative: `true` is a proof, `false` means "may overlap". It reasons
 * about the selector values themselves (two different `mode`s, an empty
 * selection against a non-empty one, `focused: true` against `false`) and
 * through `all` / `any` / `not`; a `when` closure is opaque, so it overlaps
 * everything. The route-conflict check uses it to stay quiet about bindings
 * that share a tuple but are never eligible together.
 */
export function rulesExclusive(a: Rule, b: Rule): boolean {
  if (isAllRule(a)) return a.all.some((r) => rulesExclusive(r, b));
  if (isAllRule(b)) return b.all.some((r) => rulesExclusive(a, r));
  if (isAnyRule(a)) return a.any.every((r) => rulesExclusive(r, b));
  if (isAnyRule(b)) return b.any.every((r) => rulesExclusive(a, r));
  if (isNotRule(a)) return rulesEqual(a.not, b);
  if (isNotRule(b)) return rulesEqual(b.not, a);
  if (isWhenRule(a) || isWhenRule(b)) return false;
  return selectorsExclusive(a, b);
}

/**
 * Whether `rule` can hold while `mode` is active. Only its `mode` and
 * `capability` tests are settled by the mode; every other test could go either
 * way, so `false` is a proof and `true` means "may hold".
 */
export function ruleCanHoldIn(rule: Rule, mode: ActiveMode): boolean {
  return decideIn(rule, mode) !== false;
}

/** Three-valued: `undefined` when the mode alone does not settle the rule. */
function decideIn(rule: Rule, mode: ActiveMode): boolean | undefined {
  if (isAllRule(rule)) return all3(rule.all.map((r) => decideIn(r, mode)));
  if (isAnyRule(rule)) {
    const parts = rule.any.map((r) => decideIn(r, mode));
    if (parts.includes(true)) return true;
    return parts.every((p) => p === false) ? false : undefined;
  }
  if (isNotRule(rule)) {
    const inner = decideIn(rule.not, mode);
    return inner === undefined ? undefined : !inner;
  }
  if (isWhenRule(rule)) return undefined;
  const ctx = { mode: mode.id, allowedCapabilities: mode.allowedCapabilities as ReadonlySet<CapabilityTag> };
  const settled = [
    rule.mode === undefined ? true : checkMode(rule.mode, ctx),
    rule.capability === undefined ? true : checkCapability(rule.capability, ctx),
  ];
  const { mode: _m, capability: _c, ...rest } = rule;
  void _m; void _c;
  return all3([...settled, Object.keys(rest).length > 0 ? undefined : true]);
}

function all3(parts: readonly (boolean | undefined)[]): boolean | undefined {
  if (parts.includes(false)) return false;
  return parts.every((p) => p === true) ? true : undefined;
}

const BOOLEAN_KEYS = [
  'gesturing', 'focused', 'hovering', 'hoveringSelected', 'editingAnchors',
  'resizable', 'coarsePointer', 'canHover',
] as const satisfies readonly (keyof Selector)[];

function selectorsExclusive(a: Selector, b: Selector): boolean {
  for (const key of BOOLEAN_KEYS) {
    if (a[key] !== undefined && b[key] !== undefined && a[key] !== b[key]) return true;
  }
  if (a.actionIs !== undefined && b.actionIs !== undefined && a.actionIs !== b.actionIs) return true;
  // `actionIs` holds only while some action runs.
  if (a.actionIs !== undefined && b.gesturing === false) return true;
  if (b.actionIs !== undefined && a.gesturing === false) return true;
  if (a.mode !== undefined && b.mode !== undefined && modesExclusive(a.mode, b.mode)) return true;
  if (a.selection && b.selection && selectionsExclusive(a.selection, b.selection)) return true;
  if (a.capability !== undefined && b.capability !== undefined
    && capabilitiesExclusive(a.capability, b.capability)) return true;
  return false;
}

type ModeSet = { in: ReadonlySet<string> } | { notIn: ReadonlySet<string> };

function modeSet(m: NonNullable<Selector['mode']>): ModeSet {
  if (typeof m === 'string') return { in: new Set([m]) };
  if ('not' in m) return { notIn: new Set([m.not]) };
  return { in: new Set(m.in) };
}

function modesExclusive(a: NonNullable<Selector['mode']>, b: NonNullable<Selector['mode']>): boolean {
  const x = modeSet(a);
  const y = modeSet(b);
  if ('in' in x && 'in' in y) return ![...x.in].some((m) => y.in.has(m));
  if ('in' in x && 'notIn' in y) return [...x.in].every((m) => y.notIn.has(m));
  if ('notIn' in x && 'in' in y) return [...y.in].every((m) => x.notIn.has(m));
  // Two exclusions always leave some mode both allow.
  return false;
}

/** The selection-length interval a `selection` selector admits. */
function selectionRange(s: NonNullable<Selector['selection']>): [number, number] {
  let lo = 0;
  let hi = Infinity;
  if (s.empty === true) hi = 0;
  if (s.empty === false) lo = 1;
  if (s.is !== undefined) { lo = Math.max(lo, s.is); hi = Math.min(hi, s.is); }
  if (s.atLeast !== undefined) lo = Math.max(lo, s.atLeast);
  return [lo, hi];
}

function selectionsExclusive(
  a: NonNullable<Selector['selection']>,
  b: NonNullable<Selector['selection']>,
): boolean {
  const [alo, ahi] = selectionRange(a);
  const [blo, bhi] = selectionRange(b);
  return Math.max(alo, blo) > Math.min(ahi, bhi);
}

/** Tags a capability selector requires, and the one it forbids. */
function capabilityTerms(c: NonNullable<Selector['capability']>): {
  requires: readonly CapabilityTag[];
  forbids?: CapabilityTag;
} {
  if (typeof c === 'string') return { requires: [c] };
  if (Array.isArray(c)) return { requires: c };
  if ('not' in c) return { requires: [], forbids: c.not };
  // `{ in }` requires any one of its tags, so no single tag is required.
  return { requires: [] };
}

function capabilitiesExclusive(
  a: NonNullable<Selector['capability']>,
  b: NonNullable<Selector['capability']>,
): boolean {
  const x = capabilityTerms(a);
  const y = capabilityTerms(b);
  return (x.forbids !== undefined && y.requires.includes(x.forbids))
    || (y.forbids !== undefined && x.requires.includes(y.forbids));
}

/** Structural equality over rule trees; a `when` closure matches only itself. */
function rulesEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== 'object' || typeof b !== 'object' || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const ka = Object.keys(a);
  const kb = Object.keys(b);
  if (ka.length !== kb.length) return false;
  return ka.every((k) => rulesEqual((a as Record<string, unknown>)[k], (b as Record<string, unknown>)[k]));
}
