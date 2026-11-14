/**
 * A panel row's leaves as cells: each leaf's context over the selected nodes,
 * and the control it draws in a row or in a bar.
 */
import { withBarLabel } from '../../Bar/renderBarLeaf';
import { drawsBarForm, type ControlForm } from '../../ActionButton/controlForm';
import { sourceResetPlan, type PrefAliasTargets, type SelectionSource } from '@weasel-js/prefs';
import { sourceLeafContext } from '../../PrefsSource/leafContext';
import type { LiveControl } from '../../Prefs/commitPolicy';
import type { EntryAt } from '../../Prefs/entry';
import type { PrefFieldChoice } from '../../Prefs/schema';
import { renderCells, type LeafCell, type RenderedCell } from './cells';
import { MIXED, nodeValueAt, panelLeafKey, sharedValue, type AnyNode, type PanelLeaf, type PanelRow } from './model';
import { leafAcross } from './nodeBounds';
import type { PanelInherit, LeafContext, LeafRenderer } from './renderContext';
import { INHERIT, type InheritedPaint } from '@weasel-js/core';
import { renderBuiltin } from './renderLeaf';

/** What every leaf of one panel reads, whichever row it sits in. */
export interface PanelCellScope {
  nodes: readonly AnyNode[];
  renderers: Record<string, LeafRenderer> | undefined;
  commit: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void;
  /** A value on the way to the one `commit` takes: written, and kept out of undo. */
  draft: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void;
  /** Where the panel's leaves are read and reset. */
  source: SelectionSource;
  selectionKey: string;
  fields: readonly PrefFieldChoice[];
  disabled: ReadonlySet<string>;
  hidden: ReadonlySet<string>;
  /** The keys of the actions whose `activeIf` holds. */
  active?: ReadonlySet<string>;
  entryAt?: EntryAt;
  /** The schema the panel's aliases point into, where that is not a kind's own: what is inside an alias's row answers to it. */
  targets?: PrefAliasTargets;
  /** Which live controls write only the value an edit settles on. */
  settles?: Readonly<Record<LiveControl, boolean>>;
  /** How long live text waits for the next keystroke before it is written, in ms. */
  textWaitMs?: number;
  /** What an `'inherit'` fill and stroke on a node would take from its containers. */
  paintAbove?: (node: AnyNode) => InheritedPaint;
}

/** The leaves whose value can be `'inherit'`, and the paint each takes. */
const INHERITS: Readonly<Record<string, keyof InheritedPaint>> = { 'data.fill': 'fill', 'data.stroke': 'stroke' };

function inheritOf(panelLeaf: PanelLeaf, scope: PanelCellScope): PanelInherit | undefined {
  const field = INHERITS[panelLeaf.path];
  const { nodes, paintAbove } = scope;
  if (field === undefined || paintAbove === undefined || nodes.some((n) => n.parent == null)) return undefined;
  const shared = sharedValue(nodes.map((n) => paintAbove(n)[field]?.paint ?? null));
  return {
    paint: shared === MIXED ? undefined : (shared as PanelInherit['paint']),
    each: nodes.map((n) => nodeValueAt(n, panelLeaf.path) === INHERIT),
    set: () => scope.commit(panelLeaf, () => INHERIT),
  };
}

function leafContext(panelLeaf: PanelLeaf, scope: PanelCellScope): LeafContext {
  const { nodes, source, selectionKey, fields, disabled, hidden } = scope;
  const { path, leaf } = panelLeaf;
  const inside = panelLeaf.own === undefined ? undefined : scope.targets;
  const entryAt = inside?.entryAt ?? scope.entryAt;
  const own = sourceLeafContext(source, path, leaf);
  return {
    ...own,
    pref: leafAcross(leaf, nodes),
    unset: !own.mixed && own.value === undefined,
    drafts: {
      setValue: (v) => source.write(path, v, { draft: true }),
      update: (fn) => source.update(path, fn, { draft: true }),
    },
    selectionKey,
    fields,
    disabled: disabled.has(panelLeafKey(panelLeaf)),
    disabledAt: inside?.disabledAt ?? ((at) => disabled.has(at)),
    hidden: hidden.has(panelLeafKey(panelLeaf)),
    hiddenAt: inside?.hiddenAt ?? ((at) => hidden.has(at)),
    ...(scope.active?.has(panelLeafKey(panelLeaf)) ? { active: true } : {}),
    ...(entryAt ? { entryAt } : {}),
    ...(scope.settles ? { settles: scope.settles } : {}),
    ...(scope.textWaitMs ? { textWaitMs: scope.textWaitMs } : {}),
    ...withInherit(inheritOf(panelLeaf, scope)),
  };
}

const withInherit = (inherit: PanelInherit | undefined): Pick<LeafContext, 'inherit'> =>
  (inherit ? { inherit } : {});

function leafCell(panelLeaf: PanelLeaf, ariaLabel: string, scope: PanelCellScope, surface: ControlForm): LeafCell {
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
      if (custom) return drawsBarForm(surface) ? withBarLabel(leaf, custom(ctx)) : custom(ctx);
      return renderBuiltin(ctx, ariaLabel, renderers, { selectionKey, surface });
    },
  };
}

/**
 * One row's leaves, rendered, with a leaf whose control is null left out. In
 * a row a leaf sharing it is named with the row's label ahead of its own; a
 * bar draws no row label, and names each by itself.
 */
export function rowCells(row: PanelRow, scope: PanelCellScope, surface: ControlForm = 'row'): RenderedCell[] {
  const qualified = !drawsBarForm(surface) && row.leaves.length > 1;
  return renderCells(
    row.leaves.map((panelLeaf) => ({
      ...leafCell(panelLeaf, qualified ? `${row.label} ${panelLeaf.leaf.name}` : panelLeaf.leaf.name, scope, surface),
      ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
    })),
    scope.renderers,
  );
}

/** The paths of `leaves` a reset would change in some selected node, by the one reset policy (`resetPlan`). */
export function panelResets(leaves: readonly PanelLeaf[], scope: PanelCellScope): string[] {
  return sourceResetPlan(scope.source, leaves.map((l) => l.path)).map((w) => w.path);
}
