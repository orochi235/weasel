import {
  isPrefLeaf,
  isPrefSection,
  prefHoldsValue,
  prefSchemaHolding,
  prefSectionLeaves,
  type PrefCondition,
  type PrefEnum,
  type PrefGroup,
  type PrefLeaf,
  type PrefList,
  type PrefMap,
  type PrefObject,
  type PrefSection,
  type PrefTest,
} from '@weasel-js/prefs';

/** How a condition's rows combine. */
export type ConditionMode = 'all' | 'any';

/** A leaf a condition may read, with the path its value is read at: from the schema root, or with `from`, from the
 *  entry the condition's node is drawn in. */
export interface ConditionLeaf {
  path: string;
  leaf: PrefLeaf;
  from?: 'item';
  /** The leaf is one of the schema the condition's is drawn over, and not of its own. */
  over?: true;
}

/** What tells one {@link ConditionLeaf} from another: a field of the entry and a root pref may share a path. */
export const leafKey = ({ path, from }: Pick<ConditionLeaf, 'path' | 'from'>): string => (from === 'item' ? `item\n${path}` : path);

/** The one of `leaves` that `test` reads. */
export function leafOf(leaves: readonly ConditionLeaf[], test: PrefTest): ConditionLeaf | undefined {
  return leaves.find((l) => l.path === test.path && l.from === test.from);
}

/**
 * Every leaf of `schema` that holds a value, a field of an `object` leaf among them, in schema order. With
 * `entryOf`, the list or map whose entry the condition's node is drawn in, the fields of that entry come first,
 * each read from the entry. With `over`, the schema `schema` is drawn over, that schema's leaves come last, less
 * each at a path a leaf of `schema` holds, which a condition reads there.
 */
export function conditionLeaves(schema: PrefGroup | PrefSection, entryOf?: PrefList | PrefMap, over?: PrefGroup | PrefSection): ConditionLeaf[] {
  const out: ConditionLeaf[] = [];
  const add = (path: string, leaf: PrefLeaf, mark: Pick<ConditionLeaf, 'from' | 'over'>): void => {
    if (!prefHoldsValue(leaf)) return;
    if (path !== '' && !(mark.over && prefSchemaHolding(schema, path, over) === schema)) out.push({ path, leaf, ...mark });
    if (leaf.kind !== 'object') return;
    for (const [key, field] of prefSectionLeaves((leaf as PrefObject).children)) add(path === '' ? key : `${path}.${key}`, field, mark);
  };
  // The entry itself is what the node sits in, and no row reads it whole.
  if (entryOf?.item) add('', entryOf.item, { from: 'item' });
  const all = (of: PrefGroup | PrefSection, mark: Pick<ConditionLeaf, 'over'>): void => {
    const walk = (group: PrefGroup, prefix: string): void => {
      for (const [key, child] of Object.entries(group.children)) {
        const path = prefix === '' ? key : `${prefix}.${key}`;
        if (isPrefLeaf(child)) add(path, child, mark);
        else walk(child, path);
      }
    };
    if (isPrefSection(of)) for (const [key, leaf] of prefSectionLeaves(of.members)) add(key, leaf, mark);
    else walk(of, '');
  };
  all(schema, {});
  if (over) all(over, { over: true });
  return out;
}

export const isTest = (condition: PrefCondition): condition is PrefTest =>
  !('all' in condition) && !('any' in condition) && !('not' in condition);

/** `value` as rows: the parts of an `all` or an `any`, or anything else as the one row of an `all`. */
export function conditionParts(value: PrefCondition | undefined): { mode: ConditionMode; parts: readonly PrefCondition[] } {
  if (value === undefined) return { mode: 'all', parts: [] };
  if ('all' in value) return { mode: 'all', parts: value.all };
  if ('any' in value) return { mode: 'any', parts: value.any };
  return { mode: 'all', parts: [value] };
}

/** Rows as a condition: none is no condition, and one under `all` is that row itself. */
export function joinCondition(mode: ConditionMode, parts: readonly PrefCondition[]): PrefCondition | undefined {
  if (parts.length === 0) return undefined;
  if (parts.length === 1 && mode === 'all') return parts[0];
  return mode === 'all' ? { all: parts } : { any: parts };
}

/** A comparison a row offers: one operator of a test, or for a boolean and for any other kind, what a bare test means. */
export type Comparison = 'on' | 'off' | 'set' | 'is' | 'isNot' | 'in' | 'above' | 'atLeast' | 'below' | 'atMost';

export const COMPARISON_LABEL: Record<Comparison, string> = {
  on: 'is on',
  off: 'is off',
  set: 'is set',
  is: 'is',
  isNot: 'is not',
  in: 'is one of',
  above: 'is above',
  atLeast: 'is at least',
  below: 'is below',
  atMost: 'is at most',
};

