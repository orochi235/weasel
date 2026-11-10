/**
 * fast-check arbitraries shared by diagram-formats' property tests. Test-only: nothing in the package imports it.
 */
import fc from 'fast-check';
import type { DataContainer, DataEdge, DataNode, DiagramData } from '@weasel-js/diagram';
import type { DiagramDocument, GraphPage } from './document';

/** `{ numRuns: n }`, or the count in `WEASEL_PBT_RUNS` when set: a deep run on the fleet raises every property's at once. */
export function runs(n: number): { numRuns: number } {
  const deep = Number(globalThis.process?.env?.WEASEL_PBT_RUNS);
  return { numRuns: deep > 0 ? deep : n };
}

/** A test timeout for a property costing about `msPerRun` a run, at the count {@link runs} settles on. */
export function timeoutFor(n: number, msPerRun: number): number {
  return Math.max(5_000, runs(n).numRuns * msPerRun);
}

/** Characters every text format treats as syntax somewhere, beside letters, digits, and other scripts. */
const ODD = [
  ...'abcXYZ019 _-.', '"', '\\', "'", '`', '|', '[', ']', '(', ')', '{', '}', '<', '>', '&', '#', ';', ':', ',', '=', '%',
  '/', '*', '+', '@', '!', '?', '~', '^', '$', '\t', 'é', 'ß', '中', 'א', '😀', ' ', '​',
];

/** Words a reader of one format or another reads as a keyword, an entity, an escape, or an operator. */
const WORDS = [
  'end', 'subgraph', 'graph', 'flowchart', 'node', 'edge', 'digraph', 'strict', 'class', 'classDef', 'style', 'default',
  'direction', 'click', 'linkStyle', 'state', 'note', 'Note', '&amp;', '&lt;', '&#65;', '#35;', '#quot;', '<br>', '<b>x</b>',
  '\\N', '\\n', '\\l', '\\"', '-->', '---', '==>', '-.->', '%%', '%%{init}%%', '[*]', '<<fork>>', '::', ':::', 'TD', 'LR',
];

/** Text drawn from {@link ODD} with {@link WORDS} mixed in. */
export const oddText: fc.Arbitrary<string> = fc.array(
  fc.oneof({ weight: 4, arbitrary: fc.constantFrom(...ODD) }, { weight: 1, arbitrary: fc.constantFrom(...WORDS) }),
  { maxLength: 8 },
).map((parts) => parts.join(''));

/** A non-empty id: a plain name most of the time, else odd text or a keyword. */
export const idText: fc.Arbitrary<string> = fc.oneof(
  { weight: 3, arbitrary: fc.stringMatching(/^[a-z][a-z0-9_]{0,5}$/) },
  { weight: 1, arbitrary: fc.constantFrom(...WORDS) },
  { weight: 2, arbitrary: oddText.filter((s) => s !== '') },
);

/** Outlines every graph format has a shape for. */
export const OUTLINES = ['rect', 'roundRect', 'stadium', 'diamond', 'ellipse', 'hexagon', 'parallelogram', 'trapezoid'] as const;

export interface GraphShape {
  /** Placed, so a writer that lays out an unplaced page never runs layout. */
  placed?: boolean;
  /** Containers, nested, holding some of the nodes. */
  containers?: boolean;
  /** Text at edges' ends. */
  endLabels?: boolean;
  /** Compass ports at edges' ends. */
  ports?: boolean;
}

