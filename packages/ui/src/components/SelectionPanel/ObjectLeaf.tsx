/**
 * An object leaf in a selection panel: the object's own fields as rows, and
 * each section of them as its `as` says.
 */
import { Fragment, useContext, type ReactNode } from 'react';
import { isPrefLeaf, pairRowsOf, prefObjectBase, prefObjectWithField, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { HiddenBadge, hiddenAttrs } from '../Prefs/hidden';
import { objectRows, type ObjectLeafParts } from '../Prefs/objectRows';
import { pathWithin, selectionAttrs } from '../Prefs/selection';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { absentValue, MIXED, sharedValue } from './model';
import { renderCells, type LeafCell } from './cells';
import type { PropertyRenderContext, PropertyRenderer } from './renderContext';
import { renderBuiltin } from './renderLeaf';
import { PanelMarksContext, PanelTabs } from './selection';
import s from './SelectionPanel.module.css';

/** One labeled row inside an object leaf; `pair` merges adjacent fields into
 *  it, exactly as the section rows merge theirs. */
interface ObjectRow {
  key: string;
  pair?: string;
  label: string;
  title?: string;
  /** Every field in the row brought its own chrome, so the row drops the
   *  label column and spans the block. One unlabeled field in an otherwise
   *  labeled pair would leave the row named after half of itself. */
  block: boolean;
  /** Every field in the row is disabled. */
  disabled: boolean;
  /** Every field in the row is one a `showIf` hides. */
  hidden: boolean;
  controls: ReactNode[];
}

/**
 * Renders an object leaf: the object's own fields, as rows. A child's edit
 * commits the parent object, never the child's path — writing into a path
 * whose value is not an object yet would corrupt it.
 */
export function ObjectLeaf({
  ctx,
  renderers,
  selectionKey = '',
}: {
  ctx: PropertyRenderContext;
  renderers?: Record<string, PropertyRenderer>;
  selectionKey?: string;
}): ReactNode {
  const pref = ctx.pref as PrefObject;
  const marks = useContext(PanelMarksContext);
  const held = typeof ctx.value === 'object' && ctx.value !== null
    ? (ctx.value as Record<string, unknown>)
    : undefined;
  const eachObject = ctx.each.map((v) =>
    typeof v === 'object' && v !== null ? (v as Record<string, unknown>) : undefined,
  );

  // A value whose fields all sit under sections is titled by them — its
  // own heading would stack onto the first one and name nothing new.
  const allGrouped = Object.values(pref.children).every((child) => !isPrefLeaf(child));

  // Every field's full path, so a `pair` resolves against the paths the
  // fields are written at.
  const pairs = pairRowsOf(
    prefSectionLeaves(pref.children).map(([key, leaf]) => [`${ctx.path}.${key}`, leaf] as const),
  );

  /** One field as an unrendered cell: its row form, or its bar form in a section drawn as a bar. */
  const cellOf = (key: string, child: PrefLeaf, surface: LeafSurface): LeafCell => {
    const childPath = `${ctx.path}.${key}`;
    // Nodes whose objects differ still agree or disagree field by field: two
    // styles at different sizes are both upright, and saying "mixed" for
    // every field of them hides that.
    // A field the object omits reads as the child says absence does. One of an object the node does not hold
    // has nothing behind it, whatever the child says.
    const absent = absentValue(child);
    const fieldOf = (o: Record<string, unknown> | undefined): unknown => (o === undefined || o[key] !== undefined ? o?.[key] : absent);
    const each = eachObject.map(fieldOf);
    const shared = ctx.mixed ? sharedValue(each) : fieldOf(held);
    const field = shared === MIXED ? { value: undefined, mixed: true } : { value: shared, mixed: false };
    // Each node's own object, with this one field changed. Deriving it per
    // node is what keeps a multi-selection edit from writing one node's
    // object over all the others.
    const update = (fn: (prev: unknown, siblings?: Record<string, unknown>) => unknown): void =>
      ctx.update((prev) => {
        const base = prefObjectBase(pref, prev);
        return prefObjectWithField(pref, base, key, fn(fieldOf(base), base));
      });
    const childCtx: PropertyRenderContext = {
      path: childPath,
      ...(ctx.fields ? { fields: ctx.fields } : {}),
      pref: child,
      value: field.mixed ? undefined : field.value,
      mixed: field.mixed,
      unset: !field.mixed && field.value === undefined,
      siblings: held,
      each,
      eachSiblings: eachObject,
      valueAt: ctx.valueAt,
      selectionKey: ctx.selectionKey,
      update,
      setValue: (v) => update(() => v),
      disabled: ctx.disabled === true || ctx.disabledAt?.(childPath) === true,
      disabledAt: ctx.disabledAt,
      hidden: ctx.hidden === true || ctx.hiddenAt?.(childPath) === true,
      hiddenAt: ctx.hiddenAt,
    };
    const pair = pairs.get(childPath);
    return {
      key: childPath,
      leaf: child,
      ctx: childCtx,
      ariaLabel: child.name,
      ...(pair ? { pair } : {}),
      render: () => {
        const custom = renderers?.[childPath] ?? renderers?.[child.kind];
        if (surface === 'bar') {
          return custom
            ? withBarLabel(child, custom(childCtx))
            : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true, surface });
        }
        const rendered = custom
          ? custom(childCtx)
          : renderBuiltin(childCtx, child.name, renderers, { selectionKey, nested: true });
        if (rendered == null) return null;
        // Neither a paired row nor a block one gives a field its own label
        // column, so the glyph is all that names it on screen. The control
        // already carries `name` as its accessible name, which leaves the
        // glyph decorative.
        const unlabeled = pairs.has(childPath) || child.block === true;
        const glyph = unlabeled && child.icon && child.icon in ICON_PATHS;
        if (!glyph) return rendered;
        return (
          <span className={s.namedField}>
            <Icon name={child.icon as IconName} size={14} />
            {rendered}
          </span>
        );
      },
    };
  };

  const parts: ObjectLeafParts<LeafCell> = {
    path: ctx.path,
    cell: cellOf,
    // Neighbors are drawn together, so a run of paired flags fuses in a bar as it does in a row.
    barCells: (cells) => renderCells(cells, renderers).map((cell) => ({ kind: 'cell', path: cell.key, content: cell.content })),
    // A run of adjacent same-`pair` fields shares a row; a section between two fields ends the run, since it ends
    // the cells it is handed.
    rows: (cells) => {
      const rows: ObjectRow[] = [];
      for (const { key, leaf, block, disabled, hidden, content, pair } of renderCells(cells, renderers)) {
        const prev = rows[rows.length - 1];
        if (pair !== undefined && prev?.pair === pair.key) {
          prev.controls.push(<Fragment key={key}>{content}</Fragment>);
          prev.block &&= block;
          prev.disabled &&= disabled;
          prev.hidden &&= hidden;
          continue;
        }
        rows.push({
          key,
          ...(pair ? { pair: pair.key } : {}),
          label: pair?.label ?? leaf.name,
          title: leaf.description,
          block,
          disabled,
          hidden,
          controls: [<Fragment key={key}>{content}</Fragment>],
        });
      }
      // A row several fields share stands for no one of them.
      const attrs = (entry: ObjectRow) =>
        cells.filter((cell) => cell.pair !== undefined && cell.pair.key === entry.pair).length > 1 ? {} : selectionAttrs(entry.key, marks, true);
      // The leaf's own mark covers its fields; a row hidden on its own carries one.
      const marked = (entry: ObjectRow): boolean => entry.hidden && ctx.hidden !== true;
      return rows.map((entry) =>
        entry.block ? (
          <div key={entry.key} className={`${s.rowControls} ${s.blockRow}`} title={entry.title} {...attrs(entry)} {...hiddenAttrs(marked(entry))}>
            {marked(entry) && <HiddenBadge lead />}
            {entry.controls}
          </div>
        ) : (
          <div key={entry.key} className={s.row} {...attrs(entry)} {...hiddenAttrs(marked(entry))} {...(entry.disabled ? { 'data-disabled': '' } : {})}>
            <span className={s.rowLabel} title={entry.title}>{entry.label}{marked(entry) && <HiddenBadge />}</span>
            <span className={s.rowControls}>{entry.controls}</span>
          </div>
        ),
      );
    },
    barAttrs: (at, leaf) => (leaf ? selectionAttrs(at, marks, true) : {}),
    tabs: (run) => (
      <PanelTabs
        lead={marks.lead}
        tabs={run.map((tab) => ({
          ...tab,
          holds: prefSectionLeaves(tab.section.members).some(([key]) => pathWithin(`${ctx.path}.${key}`, marks.lead)),
        }))}
      />
    ),
    // Depth is drawn only where a label marks it.
    frame: (key, section, inner, { labeled, indent }) => [
      <div key={`group:${key}`} className={section.as === 'panel' ? s.objectPanel : labeled && indent ? s.objectGroup : undefined}>
        {labeled && <h5 className={s.sectionTitle}>{section.name}</h5>}
        {inner}
      </div>,
    ],
  };

  const rows = objectRows(pref.children, parts, !allGrouped);
  if (rows.length === 0) return null;
  return (
    <div className={s.objectLeaf}>
      {!allGrouped && <h4 className={s.sectionTitle}>{pref.name}</h4>}
      {rows}
    </div>
  );
}
