import type { ReactNode } from 'react';
import { isPrefLeaf, type PrefLeaf, type PrefObject, type PrefSection } from '@weasel-js/prefs';
import { BarLayout, type BarNode } from '../Bar/BarLayout';
import type { LeafSurface } from '../Bar/renderBarLeaf';
import { GroupTabs, type GroupTab } from './GroupTabs';

/** Where a section sits when a surface is asked to frame it. */
export interface ObjectSectionAt {
  /** The section has a name to head it with, and is no fragment. */
  labeled: boolean;
  /** Something visible sits above the section's rows, so depth can be drawn against it. */
  indent: boolean;
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
  /** A section drawn in place, with `inner` its rows: under a heading, in a panel, or as a fragment. */
  frame(key: string, section: PrefSection, inner: ReactNode[], at: ObjectSectionAt): ReactNode[];
}

/**
 * An object leaf's children as rows, the one walk every params surface makes: fields in runs, a `bar` section as
 * one line, neighboring `tab` sections as one set of tabs, and any other section framed by the surface. A section
 * with nothing to draw is skipped and ends no run.
 */
export function objectRows<Cell>(children: PrefObject['children'], parts: ObjectLeafParts<Cell>, indent = true): ReactNode[] {
  const out: ReactNode[] = [];
  let pending: Cell[] = [];
  const flush = (): void => {
    if (pending.length > 0) out.push(...parts.rows(pending));
    pending = [];
  };
  // A run of neighboring `tab` sections, held until something else ends it.
  let tabs: GroupTab[] = [];
  const flushTabs = (): void => {
    if (tabs.length > 0) out.push(<GroupTabs key={`tabs:${tabs[0]!.id}`} tabs={tabs} />);
    tabs = [];
  };
  for (const [key, child] of Object.entries(children)) {
    if (isPrefLeaf(child)) {
      flushTabs();
      pending.push(parts.cell(key, child, 'row'));
      continue;
    }
    if (child.as === 'bar') {
      const nodes = barNodes(child.members, parts);
      if (nodes.length === 0) continue;
      flush();
      flushTabs();
      out.push(
        <BarLayout key={`bar:${key}`} framed label={child.name === '' ? undefined : child.name}
          nodes={nodes} cells={() => []} row={() => null} />,
      );
      continue;
    }
    const labeled = child.name !== '' && child.as !== 'fragment';
    const inner = objectRows(child.members, parts, labeled && child.as !== 'tab');
    if (inner.length === 0) continue;
    flush();
    if (child.as === 'tab') {
      tabs.push({ id: key, name: child.name, content: [...(parts.lead?.(key, child) ?? []), ...inner] });
      continue;
    }
    flushTabs();
    out.push(...parts.frame(key, child, inner, { labeled, indent }));
  }
  flush();
  flushTabs();
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
