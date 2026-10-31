/**
 * A Mermaid C4 diagram as a one-page document: elements as boxes of their
 * kind's outline and role, boundaries and deployment nodes as containers, and
 * relationships as edges labeled with their technology.
 */
import type { MarkerRef } from '@weasel-js/core';
import type { DataContainer, DataEdge, DataNode, EdgeStyle, NodeStyle } from '@weasel-js/diagram';
import type { ImportResult } from '../../document';
import { Warnings, decodeEntities, graphPage } from '../../graphRead';
import { lineError } from '../../lineError';
import { pageNameOf } from '../common/lines';
import { ELEMENT_WIDTH, elementRows, hasTechnology, kindOfMacro, outlineOf, roleOf } from './kinds';
import { parseC4, type C4Args, type C4Header, type C4Stmt } from './parse';

/** Each boundary macro, as the type its container's label names after its title. */
export const BOUNDARY_TYPES: Readonly<Record<string, string | null>> = {
  Enterprise_Boundary: 'enterprise', System_Boundary: 'system', Container_Boundary: 'container', Boundary: null,
  Deployment_Node: null, Node: null, Node_L: null, Node_R: null,
};

/** Each relationship macro's ports, from end then to end, by the way it says the target lies. */
const REL_PORTS: Readonly<Record<string, readonly [string, string] | undefined>> = {
  U: ['n', 's'], Up: ['n', 's'], D: ['s', 'n'], Down: ['s', 'n'], L: ['w', 'e'], Left: ['w', 'e'], R: ['e', 'w'], Right: ['e', 'w'],
};
const REL = /^(Rel|BiRel|RelIndex)(?:_(U|Up|D|Down|L|Left|R|Right|Back))?$/;

/** The notation each header reads into. */
export const C4_NOTATIONS: Readonly<Record<C4Header, string>> = {
  C4Context: 'c4-context', C4Container: 'c4-container', C4Component: 'c4-component', C4Dynamic: 'c4-dynamic', C4Deployment: 'c4-deployment',
};

const text = (s: string | undefined): string | undefined => (s === undefined || s === '' ? undefined : decodeEntities(s, true));

class C4Reader {
  readonly warnings = new Warnings();
  readonly nodes = new Map<string, DataNode>();
  readonly containers: DataContainer[] = [];
  readonly edges: DataEdge[] = [];
  title: string | undefined;

  /** Warns of what a macro's call gives that a diagram does not hold. */
  extras(args: C4Args, kept: number): void {
    if (args.positional.length > kept) this.warnings.add('Mermaid C4 sprites, tags, links, and descriptions a diagram does not hold were dropped.');
    for (const key of Object.keys(args.named)) this.warnings.list('Mermaid C4 arguments a diagram does not hold were dropped', `$${key}`);
  }

  walk(stmts: readonly C4Stmt[], members: string[]): void {
    for (const s of stmts) {
      if (s.kind === 'title') {
        this.title = s.text;
        continue;
      }
      const [alias, ...rest] = s.args.positional;
      const kind = kindOfMacro(s.macro);
      if (kind !== null) {
        if (alias === undefined) throw lineError('Mermaid', s.line, `${s.macro} needs an alias`);
        const tech = hasTechnology(kind) ? rest[1] : undefined;
        const description = hasTechnology(kind) ? rest[2] : rest[1];
        this.extras(s.args, hasTechnology(kind) ? 4 : 3);
        this.nodes.set(alias, {
          id: alias, rows: elementRows(kind, text(rest[0]) ?? alias, text(tech), text(description)),
          outline: outlineOf(kind), style: roleOf(kind), width: ELEMENT_WIDTH,
        });
        members.push(alias);
      } else if (s.macro in BOUNDARY_TYPES) this.boundary(s, members);
      else if (REL.test(s.macro)) this.rel(s);
      else if (s.macro === 'UpdateElementStyle') this.elementStyle(s);
      else if (s.macro === 'UpdateRelStyle') this.relStyle(s);
      else this.warnings.list('Mermaid C4 statements a diagram does not hold were dropped', s.macro);
      if (s.body !== undefined && !(s.macro in BOUNDARY_TYPES)) throw lineError('Mermaid', s.line, `${s.macro} opens no boundary`);
    }
  }

