/**
 * A Mermaid state diagram as a one-page document: states as rounded boxes,
 * `[*]` as each scope's `start` and `end`, forks and joins as `bar`s, choices
 * as diamonds, composite states as containers (a pool of lanes when `--`
 * divides them into concurrent regions), and notes as `note` shapes.
 */
import type { DataContainer, DataEdge, DataNode, LayoutDirection } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Membership, Warnings, decodeEntities, graphPage } from '../../graphRead';
import { DIRECTIONS } from '../class/read';
import { pageNameOf } from '../common/lines';
import { StyleSheet } from '../common/styles';
import { parseStateDiagram, type StateStmt, type StateType } from './parse';

/** The id `[*]` reads as in `scope`: its start where a transition leaves it, its end where one arrives. */
export const pseudoId = (scope: string | null, end: 'start' | 'end'): string => `${scope ?? ''}[${end}]`;

interface StateDraft { lines: string[]; named: boolean; described: boolean; type?: StateType | 'start' | 'end' }

/** A fork or join bar's box, across the way the page runs. */
const barSize = (direction: LayoutDirection | undefined) =>
  (direction === 'left' || direction === 'right' ? { width: 10, height: 80 } : { width: 80, height: 10 });

class StateReader {
  readonly warnings = new Warnings();
  readonly styles = new StyleSheet(this.warnings);
  readonly membership = new Membership(this.warnings, 'Mermaid');
  readonly states = new Map<string, StateDraft>();
  readonly composites = new Map<string, { label?: string; lanes: string[] }>();
  readonly edges: DataEdge[] = [];
  readonly notes: DataNode[] = [];
  readonly noteEdges: DataEdge[] = [];
  direction: string | undefined;

  constructor(readonly compositeIds: ReadonlySet<string>) {}

  draft(id: string, scope: string | null): StateDraft {
    if (this.compositeIds.has(id)) return { lines: [], named: false, described: false };
    let d = this.states.get(id);
    if (d === undefined) {
      d = { lines: [id], named: false, described: false };
      this.states.set(id, d);
    }
    this.membership.place(id, scope);
    return d;
  }

  end(id: string, scope: string | null, end: 'start' | 'end'): string {
    if (id !== '[*]') {
      this.draft(id, scope);
      return id;
    }
    const pseudo = pseudoId(scope, end);
    this.draft(pseudo, scope).type = end;
    return pseudo;
  }

  walk(stmts: readonly StateStmt[], scope: string | null): void {
    for (const s of stmts) {
      if (s.kind === 'transition') {
        const from = this.end(s.from, scope, 'start');
        const to = this.end(s.to, scope, 'end');
        this.edges.push({ from, to, ...(s.label !== undefined ? { label: decodeEntities(s.label, true) } : {}) });
      } else if (s.kind === 'state') {
        const d = this.draft(s.id, scope);
        if (s.label !== undefined) Object.assign(d, { lines: [decodeEntities(s.label, true)], named: true });
        if (s.type !== undefined) d.type = s.type;
      } else if (s.kind === 'describe') this.describe(s.id, s.text, scope);
      else if (s.kind === 'composite') this.composite(s, scope);
      else if (s.kind === 'note') this.note(s, scope);
      else if (s.kind === 'assign') this.styles.assign(s.id, s.name);
      else if (s.kind === 'direction') {
        if (scope === null) this.direction = s.value;
        else this.warnings.add('Mermaid composite state directions were dropped; the page runs one way.');
      } else if (s.kind === 'style') this.styles.statement(s.text);
      else this.warnings.list('Mermaid statements a diagram does not hold were dropped', s.keyword);
    }
  }

  describe(id: string, text: string, scope: string | null): void {
    const comp = this.composites.get(id);
    if (comp !== undefined) {
      comp.label = text;
      return;
    }
    const d = this.draft(id, scope);
    const line = decodeEntities(text, true);
    if (d.named || d.described) d.lines.push(line);
    else d.lines = [line];
    d.described = true;
  }

  composite(s: Extract<StateStmt, { kind: 'composite' }>, scope: string | null): void {
    this.membership.openCluster(s.id, scope);
    const comp = this.composites.get(s.id) ?? { lanes: [] };
    if (s.label !== undefined) comp.label = s.label;
    this.composites.set(s.id, comp);
    if (s.regions.length === 1) {
      this.walk(s.regions[0]!, s.id);
      return;
    }
    s.regions.forEach((region, i) => {
      const lane = `${s.id}-region-${i + 1}`;
      comp.lanes.push(lane);
      this.membership.openCluster(lane, s.id);
      this.walk(region, lane);
    });
  }

  note(s: Extract<StateStmt, { kind: 'note' }>, scope: string | null): void {
    const id = `note-${this.notes.length + 1}`;
    if (s.side === 'left') this.warnings.add('Mermaid note sides were dropped.');
    this.notes.push({ id, outline: 'note', lines: s.text.split('\n').map((l) => decodeEntities(l, true)) });
    this.draft(s.id, scope);
    this.noteEdges.push({ from: id, to: s.id, colors: { dash: [4, 4], markerEnd: null } });
  }

  node(id: string, d: StateDraft, direction: LayoutDirection | undefined): DataNode {
    const colors = this.styles.colorsOf(id);
    const own = colors !== undefined ? { colors } : {};
    if (d.type === 'start' || d.type === 'end') return { id, outline: d.type, lines: [], width: 20, height: 20, ...own };
    if (d.type === 'fork' || d.type === 'join') return { id, outline: 'bar', lines: [], ...barSize(direction), ...own };
    if (d.type === 'choice') return { id, outline: 'diamond', lines: [], width: 28, height: 28, ...own };
    return { id, outline: 'roundRect', lines: d.lines, ...own };
  }
}

function compositeIdsOf(stmts: readonly StateStmt[], out = new Set<string>()): Set<string> {
  for (const s of stmts) if (s.kind === 'composite') for (const region of s.regions) compositeIdsOf(region, out.add(s.id));
  return out;
}

/** Reads a Mermaid state diagram into a one-page document of `notation` `'state'`. Throws, naming the line, on text that is not one. */
export function readStateDiagram(text: string): ImportResult {
  const { source, stmts } = parseStateDiagram(text);
  const r = new StateReader(compositeIdsOf(stmts));
  r.walk(stmts, null);
  const direction = r.direction !== undefined ? DIRECTIONS[r.direction] : undefined;
  const nodes = [...r.states].map(([id, d]) => r.node(id, d, direction));
  const containers: DataContainer[] = [...r.composites].map(([id, c]) => {
    const label = c.label ?? id;
    if (c.lanes.length === 0) {
      const members = r.membership.members(id);
      return { id, role: 'container', label, ...(members.length > 0 ? { members } : {}) };
    }
    const lanes = c.lanes.map((lane) => {
      const members = r.membership.members(lane);
      return { id: lane, ...(members.length > 0 ? { members } : {}) };
    });
    return { id, role: 'pool', label, axis: 'y', lanes };
  });
  const name = pageNameOf(source, r.warnings);
  const page = graphPage({
    ...(name !== undefined ? { name } : {}),
    ...(direction !== undefined ? { direction } : {}),
    nodes: [...nodes, ...r.notes], edges: [...r.edges, ...r.noteEdges], containers,
  });
  return { document: { pages: [{ ...page, notation: 'state' }] }, warnings: r.warnings.all() };
}
