/**
 * A panel row's leaves as cells: each leaf's context over the selected nodes,
 * and the control it draws in a row or in a bar.
 */
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import type { PrefFieldChoice } from '../Prefs/schema';
import { renderCells, type LeafCell, type RenderedCell } from './cells';
import { MIXED, absentValue, aggregateValue, nodeValueAt, panelLeafKey, type AnyNode, type PanelLeaf, type PanelRow } from './model';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import { renderBuiltin } from './renderLeaf';

/** What every leaf of one panel reads, whichever row it sits in. */
export interface PanelCellScope {
  nodes: readonly AnyNode[];
  renderers: Record<string, PropertyRenderer> | undefined;
  commit: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void;
  selectionKey: string;
  fields: readonly PrefFieldChoice[];
  /** What a node holding nothing at `path` reads as there. */
  absentAt: (path: string) => unknown;
  disabled: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
}

function leafContext(panelLeaf: PanelLeaf, scope: PanelCellScope): PropertyRenderContext {
  const { nodes, commit, selectionKey, fields, absentAt, disabled, hidden } = scope;
  const { path, leaf } = panelLeaf;
  const absent = absentValue(leaf);
  const aggregated = aggregateValue(nodes, path, absent);
  const mixed = aggregated === MIXED;
  return {
    path,
    pref: leaf,
    value: mixed ? undefined : aggregated,
    mixed,
    unset: !mixed && aggregated === undefined,
    each: nodes.map((n) => {
      const held = nodeValueAt(n, path);
      return held === undefined ? absent : held;
    }),
    setValue: (v) => commit(panelLeaf, () => v),
    update: (fn) => commit(panelLeaf, fn),
    valueAt: (p) => {
      const at = aggregateValue(nodes, p, absentAt(p));
      return at === MIXED ? { value: undefined, mixed: true } : { value: at, mixed: false };
    },
    selectionKey,
    fields,
    disabled: disabled.has(panelLeafKey(panelLeaf)),
    disabledAt: (at) => disabled.has(at),
    hidden: hidden.has(panelLeafKey(panelLeaf)),
    hiddenAt: (at) => hidden.has(at),
  };
}

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