/** A graph page's data: unique ids, each node's lines and outline, edges between nodes with labels, and what `shape` adds. */
export function graphData(shape: GraphShape = {}): fc.Arbitrary<DiagramData> {
  const { placed = false, containers = false, endLabels = false, ports = false } = shape;
  return fc.tuple(fc.uniqueArray(idText, { minLength: 1, maxLength: containers ? 9 : 6 }), fc.nat()).chain(([all, split]) => {
    const regionCount = containers ? Math.min(split % 4, all.length - 1) : 0;
    const ids = all.slice(0, all.length - regionCount);
    const regionIds = all.slice(all.length - regionCount);
    const node = (id: string, i: number): fc.Arbitrary<DataNode> => fc.record({
      lines: fc.array(oddText, { maxLength: 3 }),
      outline: fc.constantFrom(...OUTLINES),
    }).map(({ lines, outline }) => ({
      id, lines, outline,
      ...(placed ? { at: { x: 40 + 120 * i, y: 40 + 60 * (i % 3) }, width: 100, height: 40 } : {}),
    }));
    const end = fc.constantFrom(...ids);
    const port = ports ? fc.option(fc.constantFrom('n', 'e', 's', 'w'), { nil: undefined }) : fc.constant(undefined);
    const endText = endLabels ? fc.option(oddText.filter((t) => t !== ''), { nil: undefined }) : fc.constant(undefined);
    const edge: fc.Arbitrary<DataEdge> = fc.record({
      from: end, to: end, label: fc.option(oddText, { nil: undefined }),
      fromPort: port, toPort: port, tail: endText, head: endText,
    }).map(({ from, to, label, fromPort, toPort, tail, head }) => ({
      from, to,
      ...(fromPort !== undefined ? { fromPort } : {}),
      ...(toPort !== undefined ? { toPort } : {}),
      ...(label !== undefined ? { label } : {}),
      ...(tail !== undefined || head !== undefined
        ? { endLabels: { ...(tail !== undefined ? { from: tail } : {}), ...(head !== undefined ? { to: head } : {}) } } : {}),
    }));
    // Each node and region sits in one region before it in this list, or at the top (-1).
    const owner = (i: number) => fc.integer({ min: -1, max: Math.max(-1, Math.min(i, regionIds.length) - 1) });
    const regions = fc.tuple(
      fc.tuple(...regionIds.map((_, i) => fc.tuple(owner(i), fc.option(oddText, { nil: undefined })))),
      fc.tuple(...ids.map(() => owner(regionIds.length))),
    ).map(([regionOwners, nodeOwners]): DataContainer[] => regionIds.map((id, r) => {
      const members = [
        ...ids.filter((_, i) => nodeOwners[i] === r),
        ...regionIds.filter((_, k) => regionOwners[k]![0] === r),
      ];
      const label = regionOwners[r]![1];
      return { id, role: 'container', ...(label !== undefined ? { label } : {}), ...(members.length > 0 ? { members } : {}) };
    }));
    return fc.tuple(fc.tuple(...ids.map(node)), fc.array(edge, { maxLength: 6 }), regions)
      .map(([nodes, edges, cs]): DiagramData => ({ nodes, edges, ...(cs.length > 0 ? { containers: cs } : {}) }));
  });
}

/** A one-page document around `data`. */
export const docOf = (data: DiagramData, extra: Partial<Omit<GraphPage, 'kind' | 'data'>> = {}): DiagramDocument =>
  ({ pages: [{ kind: 'graph', id: 'p', width: 800, height: 600, data, ...extra }], theme: 'paper' });

/** Text shaped like a source file of some format: lines of format-ish tokens joined by format-ish separators. */
export function tokenSoup(tokens: readonly string[]): fc.Arbitrary<string> {
  return fc.array(
    fc.array(fc.oneof(fc.constantFrom(...tokens), oddText, fc.constantFrom(' ', '  ', '\t')), { maxLength: 8 }).map((t) => t.join('')),
    { maxLength: 8 },
  ).map((lines) => lines.join('\n'));
}

/** What running `f` does: its value, or the message of the `Error` it throws. Anything thrown that is not an `Error` is rethrown. */
export function outcome<T>(f: () => T): { value: T } | { error: string } {
  try {
    return { value: f() };
  } catch (e) {
    if (!(e instanceof Error)) throw e;
    return { error: e.message };
  }
}
