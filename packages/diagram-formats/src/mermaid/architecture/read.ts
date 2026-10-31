/**
 * A Mermaid architecture diagram as a one-page document: services as nodes
 * whose outline is their icon's, junctions as dots, groups as containers, and
 * edges joined at the compass port each side names.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, Outline } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Warnings, graphPage } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf } from '../common/lines';
import { textLines } from '../common/text';
import { parseArchitecture, type ArchEnd, type ArchSide, type ArchStmt } from './parse';

/** Mermaid's built-in icons, as the outline each is drawn with. */
export const ICON_OUTLINES: Readonly<Record<string, Outline>> = {
  cloud: 'cloud', database: 'cylinder', disk: 'disk', internet: 'globe', server: 'server',
};
/** A service with no icon, or one not built in. */
export const SERVICE_OUTLINE = 'roundRect';
/** A side, as the compass port it names. */
export const SIDE_PORTS: Readonly<Record<ArchSide, string>> = { L: 'w', R: 'e', T: 'n', B: 's' };
/** A junction's box. */
export const JUNCTION_SIZE = 12;

class ArchReader {
  readonly warnings = new Warnings();
  readonly nodes: DataNode[] = [];
  readonly groups = new Map<string, string | undefined>();
  readonly parent = new Map<string, string>();
  readonly order: string[] = [];
  readonly edges: DataEdge[] = [];

  place(id: string, parent: string | undefined): void {
    this.order.push(id);
    if (parent !== undefined) this.parent.set(id, parent);
  }

  outline(icon: string | undefined): Outline {
    if (icon === undefined) return SERVICE_OUTLINE;
    const known = ICON_OUTLINES[icon];
    if (known === undefined) this.warnings.list('Mermaid icons not built in were drawn as rounded boxes', icon);
    return known ?? SERVICE_OUTLINE;
  }

  /** An edge's end: the service, or the group around it when the end says `{group}`. */
  end(end: ArchEnd): { id: string; port?: string } {
    if (!end.group) return { id: end.id, port: SIDE_PORTS[end.side] };
    const group = this.parent.get(end.id);
    if (group === undefined) {
      this.warnings.add('Mermaid {group} on a service in no group was dropped.');
      return { id: end.id, port: SIDE_PORTS[end.side] };
    }
    return { id: group };
  }

  read(stmts: readonly ArchStmt[]): void {
    for (const s of stmts) {
      if (s.kind === 'group') {
        this.groups.set(s.id, s.title);
        this.place(s.id, s.in);
        if (s.icon !== undefined) this.warnings.list('Mermaid group icons were dropped', s.icon);
      } else if (s.kind === 'service') {
        this.nodes.push({ id: s.id, lines: textLines(s.title ?? s.id), outline: this.outline(s.icon) });
        this.place(s.id, s.in);
      } else if (s.kind === 'junction') {
        this.nodes.push({ id: s.id, lines: [], outline: 'start', width: JUNCTION_SIZE, height: JUNCTION_SIZE, padding: 0 });
        this.place(s.id, s.in);
      }
    }
    for (const s of stmts) if (s.kind === 'edge') this.edge(s);
  }

  edge(s: Extract<ArchStmt, { kind: 'edge' }>): void {
    for (const { id } of [s.from, s.to]) {
      if (!this.nodes.some((n) => n.id === id)) throw lineError('Mermaid', s.line, `no service or junction is named "${id}"`);
    }
    const from = this.end(s.from);
    const to = this.end(s.to);
    const colors = { ...(s.start ? { markerStart: 'arrow' as MarkerRef } : {}), ...(!s.end ? { markerEnd: null } : {}) };
    this.edges.push({
      from: from.id, to: to.id,
      ...(from.port !== undefined ? { fromPort: from.port } : {}),
      ...(to.port !== undefined ? { toPort: to.port } : {}),
      ...(Object.keys(colors).length > 0 ? { colors } : {}),
    });
  }
}

/** Reads a Mermaid architecture diagram into a one-page document of `notation` `'architecture'`. Throws, naming the
 *  line, on text that is not one, or on a name no group holds. */
export function readArchitecture(text: string): ImportResult {
  const { source, stmts } = parseArchitecture(text);
  const r = new ArchReader();
  r.read(stmts);
  for (const s of stmts) {
    if (s.kind !== 'edge' && s.in !== undefined && !r.groups.has(s.in)) throw lineError('Mermaid', s.line, `no group is named "${s.in}"`);
  }
  const containers: DataContainer[] = [...r.groups].map(([id, title]) => {
    const members = r.order.filter((m) => r.parent.get(m) === id);
    return { id, role: 'container', ...(title !== undefined ? { label: textLines(title).join(' ') } : {}), ...(members.length > 0 ? { members } : {}) };
  });
  const name = pageNameOf(source, r.warnings);
  const page = graphPage({ ...(name !== undefined ? { name } : {}), direction: 'right', nodes: r.nodes, edges: r.edges, containers });
  return { document: { pages: [{ ...page, notation: 'architecture' }] }, warnings: r.warnings.all() };
}
