import { useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
} from '@weasel-js/core';
import { commitLeaf } from './commitLeaf';
import type { PropertyRenderer } from './renderContext';
import { absentValue, classifyKind, kindBreakdown, type AnyNode } from './model';
import { conditionedSections } from './conditions';
import type { MarkHiddenProps } from '../Prefs/hidden';
import { prefFieldChoices } from '../Prefs/schema';
import { useSelectedRow, type PrefSelectHow } from '../Prefs/selection';
import type { PanelCellScope } from './panelCells';
import { panelSections } from './panelSections';
import { PanelMarksContext, panelMarkedPaths, type PanelMarks } from './selection';
import s from './SelectionPanel.module.css';

export type { PropertyRenderContext, PropertyRenderer } from './renderContext';

/** Props for {@link SelectionPanel}. */
export interface SelectionPanelProps<TData, TLayer extends string, TPose> extends MarkHiddenProps {
  /** The scene handle (`useScene`). The panel subscribes itself, so it
   *  re-renders on scene mutations regardless of parent renders. */
  scene: Scene<TData, TLayer, TPose>;
  /** Selection handle (`useSelection`): the nodes the panel edits. Only `current` is read. */
  selection: Pick<SelectionApi, 'current'>;
  /** Properties-trait entries, e.g. core's `defaultNodeProperties` /
   *  `inferredNodeProperties` (+ consumer extras). Memoize or hoist. */
  properties: readonly NodePropertiesEntry[];
  /** Routing-trait classifiers used to derive each node's kind — pass
   *  the same list the canvas uses. Memoize or hoist. */
  routing: readonly NodeRoutingEntry[];
  /** Control overrides / app-defined kinds (PrefsForm-style). Keys are
   *  leaf paths (`data.fill`, checked first) or leaf kinds (`color`).
   *  A renderer returning `null` collapses its leaf (and the row, when
   *  every leaf in it collapses). */
  renderers?: Record<string, PropertyRenderer>;
  /** Kind → header label. Default: capitalized kind name. */
  kindLabel?: (kind: string) => string;
  /** Rendered when the selection is empty. */
  emptyState?: ReactNode;
  /**
   * What to mark: a leaf by its key in the schema (`data.fill`), a field of
   * an object leaf under its leaf's (`data.stroke.width`), and a top-level
   * section drawn under a heading, as a tab, or as a panel by its own key.
   * Leaves a `pair` draws in one row share its mark.
   * Each time the last one changes the panel brings it into view, opening
   * the tab that holds it. A path the panel draws no row for marks the row
   * it lies inside, or nothing.
   */
  selected?: readonly string[];
  /** The reader pressed or focused into a row, reported as `selected` names
   *  it: a paired row as its first leaf, and a section's heading, tab, or
   *  panel as the section's key. `how.toggle` is true when Cmd or Ctrl was
   *  held. A press on one of several marked rows is reported on its click. */
  onSelect?: (path: string, how: PrefSelectHow) => void;
  className?: string;
}

const NO_MARKS: readonly string[] = [];

const defaultKindLabel = (kind: string): string =>
  kind.length === 0 ? kind : kind[0].toUpperCase() + kind.slice(1);

/**
 * Pre-baked selection properties panel. Shows the selected nodes' kind
 * and the properties-trait schema for that kind; multi-selections show
 * the intersection of the kinds' schemas with per-field Mixed state.
 * Edits commit as one labeled `scene.batch` fan-out per gesture.
 */
export function SelectionPanel<TData, TLayer extends string, TPose>(
  props: SelectionPanelProps<TData, TLayer, TPose>,
) {
  const {
    scene,
    selection,
    properties,
    routing,
    renderers,
    kindLabel = defaultKindLabel,
    emptyState = null,
    className,
  } = props;

  useSyncExternalStore(scene.subscribe, scene.getVersion, scene.getVersion);

  const nodes = selection.current
    .map((id) => scene.get(asNodeId(id)))
    .filter((n): n is NonNullable<typeof n> => n != null) as readonly AnyNode[];

  const kinds = nodes.map((n) => classifyKind(n, routing));
  const selectionKey = nodes.map((n) => n.id).join(',');
  const scope = conditionedSections(kinds, properties, nodes, renderers?.alias !== undefined, props.markHidden === true);
  const { sections } = scope;
  const leaves = new Map(
    sections.flatMap((section) => section.rows.flatMap((row) => row.leaves.map(({ path, leaf }) => [path, leaf] as const))),
  );
  const fields = prefFieldChoices({ name: '', members: Object.fromEntries(leaves) });
  /** What a node holding nothing at `path` reads as there. */
  const absentAt = (path: string): unknown => {
    const leaf = leaves.get(path);
    return leaf && absentValue(leaf);
  };
  const shown = panelMarkedPaths(sections, props.selected ?? NO_MARKS);
  const marks: PanelMarks = { selected: shown, lead: shown.at(-1) ?? null, ...(props.markHidden ? { hidden: scope.hidden } : {}) };
  const rowSelection = useSelectedRow(props.selected ?? NO_MARKS, marks.lead ?? null, props.onSelect);

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const cells: PanelCellScope = {
    nodes,
    renderers,
    commit: (leaf, next) => commitLeaf(scene, selection, leaf, next),
    selectionKey,
    fields,
    absentAt,
    disabled: scope.disabled,
    hidden: scope.hidden,
  };

  return (
    <PanelMarksContext.Provider value={marks}>
    <div className={[s.root, className].filter(Boolean).join(' ')} {...rowSelection}>
      <header className={s.header}>
        {nodes.length === 1 ? (
          <span className={s.kind}>{kindLabel(kinds[0])}</span>
        ) : (
          <>
            <span className={s.kind}>{nodes.length} selected</span>
            <span className={s.breakdown}>{kindBreakdown(kinds)}</span>
          </>
        )}
      </header>
      {panelSections(sections, cells, marks)}
    </div>
    </PanelMarksContext.Provider>
  );
}
