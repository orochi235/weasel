import type { PrefCondition, PrefEnum, PrefGroup, PrefList, PrefMap, PrefSection } from '@weasel-js/prefs';
import { testRowOf, type TestRow } from './conditionGroups';
import { conditionLeaves, leafOf, type ConditionLeaf } from './conditionLeaves';
import { clausesOf, COMPARISON_LABEL, operatorOf, printOperators } from './conditionRows';

/** One box of a {@link ConditionFlow}: a test, or where the flow starts and ends. */
export interface ConditionFlowNode {
  id: string;
  /** The pref a test reads, then each comparison it makes of it. */
  lines: readonly string[];
  outline?: 'stadium';
}

/** A path from one box, or one group, to the next. */
export interface ConditionFlowEdge {
  from: string;
  to: string;
}

/** A `not`: the boxes it wraps, passed only where no path through them reaches their end. */
export interface ConditionFlowGroup {
  id: string;
  members: readonly string[];
  label: string;
}

/** A condition as boxes and the paths between them, in the shape `diagramScene` (`@weasel-js/diagram`) takes. */
export interface ConditionFlow {
  nodes: ConditionFlowNode[];
  edges: ConditionFlowEdge[];
  groups: ConditionFlowGroup[];
}

/** How {@link prefConditionFlow} names what it draws. */
export interface ConditionFlowOptions {
  /** The schema `schema` is drawn over, whose prefs a test may read. */
  over?: PrefGroup | PrefSection;
  /** The list or map whose entry the condition's node is drawn in. */
  entryOf?: PrefList | PrefMap;
  /** What the flow's last box says, which is what the condition decides. Default `holds`. */
  holds?: string;
}

/** The id of a flow's first box, which every path starts from. */
export const CONDITION_FLOW_START = 'start';
/** The id of a flow's last box, which a path reaches where the condition holds. */
export const CONDITION_FLOW_END = 'end';

/** A test's box: the pref by its name, and each comparison in the words a row's controls show. */
function testLines({ test, negated }: TestRow, found: ConditionLeaf | undefined): string[] | undefined {
  const where = test.from === 'item' ? 'this entry: ' : '';
  if (!found) return negated ? undefined : [`${where}${test.path}`, printOperators(test)];
  const clauses = clausesOf({ test, negated }, found.leaf);
  if (!clauses) return negated ? undefined : [`${where}${found.leaf.name || test.path}`, printOperators(test)];
  const label = (value: unknown): string =>
    (found.leaf.kind === 'enum' ? (found.leaf as PrefEnum).options.find((o) => o.value === value)?.label : undefined) ?? String(value);
  const words = clauses.map((comparison) => {
    const op = operatorOf(comparison);
    if (op === undefined) return COMPARISON_LABEL[comparison];
    const held = test[op];
    return `${COMPARISON_LABEL[comparison]} ${Array.isArray(held) ? held.map(label).join(', ') : label(held)}`;
  });
  return [`${where}${found.leaf.name || test.path}`, ...words];
}

/**
 * `condition` as a flow from a first box to a last: the condition holds where a path runs between them through
 * tests that hold. The parts of an `all` stand in a line, each after the one before; the parts of an `any` stand
 * side by side, any one of them a way through. A `not` is a group round what it wraps, passed where no path gets
 * through it, but for the ones a single comparison says: is not set, and is none of. An `all` of nothing is the
 * bare path and an `any` of nothing a box nothing leaves, as each evaluates.
 */
export function prefConditionFlow(condition: PrefCondition | undefined, schema: PrefGroup | PrefSection, opts: ConditionFlowOptions = {}): ConditionFlow {
  const leaves = conditionLeaves(schema, opts.entryOf, opts.over);
  const flow: ConditionFlow = { nodes: [{ id: CONDITION_FLOW_START, lines: ['start'], outline: 'stadium' }], edges: [], groups: [] };
  const join = (from: readonly string[], to: string): void => { for (const id of from) flow.edges.push({ from: id, to }); };
  const box = (id: string, lines: readonly string[], entries: readonly string[]): string => {
    flow.nodes.push({ id, lines });
    join(entries, id);
    return id;
  };

  /** Draws `part` after `entries`, and says what a path leaves it by and which of its boxes stand outside any group it made. */
  const draw = (part: PrefCondition, entries: readonly string[], at: string): { exits: string[]; made: string[] } => {
    const row = testRowOf(part);
    const lines = row && testLines(row, leafOf(leaves, row.test));
    if (lines) {
      const id = box(`test:${at}`, lines, entries);
      return { exits: [id], made: [id] };
    }
    if ('not' in part) {
      const inner = draw(part.not, [], `${at}.not`);
      const id = `not:${at}`;
      // Nothing inside to pass or fail: the not of what always holds is a dead end.
      if (inner.made.length === 0) return { exits: [], made: [box(`never:${at}`, ['never'], entries)] };
      flow.groups.push({ id, members: inner.made, label: 'not' });
      join(entries, id);
      return { exits: [id], made: [id] };
    }
    if ('all' in part) {
      let exits = [...entries];
      const made: string[] = [];
      part.all.forEach((each, i) => {
        const drawn = draw(each, exits, `${at}.${i}`);
        exits = drawn.exits;
        made.push(...drawn.made);
      });
      return { exits, made };
    }
    // A test is drawn above, so what is left is an `any`.
    const { any } = part as { any: readonly PrefCondition[] };
    if (any.length === 0) return { exits: [], made: [box(`never:${at}`, ['never'], entries)] };
    const drawn = any.map((each, i) => draw(each, entries, `${at}.${i}`));
    return { exits: drawn.flatMap((d) => d.exits), made: drawn.flatMap((d) => d.made) };
  };

  const { exits } = condition === undefined ? { exits: [CONDITION_FLOW_START] } : draw(condition, [CONDITION_FLOW_START], '0');
  flow.nodes.push({ id: CONDITION_FLOW_END, lines: [opts.holds ?? 'holds'], outline: 'stadium' });
  join(exits, CONDITION_FLOW_END);
  return flow;
}
