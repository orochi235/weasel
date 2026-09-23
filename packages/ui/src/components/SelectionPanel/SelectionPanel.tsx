import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
} from '@weasel-js/core';
import {
  renderBuiltin,
  renderCells,
  type LeafCell,
  type PropertyRenderContext,
  type PropertyRenderer,
} from './renderLeaf';
import {
  MIXED,
  aggregateValue,
  classifyKind,
  effectiveSections,
  kindBreakdown,
  setAtPath,
  type AnyNode,
  type PanelLeaf,
} from './model';
import s from './SelectionPanel.module.css';

export type { PropertyRenderContext, PropertyRenderer } from './renderLeaf';

/** Props for {@link SelectionPanel}. */
export interface SelectionPanelProps<TData, TLayer extends string, TPose> {
  /** The scene handle (`useScene`). The panel subscribes itself, so it
   *  re-renders on scene mutations regardless of parent renders. */
  scene: Scene<TData, TLayer, TPose>;
  /** Selection handle (`useSelection`). Only `current` is read. */
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
  className?: string;
}

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
  const sections = effectiveSections(kinds, properties);

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  const commit = (leaf: PanelLeaf, value: unknown): void => {
    const [head, ...rest] = leaf.path.split('.');
    if (rest.length === 0) return;
    const ids = selection.current.map(asNodeId);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        // `setAtPath` spreads plain objects/arrays down the schema path;
        // consumer `pose`/`data` are assumed plain-object-shaped along
        // that path (a class instance's prototype would be dropped by
        // the spread) — the `as TPose`/`as TData` casts below rely on it.
        if (head === 'pose') {
          scene.setPose(id, setAtPath(node.pose as object, rest, value) as TPose);
        } else if (head === 'data') {
          scene.update(id, { data: setAtPath(node.data as object, rest, value) as TData });
        }
      }
    });
  };

  return (
    <div className={[s.root, className].filter(Boolean).join(' ')}>
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
      {sections.map((section) => {
        // Render controls before emitting row chrome so a null-rendering
        // leaf (custom renderer opting out) collapses its cell — and the
        // whole row / section when nothing survives. PrefsForm precedent.
        const rows = section.rows
          .map((row) => {
            const controls = renderCells(
              row.leaves.map((panelLeaf) =>
                leafCell(
                  panelLeaf,
                  row.leaves.length > 1
                    ? `${row.label} ${panelLeaf.leaf.name}`
                    : panelLeaf.leaf.name,
                  nodes,
                  renderers,
                  commit,
                  selectionKey,
                ),
              ),
              renderers,
            );
            return { row, controls };
          })
          .filter(({ controls }) => controls.length > 0);
        if (rows.length === 0) return null;
        return (
          <section key={section.key} className={s.section}>
            {section.name !== '' && <h3 className={s.sectionTitle}>{section.name}</h3>}
            {rows.map(({ row, controls }) => (
              // A `block` leaf brings its own chrome — it spans the section
              // instead of sitting in a labeled row's control cell. Under a
              // headless section nothing else names it, so it heads itself;
              // an object leaf already renders its own heading.
              row.leaves.length === 1 && row.leaves[0].leaf.block ? (
                <div key={row.leaves[0].path}>
                  {section.name === '' && row.leaves[0].leaf.kind !== 'object' && (
                    <h4 className={s.sectionTitle} title={row.leaves[0].leaf.description}>
                      {row.leaves[0].leaf.name}
                    </h4>
                  )}
                  {controls[0].content}
                </div>
              ) : (
              <div key={row.leaves[0].path} className={s.row}>
                <span className={s.rowLabel} title={row.leaves[0].leaf.description}>
                  {row.label}
                </span>
                <span className={s.rowControls}>
                  {controls.map(({ key, content }) => (
                    <Fragment key={key}>{content}</Fragment>
                  ))}
                </span>
              </div>
              )
            ))}
          </section>
        );
      })}
    </div>
  );
}


function leafCell(
  panelLeaf: PanelLeaf,
  ariaLabel: string,
  nodes: readonly AnyNode[],
  renderers: Record<string, PropertyRenderer> | undefined,
  commit: (leaf: PanelLeaf, value: unknown) => void,
  selectionKey: string,
): LeafCell {
  const { path, leaf } = panelLeaf;
  const aggregated = aggregateValue(nodes, path);
  const mixed = aggregated === MIXED;
  const value = mixed ? undefined : aggregated;

  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value,
    mixed,
    unset: !mixed && aggregated === undefined,
    setValue: (v) => commit(panelLeaf, v),
    valueAt: (p) => {
      const at = aggregateValue(nodes, p);
      return at === MIXED ? { value: undefined, mixed: true } : { value: at, mixed: false };
    },
    selectionKey,
  };

  return {
    key: path,
    leaf,
    ctx,
    ariaLabel,
    render: () => {
      const custom = renderers?.[path] ?? renderers?.[leaf.kind];
      if (custom) return custom(ctx);
      return renderBuiltin(ctx, ariaLabel, renderers, selectionKey);
    },
  };
}

