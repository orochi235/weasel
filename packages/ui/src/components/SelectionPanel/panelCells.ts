/**
 * A panel row's leaves as cells: each leaf's context over the selected nodes,
 * and the control it draws in a row or in a bar.
 */
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import type { PrefAliasTargets, PrefLeaf } from '@weasel-js/prefs';
import type { LiveControl } from '../Prefs/commitPolicy';
import type { EntryAt } from '../Prefs/entry';
import type { PrefFieldChoice } from '../Prefs/schema';
import { renderCells, type LeafCell, type RenderedCell } from './cells';
import { MIXED, aggregateLeaf, aggregateValue, nodeLeafValue, nodeValueAt, panelLeafKey, type AnyNode, type PanelLeaf, type PanelRow } from './model';
import { leafAcross } from './nodeBounds';
import type { PanelInherit, PropertyRenderContext, PropertyRenderer } from './renderContext';
import { INHERIT, type InheritedPaint } from '@weasel-js/core';
import { renderBuiltin } from './renderLeaf';

/** What every leaf of one panel reads, whichever row it sits in. */
export interface PanelCellScope {
  nodes: readonly AnyNode[];
  renderers: Record<string, PropertyRenderer> | undefined;
  commit: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void;
  /** A value on the way to the one `commit` takes: written, and kept out of undo. */
  draft: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void;
  selectionKey: string;
  fields: readonly PrefFieldChoice[];
  /** The leaf the panel draws at `path`, which says what a node holding nothing there reads as. */
  leafAt: (path: string) => PrefLeaf | undefined;
  disabled: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  entryAt?: EntryAt;
  /** The schema the panel's aliases point into, where that is not a kind's own: what is inside an alias's row answers to it. */
  targets?: PrefAliasTargets;
  /** Which live controls write only the value an edit settles on. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** What an `'inherit'` fill and stroke on a node would take from its containers. */
  paintAbove?: (node: AnyNode) => InheritedPaint;
}

/** The leaves whose value can be `'inherit'`, and the paint each takes. */
const INHERITS: Readonly<Record<string, keyof InheritedPaint>> = { 'data.fill': 'fill', 'data.stroke': 'stroke' };

function inheritOf(panelLeaf: PanelLeaf, scope: PanelCellScope): PanelInherit | undefined {
  const field = INHERITS[panelLeaf.path];
  const { nodes, paintAbove } = scope;
  if (field === undefined || paintAbove === undefined || nodes.some((n) => n.parent == null)) return undefined;
  const paints = nodes.map((n) => paintAbove(n)[field]?.paint ?? null);
  return {
    paint: paints.every((p) => p === paints[0]) ? paints[0] : undefined,
    each: nodes.map((n) => nodeValueAt(n, panelLeaf.path) === INHERIT),
    set: () => scope.commit(panelLeaf, () => INHERIT),
  };
}

function leafContext(panelLeaf: PanelLeaf, scope: PanelCellScope): PropertyRenderContext {
  const { nodes, commit, draft, selectionKey, fields, leafAt, disabled, hidden } = scope;
  const { path, leaf } = panelLeaf;
  const inside = panelLeaf.own === undefined ? undefined : scope.targets;
  const entryAt = inside?.entryAt ?? scope.entryAt;
  const aggregated = aggregateLeaf(nodes, path, leaf);
  const mixed = aggregated === MIXED;
  return {
    path,
    pref: leafAcross(leaf, nodes),
    value: mixed ? undefined : aggregated,
    mixed,
    unset: !mixed && aggregated === undefined,
    each: nodes.map((n) => nodeLeafValue(leaf, nodeValueAt(n, path))),
    setValue: (v) => commit(panelLeaf, () => v),
    update: (fn) => commit(panelLeaf, fn),
    drafts: { setValue: (v) => draft(panelLeaf, () => v), update: (fn) => draft(panelLeaf, fn) },
    valueAt: (p) => {
      const held = leafAt(p);
      const at = held ? aggregateLeaf(nodes, p, held) : aggregateValue(nodes, p);
      return at === MIXED ? { value: undefined, mixed: true } : { value: at, mixed: false };
    },
    selectionKey,
    fields,
    disabled: disabled.has(panelLeafKey(panelLeaf)),
    disabledAt: inside?.disabledAt ?? ((at) => disabled.has(at)),
    hidden: hidden.has(panelLeafKey(panelLeaf)),
    hiddenAt: inside?.hiddenAt ?? ((at) => hidden.has(at)),
    ...(entryAt ? { entryAt } : {}),
    ...(scope.settles ? { settles: scope.settles } : {}),
    ...withInherit(inheritOf(panelLeaf, scope)),
  };
}

const withInherit = (inherit: PanelInherit | undefined): Pick<PropertyRenderContext, 'inherit'> =>
  (inherit ? { inherit } : {});

function leafCell(panelLeaf: PanelLeaf, ariaLabel: string, scope: PanelCellScope, surface: LeafSurface): LeafCell {
  const { renderers, selectionKey } = scope;
  const { path, leaf } = panelLeaf;
  const ctx = leafContext(panelLeaf, scope);
  return {
    key: panelLeafKey(panelLeaf),
    leaf,
    ctx,
    ariaLabel,
    render: () => {
      const custom = renderers?.[path] ?? renderers?.[leaf.kind];
      if (custom) return surface === 'bar' ? withBarLabel(leaf, custom(ctx)) : custom(ctx);
      return renderBuiltin(ctx, ariaLabel, renderers, { selectionKey, surface });
    },
  };
}

/**
 * One row's leaves, rendered, with a leaf whose control is null left out. In
 * a row a leaf sharing it is named with the row's label ahead of its own; a
 * bar draws no row label, and names each by itself.
 */
export function rowCells(row: PanelRow, scope: PanelCellScope, surface: LeafSurface = 'row'): RenderedCell[] {
  const qualified = surface === 'row' && row.leaves.length > 1;
  return renderCells(
    row.leaves.map((panelLeaf) => ({
      ...leafCell(panelLeaf, qualified ? `${row.label} ${panelLeaf.leaf.name}` : panelLeaf.leaf.name, scope, surface),
      ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
    })),
    scope.renderers,
  );
}
