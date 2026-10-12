import { Fragment, useSyncExternalStore, type ReactNode } from 'react';
import {
  asNodeId,
  type NodePropertiesEntry,
  type NodeRoutingEntry,
  type Scene,
  type SelectionApi,
} from '@weasel-js/core';
import { renderCells, type LeafCell } from './cells';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import { renderBuiltin } from './renderLeaf';
import {
  MIXED,
  absentValue,
  aggregateValue,
  classifyKind,
  kindBreakdown,
  nodeValueAt,
  panelLeafKey,
  setAtPath,
  type AnyNode,
  type PanelLeaf,
  type PanelSection,
} from './model';
import { conditionedSections } from './conditions';
import { HiddenBadge, hiddenAttrs, type MarkHiddenProps } from '../Prefs/hidden';
import { prefDrawsNoControl } from '../Prefs/PrefWords';
import { prefFieldChoices, type PrefFieldChoice } from '../Prefs/schema';
import { pathWithin, selectionAttrs, useSelectedRow, type PrefSelectHow } from '../Prefs/selection';
import { BarLayout } from '../Bar/BarLayout';
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { PanelMarksContext, PanelTabs, panelShownPath, type PanelMarks } from './selection';
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
   * Paths of the rows to mark: a leaf's key in the schema (`data.fill`), or a
   * field of an object leaf under its leaf's (`data.stroke.width`). Each time
   * the last one changes the panel brings it into view, opening the tab that
   * holds it. A path the panel draws no row for marks the row it lies inside,
   * or nothing.
   */
  selected?: readonly string[];
  /** The reader pressed or focused into a row. `how.toggle` is true when Cmd
   *  or Ctrl was held. A press on one of several marked rows is reported on
   *  its click. */
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
  const drawnRows = sections.flatMap((section) => section.rows.flatMap((row) => row.leaves.map((item) => [panelLeafKey(item), item.leaf] as const)));
  const shown = (props.selected ?? NO_MARKS).map((path) => panelShownPath(drawnRows, path)).filter((path): path is string => path !== null);
  const marks: PanelMarks = { selected: shown, lead: shown.at(-1) ?? null, ...(props.markHidden ? { hidden: scope.hidden } : {}) };
  const rowSelection = useSelectedRow(props.selected ?? NO_MARKS, marks.lead ?? null, props.onSelect);

  if (nodes.length === 0) {
    return <div className={[s.root, className].filter(Boolean).join(' ')}>{emptyState}</div>;
  }

  /** Writes, into every selected node, what `next` derives from the value
   *  that node holds at the leaf's path. */
  const commit = (leaf: PanelLeaf, next: (prev: unknown) => unknown): void => {
    const [head, ...rest] = leaf.path.split('.');
    if (rest.length === 0) return;
    const ids = selection.current.map(asNodeId);
    scene.batch(`Edit ${leaf.leaf.name}`, () => {
      for (const id of ids) {
        const node = scene.get(id);
        if (!node) continue;
        const held = nodeValueAt(node as AnyNode, leaf.path);
        const value = next(held === undefined ? absentValue(leaf.leaf) : held);
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
      {drawn(sections.flatMap((section) => {
        if (section.as === 'bar') {
          // One line of bar forms, with no heading and no row labels.
          const cells = section.rows.flatMap((row) =>
            renderCells(
              row.leaves.map((panelLeaf) => ({
                ...leafCell(panelLeaf, panelLeaf.leaf.name, nodes, renderers, commit, selectionKey, fields, absentAt, scope, 'bar'),
                ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
              })),
              renderers,
            ),
          );
          if (cells.length === 0) return [];
          const bar = (
            <BarLayout
              framed
              label={section.name === '' ? undefined : section.name}
              nodes={cells.map((cell) => ({ kind: 'cell', path: cell.key, content: cell.content }))}
              cells={() => []}
              row={() => null}
              attrs={(at, leaf) => selectionAttrs(at, marks, leaf)}
            />
          );
          return [{ section, content: bar }];
        }
        // Render controls before emitting row chrome so a null-rendering
        // leaf (custom renderer opting out) collapses its cell — and the
        // whole row / section when nothing survives. PrefsForm precedent.
        const rows = section.rows
          .map((row) => {
            const controls = renderCells(
              row.leaves.map((panelLeaf) => ({
                ...leafCell(
                  panelLeaf,
                  row.leaves.length > 1
                    ? `${row.label} ${panelLeaf.leaf.name}`
                    : panelLeaf.leaf.name,
                  nodes,
                  renderers,
                  commit,
                  selectionKey,
                  fields,
                  absentAt,
                  scope,
                ),
                ...(row.pair !== undefined ? { pair: { key: row.pair, label: row.label } } : {}),
              })),
              renderers,
            );
            return { row, controls };
          })
          .filter(({ controls }) => controls.length > 0);
        if (rows.length === 0) return [];
        const tab = section.as === 'tab';
        const headed = section.name !== '' && !tab && section.as !== 'fragment';
        // A section hidden whole carries one mark, on its heading; with no heading each of its rows does.
        const whole = headed && rows.every(({ controls }) => controls.every((cell) => cell.hidden));
        const rowMarks: PanelMarks = whole ? { ...marks, hidden: undefined } : marks;
        const marked = (controls: readonly { hidden: boolean }[]): boolean => !whole && controls.every((cell) => cell.hidden);
        const content = (
          <>
            {headed && <h3 className={s.sectionTitle}>{section.name}{whole && <HiddenBadge />}</h3>}
            {rows.map(({ row, controls }) => (
              // A `block` leaf brings its own chrome — it spans the section
              // instead of sitting in a labeled row's control cell. Under a
              // headless section nothing else names it, so it heads itself;
              // an object leaf already renders its own heading.
              row.leaves.length === 1 && controls[0].block ? (
                // An object leaf ends in rows of its own, each with the gap a row leaves under it.
                <div key={panelLeafKey(row.leaves[0])} className={row.leaves[0].leaf.kind === 'object' ? undefined : s.blockRow}
                  {...selectionAttrs(panelLeafKey(row.leaves[0]), rowMarks, true)}>
                  {marked(controls) && <HiddenBadge lead />}
                  {section.name === '' && row.leaves[0].leaf.kind !== 'object' && !prefDrawsNoControl(row.leaves[0].leaf) && (
                    <h4 className={s.sectionTitle} title={row.leaves[0].leaf.description}>
                      {row.leaves[0].leaf.name}
                    </h4>
                  )}
                  {controls[0].content}
                </div>
              ) : (
              // A row several leaves share stands for no one of them.
              <div key={panelLeafKey(row.leaves[0])} className={s.row} {...(controls.every((cell) => cell.disabled) ? { 'data-disabled': '' } : {})}
                {...(row.leaves.length === 1 ? selectionAttrs(panelLeafKey(row.leaves[0]), rowMarks, true) : hiddenAttrs(marked(controls)))}>
                <span className={s.rowLabel} title={row.leaves[0].leaf.description}>
                  {row.label}
                  {marked(controls) && <HiddenBadge />}
                </span>
                <span className={s.rowControls}>
                  {controls.map(({ key, content }) => (
                    <Fragment key={key}>{content}</Fragment>
                  ))}
                </span>
              </div>
              )
            ))}
          </>
        );
        return [{ section, content, hidden: whole }];
      }), marks.lead)}
    </div>
    </PanelMarksContext.Provider>
  );
}

/** The sections in order: a run of `tab` sections as one strip, a `panel` in a box, the rest under their headings. */
function drawn(sections: ReadonlyArray<{ section: PanelSection; content: ReactNode; hidden?: boolean }>, lead: string | null | undefined): ReactNode[] {
  const out: ReactNode[] = [];
  for (let i = 0; i < sections.length; i++) {
    const { section, content } = sections[i]!;
    if (section.as !== 'tab') {
      const cls = section.as === 'panel' ? `${s.section} ${s.sectionPanel}` : s.section;
      out.push(<section key={section.key} className={cls} {...hiddenAttrs(sections[i]!.hidden === true)}>{content}</section>);
      continue;
    }
    const run = [];
    for (; i < sections.length && sections[i]!.section.as === 'tab'; i++) {
      const at = sections[i]!.section;
      const holds = at.rows.some((row) => row.leaves.some((item) => pathWithin(panelLeafKey(item), lead)));
      run.push({ id: at.key, name: at.name, content: sections[i]!.content, holds });
    }
    i--;
    out.push(<PanelTabs key={section.key} className={s.section} tabs={run} lead={lead} />);
  }
  return out;
}

function leafCell(
  panelLeaf: PanelLeaf,
  ariaLabel: string,
  nodes: readonly AnyNode[],
  renderers: Record<string, PropertyRenderer> | undefined,
  commit: (leaf: PanelLeaf, next: (prev: unknown) => unknown) => void,
  selectionKey: string,
  fields: readonly PrefFieldChoice[],
  absentAt: (path: string) => unknown,
  { disabled, hidden }: { disabled: ReadonlySet<string>; hidden: ReadonlySet<string> },
  surface: LeafSurface = 'row',
): LeafCell {
  const { path, leaf } = panelLeaf;
  const absent = absentValue(leaf);
  const aggregated = aggregateValue(nodes, path, absent);
  const mixed = aggregated === MIXED;
  const value = mixed ? undefined : aggregated;

  const ctx: PropertyRenderContext = {
    path,
    pref: leaf,
    value,
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