  boundary(s: Extract<C4Stmt, { kind: 'call' }>, members: string[]): void {
    const [alias, title, type] = s.args.positional;
    if (alias === undefined) throw lineError('Mermaid', s.line, `${s.macro} needs an alias`);
    const fixed = BOUNDARY_TYPES[s.macro];
    if (s.macro === 'Node_L' || s.macro === 'Node_R') this.warnings.add('Mermaid C4 deployment node sides were dropped.');
    this.extras(s.args, fixed !== null ? 2 : 3);
    const kindText = fixed ?? text(type);
    const label = `${text(title) ?? alias}${kindText !== undefined ? ` [${kindText}]` : ''}`;
    const inner: string[] = [];
    this.containers.push({ id: alias, role: 'container', label });
    members.push(alias);
    this.walk(s.body ?? [], inner);
    const at = this.containers.findIndex((c) => c.id === alias);
    if (inner.length > 0) this.containers[at] = { ...this.containers[at]!, members: inner };
  }

  rel(s: Extract<C4Stmt, { kind: 'call' }>): void {
    const [, macro, way] = REL.exec(s.macro)! as unknown as [string, string, string | undefined];
    const args = macro === 'RelIndex' ? s.args.positional.slice(1) : s.args.positional;
    if (macro === 'RelIndex') this.warnings.add('Mermaid C4 relationship indexes were dropped.');
    const [from, to, label, tech] = args;
    if (from === undefined || to === undefined) throw lineError('Mermaid', s.line, `${s.macro} needs two ends`);
    this.extras({ positional: args, named: s.args.named }, 4);
    const ports = way !== undefined ? REL_PORTS[way] : undefined;
    const back = way === 'Back';
    const colors: Partial<EdgeStyle> = {
      ...(macro === 'BiRel' || back ? { markerStart: 'arrow' as MarkerRef } : {}),
      ...(back ? { markerEnd: null } : {}),
    };
    const words = [text(label), text(tech) !== undefined ? `[${text(tech)}]` : undefined].filter((w) => w !== undefined);
    this.edges.push({
      from, to,
      ...(ports !== undefined ? { fromPort: ports[0], toPort: ports[1] } : {}),
      ...(words.length > 0 ? { label: words.join(' ') } : {}),
      ...(Object.keys(colors).length > 0 ? { colors } : {}),
    });
  }

  elementStyle(s: Extract<C4Stmt, { kind: 'call' }>): void {
    const [alias] = s.args.positional;
    const { bgColor, fontColor, borderColor, ...rest } = s.args.named;
    for (const key of Object.keys(rest)) this.warnings.list('Mermaid C4 arguments a diagram does not hold were dropped', `$${key}`);
    const colors: Partial<NodeStyle> = {
      ...(bgColor !== undefined ? { fill: bgColor } : {}), ...(borderColor !== undefined ? { stroke: borderColor } : {}),
      ...(fontColor !== undefined ? { text: fontColor } : {}),
    };
    const node = this.nodes.get(alias ?? '');
    const box = this.containers.findIndex((c) => c.id === alias);
    if (node !== undefined) this.nodes.set(node.id, { ...node, colors: { ...node.colors, ...colors } });
    else if (box >= 0) this.containers[box] = { ...this.containers[box]!, colors: { ...this.containers[box]!.colors, ...colors } };
    else throw lineError('Mermaid', s.line, `no element or boundary is named "${alias ?? ''}"`);
  }

  relStyle(s: Extract<C4Stmt, { kind: 'call' }>): void {
    const [from, to] = s.args.positional;
    const { textColor, lineColor, ...rest } = s.args.named;
    for (const key of Object.keys(rest)) this.warnings.list('Mermaid C4 arguments a diagram does not hold were dropped', `$${key}`);
    const colors: Partial<EdgeStyle> = { ...(lineColor !== undefined ? { stroke: lineColor } : {}), ...(textColor !== undefined ? { label: textColor } : {}) };
    for (const [i, e] of this.edges.entries()) {
      if (e.from === from && e.to === to) this.edges[i] = { ...e, colors: { ...e.colors, ...colors } };
    }
  }
}

/** Reads a Mermaid C4 diagram into a one-page document whose `notation` names its header (`'c4-context'`, …). Throws,
 *  naming the line, on text that is not one. */
export function readC4(source: string): ImportResult {
  const { source: src, header, stmts } = parseC4(source);
  const r = new C4Reader();
  r.walk(stmts, []);
  const known = (id: string) => r.nodes.has(id) || r.containers.some((c) => c.id === id);
  const edges = r.edges.filter((e) => known(e.from) && known(e.to));
  if (edges.length < r.edges.length) r.warnings.add('Mermaid C4 relationships to elements never declared were dropped.');
  const named = pageNameOf(src, r.warnings);
  const name = r.title ?? named;
  const page = graphPage({ ...(name !== undefined ? { name } : {}), nodes: [...r.nodes.values()], edges, containers: r.containers });
  return { document: { pages: [{ ...page, notation: C4_NOTATIONS[header] }] }, warnings: r.warnings.all() };
}
