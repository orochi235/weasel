import type { PrefEnum, PrefLeaf, PrefTest } from '@weasel-js/prefs';
import type { TestRow } from './conditionGroups';
import type { ConditionLeaf } from './conditionLeaves';

/** A comparison a row offers: one operator of a test, what a bare test means for its leaf's kind, or the `not` of
 *  one where no operator says it. */
export type Comparison = 'on' | 'off' | 'set' | 'unset' | 'is' | 'isNot' | 'in' | 'notIn' | 'above' | 'atLeast' | 'below' | 'atMost';

export const COMPARISON_LABEL: Record<Comparison, string> = {
  on: 'is on',
  off: 'is off',
  set: 'is set',
  unset: 'is not set',
  is: 'is',
  isNot: 'is not',
  in: 'is one of',
  notIn: 'is none of',
  above: 'is above',
  atLeast: 'is at least',
  below: 'is below',
  atMost: 'is at most',
};

const OPERATORS = ['is', 'isNot', 'in', 'above', 'atLeast', 'below', 'atMost'] as const;
type Operator = (typeof OPERATORS)[number];
const BY_KIND: Record<string, readonly Comparison[]> = {
  boolean: ['on', 'off'],
  enum: ['is', 'isNot', 'in', 'notIn'],
  number: ['above', 'atLeast', 'below', 'atMost', 'is', 'isNot'],
};
const OTHER: readonly Comparison[] = ['set', 'unset'];

/** The comparisons a row reading `leaf` offers, by its kind. */
export function comparisonsFor(leaf: PrefLeaf): readonly Comparison[] {
  return Object.hasOwn(BY_KIND, leaf.kind) ? BY_KIND[leaf.kind]! : OTHER;
}

const operatorsOf = (test: PrefTest): Operator[] => OPERATORS.filter((op) => test[op] !== undefined);

/** The operator `comparison` holds its value under; none for one that takes no value. */
export function operatorOf(comparison: Comparison): Operator | undefined {
  if (comparison === 'notIn') return 'in';
  return (OPERATORS as readonly Comparison[]).includes(comparison) ? (comparison as Operator) : undefined;
}

function plainClauses(test: PrefTest, leaf: PrefLeaf): readonly Comparison[] | undefined {
  const ops = operatorsOf(test);
  switch (leaf.kind) {
    case 'boolean':
      if (ops.length === 0) return ['on'];
      return ops.length === 1 && typeof test.is === 'boolean' ? [test.is ? 'on' : 'off'] : undefined;
    case 'enum': {
      const drawn = (op: Operator) => (op === 'in' ? test.in!.every((v) => typeof v === 'string') : (op === 'is' || op === 'isNot') && typeof test[op] === 'string');
      return ops.length > 0 && ops.every(drawn) ? ops : undefined;
    }
    case 'number':
      return ops.length > 0 && ops.every((op) => op !== 'in' && typeof test[op] === 'number') ? ops : undefined;
    default:
      return ops.length === 0 ? ['set'] : undefined;
  }
}

/**
 * The comparisons `row` makes of `leaf`'s value, one for each operator its test holds: a range is two.
 * `undefined` for a row the controls cannot draw, which of the `not`s is every one but none of and not set.
 */
export function clausesOf(row: TestRow, leaf: PrefLeaf): readonly Comparison[] | undefined {
  const plain = plainClauses(row.test, leaf);
  if (!row.negated) return plain;
  if (plain?.length !== 1) return undefined;
  return plain[0] === 'in' ? ['notIn'] : plain[0] === 'set' ? ['unset'] : undefined;
}

const LOWER: readonly Comparison[] = ['above', 'atLeast'];
const UPPER: readonly Comparison[] = ['below', 'atMost'];
/** The comparisons that say the same end of a range as `comparison`, of which a row makes one. */
const sideOf = (comparison: Comparison): readonly Comparison[] =>
  (LOWER.includes(comparison) ? LOWER : UPPER.includes(comparison) ? UPPER : [comparison]);

/**
 * The comparisons clause `at` of `clauses` may become. A row's one clause may be any its leaf's kind offers; one
 * of several may be only what the others do not say, and nothing that takes the whole row: one number, or a `not`.
 */
export function clauseChoices(leaf: PrefLeaf, clauses: readonly Comparison[], at: number): readonly Comparison[] {
  if (clauses.length === 1) return comparisonsFor(leaf);
  const taken = clauses.filter((_, i) => i !== at).flatMap(sideOf);
  return comparisonsFor(leaf).filter((c) => c !== 'notIn' && !(leaf.kind === 'number' && c === 'is') && !taken.includes(c));
}