const OPERATORS = ['is', 'isNot', 'in', 'above', 'atLeast', 'below', 'atMost'] as const;
type Operator = (typeof OPERATORS)[number];
const NUMERIC: readonly Comparison[] = ['above', 'atLeast', 'below', 'atMost', 'is', 'isNot'];
const BY_KIND: Record<string, readonly Comparison[]> = { boolean: ['on', 'off'], enum: ['is', 'isNot', 'in'], number: NUMERIC };
const OTHER: readonly Comparison[] = ['set'];

/** The comparisons a row reading `leaf` offers, by its kind. */
export function comparisonsFor(leaf: PrefLeaf): readonly Comparison[] {
  return Object.hasOwn(BY_KIND, leaf.kind) ? BY_KIND[leaf.kind]! : OTHER;
}

const operatorsOf = (test: PrefTest): Operator[] => OPERATORS.filter((op) => test[op] !== undefined);

/** Which of `leaf`'s comparisons `test` is; `undefined` for a test a row's controls cannot draw, such as a range. */
export function comparisonOf(test: PrefTest, leaf: PrefLeaf): Comparison | undefined {
  const ops = operatorsOf(test);
  const op = ops.length === 1 ? ops[0]! : undefined;
  switch (leaf.kind) {
    case 'boolean':
      if (ops.length === 0) return 'on';
      return op === 'is' && typeof test.is === 'boolean' ? (test.is ? 'on' : 'off') : undefined;
    case 'enum':
      if (op === 'in') return test.in!.every((v) => typeof v === 'string') ? 'in' : undefined;
      return (op === 'is' || op === 'isNot') && typeof test[op] === 'string' ? op : undefined;
    case 'number':
      return op !== undefined && op !== 'in' && typeof test[op] === 'number' ? op : undefined;
    default:
      return ops.length === 0 ? 'set' : undefined;
  }
}

const optionsOf = (leaf: PrefLeaf): readonly string[] => (leaf.kind === 'enum' ? (leaf as PrefEnum).options.map((o) => o.value) : []);

/** What `test` reads, with no comparison: its path, and where the path is read from. */
export const readOf = ({ path, from }: Pick<PrefTest, 'path' | 'from'>): PrefTest => (from === 'item' ? { from, path } : { path });

/** `test` as the comparison `next` of `leaf`'s, keeping the value it compared against where `next` takes one like it. */
export function withComparison(test: PrefTest, leaf: PrefLeaf, next: Comparison): PrefTest {
  const read = readOf(test);
  if (next === 'on' || next === 'off') return { ...read, is: next === 'on' };
  if (next === 'set') return read;
  const op = comparisonOf(test, leaf);
  const held = op === undefined || op === 'on' || op === 'off' || op === 'set' ? undefined : test[op];
  if (leaf.kind === 'number') return { ...read, [next]: typeof held === 'number' ? held : 0 };
  const picked = (Array.isArray(held) ? held : held === undefined ? optionsOf(leaf).slice(0, 1) : [held]) as string[];
  return next === 'in' ? { ...read, in: picked } : { ...read, [next]: picked[0] ?? '' };
}

/**
 * A test of the leaf `at`. `was`, the test a row held before it was pointed here, keeps its comparison where
 * the leaf takes it as it stands; anything else starts at the first comparison the leaf's kind offers.
 */
export function testOf(at: ConditionLeaf, was?: PrefTest): PrefTest {
  const { leaf } = at;
  const read = readOf(at);
  if (was !== undefined) {
    const { path: _path, from: _from, ...compared } = was;
    const moved: PrefTest = { ...read, ...compared };
    const options = optionsOf(leaf);
    const values = [moved.is, moved.isNot, ...(moved.in ?? [])].filter((v) => v !== undefined);
    const fits = leaf.kind !== 'enum' || values.every((v) => options.includes(v as string));
    if (fits && operatorsOf(moved).length > 0 && comparisonOf(moved, leaf) !== undefined) return moved;
  }
  return withComparison(read, leaf, comparisonsFor(leaf)[0]!);
}

const shown = (value: unknown): string => (typeof value === 'string' ? `'${value}'` : String(value));

/** What `test` compares its value against, in words, with no path: `is at least 1 and is below 10`. */
export function printOperators(test: PrefTest): string {
  const ops = operatorsOf(test);
  if (ops.length === 0) return COMPARISON_LABEL.set;
  return ops.map((op) => `${COMPARISON_LABEL[op]} ${op === 'in' ? test.in!.map(shown).join(', ') : shown(test[op])}`).join(' and ');
}

/** `condition` in words, for a row that shows one it has no controls for. */
export function printCondition(condition: PrefCondition): string {
  const inner = (part: PrefCondition): string => (isTest(part) || 'not' in part ? printCondition(part) : `(${printCondition(part)})`);
  if ('all' in condition) return condition.all.length === 0 ? 'always' : condition.all.map(inner).join(' and ');
  if ('any' in condition) return condition.any.length === 0 ? 'never' : condition.any.map(inner).join(' or ');
  if ('not' in condition) return `not (${printCondition(condition.not)})`;
  return `${condition.from === 'item' ? "entry's " : ''}${condition.path} ${printOperators(condition)}`;
}
