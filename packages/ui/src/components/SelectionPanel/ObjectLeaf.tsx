/**
 * An object leaf in a selection panel: the object's own fields as rows, and
 * each section of them as its `as` says.
 */
import { Fragment, type ReactNode } from 'react';
import { isPrefLeaf, pairRowsOf, prefSectionLeaves, type PrefLeaf, type PrefObject } from '@weasel-js/prefs';
import { BarLayout, type BarNode } from '../Bar/BarLayout';
import { withBarLabel, type LeafSurface } from '../Bar/renderBarLeaf';
import { GroupTabs, type GroupTab } from '../Prefs/GroupTabs';
import { Icon } from '../../icons/Icon';
import { ICON_PATHS, type IconName } from '../../icons/paths';
import { absentValue, MIXED, sharedValue } from './model';
import { renderBuiltin, renderCells, type LeafCell, type PropertyRenderContext, type PropertyRenderer } from './renderLeaf';
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
        // The node holds no object yet, so writing one field has to
        // materialize the rest: the leaf's `default` is what a complete
        // value looks like. Starting from `{}` instead committed the one
        // field on its own — a `data.stroke` of `{ width: 2 }` with no
        // `paint`, which the type forbids and the painter threw on, taking
        // the whole frame and the visible document with it.
        const base: Record<string, unknown> =
          typeof prev === 'object' && prev !== null
            ? (prev as Record<string, unknown>)
            : (pref.fromScalar?.(prev)
              ?? (typeof pref.default === 'object' && pref.default !== null
                ? { ...(pref.default as Record<string, unknown>) }
                : {}));
        const v = fn(fieldOf(base), base);
        if (v === undefined) {
          // A field written as absent is absent — leaving the key holding
          // `undefined` says the object has a dash of nothing.
          const { [key]: _dropped, ...rest } = base;
          return rest;
        }
        return { ...base, [key]: v };
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

  /** A section drawn as a bar: its fields on one line in their bar forms, a nested section as a run between dividers. */
  const barNodes = (members: PrefObject['children']): BarNode[] => {
    const out: BarNode[] = [];
    // Neighbors are drawn together, so a run of paired flags fuses as it does in a row.
    let pending: LeafCell[] = [];
    const flush = (): void => {
      for (const cell of renderCells(pending, renderers)) out.push({ kind: 'cell', path: cell.key, content: cell.content });
      pending = [];
    };
    for (const [key, child] of Object.entries(members)) {
      if (isPrefLeaf(child)) {
        pending.push(cellOf(key, child, 'bar'));
        continue;
      }
      flush();
      out.push({ kind: 'run', path: `${ctx.path}.${key}`, nodes: barNodes(child.members) });
    }
    flush();
    return out;
  };

  // `indent` is false when nothing visible sits above these rows: depth is
  // drawn only where a label marks it.
  const rowsOf = (
    children: PrefObject['children'],
    indent: boolean,
  ): ReactNode[] => {
    const out: (ReactNode | ObjectRow)[] = [];
    const isRow = (v: ReactNode | ObjectRow): v is ObjectRow =>
      typeof v === 'object' && v !== null && 'controls' in v;

    // Cells accumulate unrendered so a run of adjacent same-`pair` flags can
    // be seen as a run before any of them draws; a section heading between two
    // fields ends the run, exactly as it ends a paired row.
    let pending: LeafCell[] = [];
    const flush = (): void => {
      for (const { key, leaf, block, content, pair } of renderCells(pending, renderers)) {
        const prev = out[out.length - 1];
        if (pair !== undefined && isRow(prev) && prev.pair === pair.key) {
          prev.controls.push(<Fragment key={key}>{content}</Fragment>);
          prev.block &&= block;
          continue;
        }
        out.push({
          key,
          ...(pair ? { pair: pair.key } : {}),
          label: pair?.label ?? leaf.name,
          title: leaf.description,
          block,
          controls: [<Fragment key={key}>{content}</Fragment>],
        });
      }
      pending = [];
    };

    // A run of neighboring `tab` sections, held until something else ends it.
    let tabs: GroupTab[] = [];
    const flushTabs = (): void => {
      if (tabs.length > 0) out.push(<GroupTabs key={`tabs:${tabs[0]!.id}`} tabs={tabs} />);
      tabs = [];
    };

    for (const [key, child] of Object.entries(children)) {
      if (!isPrefLeaf(child)) {
        if (child.as === 'bar') {
          const nodes = barNodes(child.members);
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
        const inner = rowsOf(child.members, labeled && child.as !== 'tab');
        if (inner.length === 0) continue;
        flush();
        if (child.as === 'tab') {
          tabs.push({ id: key, name: child.name, content: inner });
          continue;
        }
        flushTabs();
        const cls = child.as === 'panel' ? s.objectPanel : labeled && indent ? s.objectGroup : undefined;
        out.push(
          <div key={`group:${key}`} className={cls}>
            {labeled && <h5 className={s.sectionTitle}>{child.name}</h5>}
            {inner}
          </div>,
        );
        continue;
      }
      flushTabs();
      pending.push(cellOf(key, child, 'row'));
    }
    flush();
    flushTabs();
    return out.map((entry) =>
      typeof entry === 'object' && entry !== null && 'controls' in entry ? (
        entry.block ? (
          <div key={entry.key} className={`${s.rowControls} ${s.blockRow}`} title={entry.title}>
            {entry.controls}
          </div>
        ) : (
          <div key={entry.key} className={s.row}>
            <span className={s.rowLabel} title={entry.title}>{entry.label}</span>
            <span className={s.rowControls}>{entry.controls}</span>
          </div>
        )
      ) : (
        entry
      ),
    );
  };

  const rows = rowsOf(pref.children, !allGrouped);
  if (rows.length === 0) return null;
  return (
    <div className={s.objectLeaf}>
      {!allGrouped && <h4 className={s.sectionTitle}>{pref.name}</h4>}
      {rows}
    </div>
  );
}