const optionsOf = (leaf: PrefLeaf): readonly string[] => (leaf.kind === 'enum' ? (leaf as PrefEnum).options.map((o) => o.value) : []);

/** What `test` reads, with no comparison: its path, and where the path is read from. */
export const readOf = ({ path, from }: Pick<PrefTest, 'path' | 'from'>): PrefTest => (from === 'item' ? { from, path } : { path });

const without = (test: PrefTest, op: Operator): PrefTest => {
  const { [op]: _dropped, ...rest } = test;
  return rest;
};

/** `row` with its clause `at` made the comparison `next`, keeping the value it compared against where `next` takes one like it. */
export function withComparison(row: TestRow, leaf: PrefLeaf, next: Comparison, at = 0): TestRow {
  const read = readOf(row.test);
  if (next === 'on' || next === 'off') return { test: { ...read, is: next === 'on' }, negated: false };
  if (next === 'set' || next === 'unset') return { test: read, negated: next === 'unset' };
  const was = clausesOf(row, leaf)?.[at];
  const wasOp = was === undefined ? undefined : operatorOf(was);
  const held = wasOp === undefined ? undefined : row.test[wasOp];
  const rest = wasOp === undefined ? read : without(row.test, wasOp);
  const op = operatorOf(next)!;
  if (leaf.kind === 'number') return { test: { ...rest, [op]: typeof held === 'number' ? held : 0 }, negated: false };
  const picked = (Array.isArray(held) ? held : held === undefined ? optionsOf(leaf).slice(0, 1) : [held]) as string[];
  return { test: { ...rest, [op]: op === 'in' ? picked : picked[0] ?? '' }, negated: next === 'notIn' };
}

/** `row` comparing against `value` in its clause `comparison`. */
export function withValue(row: TestRow, comparison: Comparison, value: PrefTest[Operator]): TestRow {
  return { ...row, test: { ...row.test, [operatorOf(comparison)!]: value } };
}

/** The bound a number's row may take beside the ones in `clauses`, which makes it a range; none once both ends
 *  are bound, or the row holds it to one number. */
export function openBound(leaf: PrefLeaf, clauses: readonly Comparison[]): 'atLeast' | 'atMost' | undefined {
  if (leaf.kind !== 'number' || clauses.includes('is')) return undefined;
  const lower = clauses.some((c) => LOWER.includes(c));
  const upper = clauses.some((c) => UPPER.includes(c));
  if (lower === upper) return undefined;
  return lower ? 'atMost' : 'atLeast';
}

/** `row` with the bound `bound` added, starting at the number its other bound holds. */
export function withBound(row: TestRow, bound: 'atLeast' | 'atMost'): TestRow {
  const other = [...LOWER, ...UPPER].map((c) => row.test[c as Operator]).find((v) => typeof v === 'number');
  return { ...row, test: { ...row.test, [bound]: other ?? 0 } };
}

/** `row` less its clause `comparison`. */
export function withoutClause(row: TestRow, comparison: Comparison): TestRow {
  const op = operatorOf(comparison);
  return op === undefined ? row : { ...row, test: without(row.test, op) };
}

/**
 * A row on the leaf `at`. `was`, the row before it was pointed here, keeps its comparison where the leaf takes it
 * as it stands; anything else starts at the first comparison the leaf's kind offers.
 */
export function rowAt(at: ConditionLeaf, was?: TestRow): TestRow {
  const { leaf } = at;
  const read = readOf(at);
  if (was !== undefined) {
    const { path: _path, from: _from, ...compared } = was.test;
    const moved: TestRow = { test: { ...read, ...compared }, negated: was.negated };
    const options = optionsOf(leaf);
    const values = [moved.test.is, moved.test.isNot, ...(moved.test.in ?? [])].filter((v) => v !== undefined);
    const fits = leaf.kind !== 'enum' || values.every((v) => options.includes(v as string));
    if (fits && operatorsOf(moved.test).length > 0 && clausesOf(moved, leaf) !== undefined) return moved;
  }
  return withComparison({ test: read, negated: false }, leaf, comparisonsFor(leaf)[0]!);
}

const shown = (value: unknown): string => (typeof value === 'string' ? `'${value}'` : String(value));

/** What `test` compares its value against, in words, with no path: `is at least 1 and is below 10`. */
export function printOperators(test: PrefTest): string {
  const ops = operatorsOf(test);
  if (ops.length === 0) return COMPARISON_LABEL.set;
  return ops.map((op) => `${COMPARISON_LABEL[op]} ${op === 'in' ? test.in!.map(shown).join(', ') : shown(test[op])}`).join(' and ');
}
