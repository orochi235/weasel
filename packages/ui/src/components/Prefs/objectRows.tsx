import { Fragment, type ReactNode } from 'react';
import { isPrefLeaf, prefSectionPath, prefTabRuns, type PrefLeaf, type PrefObject, type PrefSection } from '@weasel-js/prefs';
import { BarLayout, type BarNode } from '../Bar/BarLayout';
import type { LeafSurface } from '../Bar/renderBarLeaf';
import { GroupTabs, type GroupTab } from './GroupTabs';

/** Where a section sits when a surface is asked to frame it. */
export interface ObjectSectionAt {
  /** The section has a name to head it with, and is no fragment. */
  labeled: boolean;
  /** Something visible sits above the section's rows, so depth can be drawn against it. */
  indent: boolean;
  /** The path the section is named by (`prefSectionPath`), which a surface asks `disabledAt` about. */
  path: string;
}

/** One tab of a run inside an object leaf. */
export interface ObjectTab extends GroupTab {
  section: PrefSection;
}

/**
 * The parts of an object leaf that a surface draws its own way. `Cell` is the surface's unit for one field,
 * made before anything is drawn so a run of neighbors can be seen as a run.
 */
export interface ObjectLeafParts<Cell> {
  /** The object leaf's own path, which a field's and a section's are under. */
  path: string;
  /** One field, for a row or for a bar. */
  cell(key: string, leaf: PrefLeaf, surface: LeafSurface): Cell;
  /** The rows of a run of neighboring fields. */
  rows(cells: readonly Cell[]): ReactNode[];
  /** The bar cells of a run of neighboring fields. */
  barCells(cells: readonly Cell[]): BarNode[];
  /** What a section's tab holds besides its rows, ahead of them: a note, say. Default: nothing. */
  lead?(key: string, section: PrefSection): ReactNode[];
  /** A run of neighboring `tab` sections, each with the section it draws. Default: a strip that keeps its own open tab. */
  tabs?(run: readonly ObjectTab[]): ReactNode;
  /** Whether the section named `path` (`prefSectionPath`) is disabled, which dims its tab's or its bar's name. Default: never. */
  off?(path: string): boolean;
  /** Attributes for the element a bar draws for the field at `path`. Default: none. */
  barAttrs?(path: string, leaf: boolean): Record<string, string | undefined>;
  /** A section drawn in place, with `inner` its rows: under a heading, in a panel, or as a fragment. */
  frame(key: string, section: PrefSection, inner: ReactNode[], at: ObjectSectionAt): ReactNode[];
}

/** One child of an object leaf with something to draw, before it is placed among its neighbors. */
type Drawn<Cell> =
  | { kind: 'cell'; cell: Cell }
  | { kind: 'bar'; key: string; section: PrefSection; nodes: BarNode[]; off: boolean }
  | { kind: 'tab'; tab: ObjectTab }
  | { kind: 'frame'; key: string; section: PrefSection; inner: ReactNode[]; labeled: boolean; path: string };

/** The children that draw something, in order. `within` is the path a section among them is named under. */
function drawnChildren<Cell>(children: PrefObject['children'], parts: ObjectLeafParts<Cell>, within: string): Drawn<Cell>[] {
  const out: Drawn<Cell>[] = [];
  for (const [key, child] of Object.entries(children)) {
    if (isPrefLeaf(child)) {
      out.push({ kind: 'cell', cell: parts.cell(key, child, 'row') });
      continue;
    }
    const path = prefSectionPath(within, key);
    const off = parts.off?.(path) === true;
    if (child.as === 'bar') {
      const nodes = barNodes(child.members, parts);
      if (nodes.length > 0) out.push({ kind: 'bar', key, section: child, nodes, off });
      continue;
    }
    const labeled = child.name !== '' && child.as !== 'fragment';
    const inner = objectRows(child.members, parts, labeled && child.as !== 'tab', path);
    if (inner.length === 0) continue;
    if (child.as === 'tab') {
      const content = [...(parts.lead?.(key, child) ?? []), ...inner];
      out.push({ kind: 'tab', tab: { id: key, name: child.name, section: child, content, disabled: off } });
    } else {
      out.push({ kind: 'frame', key, section: child, inner, labeled, path });
    }
  }
  return out;
}

/**
 * An object leaf's children as rows, the one walk every params surface makes: fields in runs, a `bar` section as
 * one line, neighboring `tab` sections as one set of tabs, and any other section framed by the surface. A section
 * with nothing to draw is skipped and ends no run. `within` is the path a section among them is named under: the
 * object leaf's own, or the section's that holds them.
 */
export function objectRows<Cell>(children: PrefObject['children'], parts: ObjectLeafParts<Cell>, indent = true, within = parts.path): ReactNode[] {
  const out: ReactNode[] = [];
  let pending: Cell[] = [];
  const flush = (): void => {
    if (pending.length > 0) out.push(...parts.rows(pending));
    pending = [];
  };
  for (const step of prefTabRuns(drawnChildren(children, parts, within), (drawn) => drawn.kind === 'tab')) {
    if (step.tabs) {
      const tabs = step.tabs.map((drawn) => (drawn as Extract<Drawn<Cell>, { kind: 'tab' }>).tab);
      const key = `tabs:${tabs[0]!.id}`;
      flush();
      out.push(parts.tabs ? <Fragment key={key}>{parts.tabs(tabs)}</Fragment> : <GroupTabs key={key} tabs={tabs} />);
      continue;
    }
    const drawn = step.item;
    if (drawn.kind === 'cell') {
      pending.push(drawn.cell);
      continue;
    }
    flush();
    if (drawn.kind === 'bar') {
      out.push(
        <BarLayout key={`bar:${drawn.key}`} framed label={drawn.section.name === '' ? undefined : drawn.section.name} overflow={drawn.section.overflow} lead={drawn.section.lead} icon={drawn.section.icon} disabled={drawn.off}
          nodes={drawn.nodes} cells={() => []} row={() => null} attrs={parts.barAttrs} />,
      );
    } else if (drawn.kind === 'frame') {
      out.push(...parts.frame(drawn.key, drawn.section, drawn.inner, { labeled: drawn.labeled, indent, path: drawn.path }));
    }
  }
  flush();
  return out;
}

/** A section drawn as a bar: its fields on one line in their bar forms, a nested section as a run between dividers. */
function barNodes<Cell>(members: PrefSection['members'], parts: ObjectLeafParts<Cell>): BarNode[] {
  const out: BarNode[] = [];
  let pending: Cell[] = [];
  const flush = (): void => {
    if (pending.length > 0) out.push(...parts.barCells(pending));
    pending = [];
  };
  for (const [key, child] of Object.entries(members)) {
    if (isPrefLeaf(child)) {
      pending.push(parts.cell(key, child, 'bar'));
      continue;
    }
    flush();
    const nodes = barNodes(child.members, parts);
    if (nodes.length > 0) out.push({ kind: 'run', path: `${parts.path}.${key}`, nodes });
  }
  flush();
  return out;
}
