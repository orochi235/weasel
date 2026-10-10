import { useMemo, useState, type ReactNode } from 'react';
import { filterPrefSubtree, visiblePrefSubtree, type PrefGroup } from '@weasel-js/prefs';
import { Input } from '../Input';
import { withDrop, type PrefDrop } from './drop';
import { formAttrs, useDropFrame } from './dropTarget';
import { NoMatches } from './NoMatches';
import { prefFieldChoices, type PrefFieldChoice } from './schema';
import type { PrefRenderer, WalkCtx } from './PrefsRow';
import { paneChildren } from './PrefsPane';
import { RailLayout } from './RailLayout';
import { selectionAttrs, shownPath, useSelectedRow, type SelectionRoot } from './selection';
import s from './Prefs.module.css';

export type { PrefRenderer, PrefRenderContext } from './PrefsRow';

/** How a {@link PrefsForm} lays its groups out. */
export type PrefsLayout = 'columns' | 'rail' | 'list';

/** Props for {@link PrefsForm}. */
export interface PrefsFormProps {
  /** Root of the schema tree. */
  schema: PrefGroup;
  /** Nested value tree (shape mirrors the schema). Sparse is fine —
   *  missing leaves fall back to their schema `default`. */
  values?: unknown;
  /** Change callback with the leaf's dotted path. Values apply live;
   *  there is no dirty/commit state. */
  onChange: (path: string, value: unknown) => void;
  /**
   * Per-kind renderers for app-defined kinds. Entries also override the
   * built-in kinds when keys collide. A renderer owns the control cell
   * (the label/tooltip row chrome stays with the form, unless the leaf
   * sets `block`); returning `null` collapses the row entirely. Unknown
   * kinds with no renderer show a labeled placeholder instead of
   * crashing.
   */
  renderers?: Record<string, PrefRenderer>;
  /** Reveal `hidden` leaves (dev tooling). Default false. */
  showHidden?: boolean;
  /**
   * `'columns'` (the default) wraps each top-level group into its own panel
   * column. `'rail'` puts a two-level navigation rail beside one group's
   * settings at a time — what a dialog-sized surface wants, since columns
   * overflow sideways once there are more than two. `'list'` sets the root's
   * children down one column with no panel around them, nested groups as
   * sub-panels — for a form that is already the whole of a pane.
   */
  layout?: PrefsLayout;
  /** Show a filter field that narrows the form to matching leaves. */
  filterable?: boolean;
  /** Rail layout: how many rows the pane sets side by side. At 2 a block or
   *  object leaf spans both. Default 1. */
  rowsAcross?: 1 | 2;
  /** Rail layout: put a handle between the rail and the pane that drags the
   *  rail wider or narrower. The width is the form's own and starts at the
   *  default, 176px. */
  resizableRail?: boolean;
  /** Rail layout: path of the open top-level group. Controlled. */
  section?: string;
  /** Rail layout: path of the group open before the reader picks one.
   *  Defaults to the first in the schema. */
  defaultSection?: string;
  onSectionChange?: (path: string) => void;
  /**
   * Rail layout: every nested group gets an entry, at any depth, and opens a
   * page of its own instead of scrolling the open one to it. A page holds its
   * group's own leaves, tabs, and panels, and a group with none of those opens
   * its first nested entry. For a group whose subgroups are long enough that
   * one page of all of them reads as a wall. Default false.
   */
  subPages?: boolean;
  /**
   * Rail layout: each entry folds its nested entries away, shut until the
   * open group is it or one under it. Default false.
   */
  foldable?: boolean;
  /** Dotted paths whose leaves currently inherit: each still draws its control,
   *  dimmed, showing the value in `values` — pass it already resolved. Editing
   *  it calls `onChange` as usual, which is the owner's cue to pin it. */
  auto?: ReadonlySet<string>;
  /** Given, a leaf's label toggles whether it inherits: `next` true unpins it,
   *  false pins it at the value it shows. Leaves `canInherit` refuses keep a
   *  plain label. */
  onAutoChange?: (path: string, next: boolean) => void;
  /** Which leaves can inherit, and so get a label toggle. Default: every leaf,
   *  once `onAutoChange` is given. */
  canInherit?: (path: string) => boolean;
  /** The fields a `field` leaf may name. Default: this schema's own — a form
   *  that edits another schema passes that one's. */
  fields?: readonly PrefFieldChoice[];
  /** Small text after an inherited leaf's label, e.g. `() => 'from Defaults'`.
   *  Default: none. */
  inheritHint?: (path: string) => string | undefined;
  /** Dotted path of a leaf or a group to mark. Each time it changes the form
   *  brings it into view, and a rail opens the group that holds it. A path the
   *  form does not draw marks nothing. */
  selected?: string;
  /** The reader pressed or focused into a leaf's row or a group. */
  onSelect?: (path: string) => void;
  /** A drag over the form. The form lays out as it would after the drop,
   *  with the dragged nodes drawn where they would land: `prefDropTargetAt`
   *  finds where that is from a pointer position. */
  drop?: PrefDrop | null;
  /** Draw groups that hold no leaves, which the form otherwise leaves out —
   *  for an editor, where an empty group is somewhere to drop into. */
  showEmpty?: boolean;
  className?: string;
}

/**
 * Schema-driven preferences form. Leaves render as label + control rows;
 * how the groups around them are arranged is `layout`'s to say — columns of
 * panels, or a navigation rail beside one group at a time.
 *
 * Storage-agnostic: pair with `PrefsDialog` for the modal composition, and
 * persist however the app likes via `onChange`.
 */
export function PrefsForm(props: PrefsFormProps) {
  const {
    schema,
    values,
    onChange,
    renderers,
    showHidden = false,
    layout = 'columns',
    filterable = false,
    auto,
    onAutoChange,
    canInherit,
    inheritHint,
    className,
  } = props;
  const [query, setQuery] = useState('');
  const root = useMemo(() => {
    const visible = visiblePrefSubtree(schema, showHidden, props.showEmpty === true);
    return visible === null ? null : filterPrefSubtree(visible, query);
  }, [schema, showHidden, query, props.showEmpty]);

  // Every field of the whole schema, not only the visible ones: a reference may name a hidden field.
  const own = useMemo(() => prefFieldChoices(schema), [schema]);
  const fields = props.fields ?? own;
  const shown = useMemo(() => shownPath(root, props.selected), [root, props.selected]);
  const selection = useSelectedRow(props.selected, shown, props.onSelect);
  const ctx: WalkCtx = { values, onChange, renderers, auto, onAutoChange, canInherit, inheritHint, fields, selected: shown };
  const field = filterable ? (
    <div className={s.filter}>
      <Input
        value={query}
        onChange={setQuery}
        aria-label={`Filter ${schema.name}`}
        placeholder="Filter settings"
      />
    </div>
  ) : null;

  if (layout === 'rail') {
    return (
      <RailLayout
        {...props}
        root={root}
        ctx={ctx}
        query={query}
        selection={selection}
        filterField={field}
        onClearFilter={() => setQuery('')}
      />
    );
  }

  return (
    <FlatLayout root={root} ctx={ctx} drop={props.drop} list={layout === 'list'} selection={selection} className={className}
      filterField={field} noMatches={<NoMatches query={query} onClear={() => setQuery('')} />} />
  );
}

/** The columns and list layouts: every group drawn at once, a column each or one under another. */
function FlatLayout(props: {
  root: PrefGroup | null;
  /** Everything the rows read but the drop, which the layout settles. */
  ctx: WalkCtx;
  drop?: PrefDrop | null;
  list: boolean;
  selection: SelectionRoot;
  filterField: ReactNode;
  noMatches: ReactNode;
  className?: string;
}) {
  const { root, list, selection } = props;
  const drop = useDropFrame(selection.ref, props.drop, root, '');
  const drawn = useMemo(() => (root !== null && drop ? withDrop(root, drop) : root), [root, drop]);
  const ctx: WalkCtx = { ...props.ctx, drop };
  const depth = list ? 1 : 0;
  const children = drawn === null ? [] : paneChildren(ctx, Object.entries(drawn.children), '', depth, (key, child, path) => (
    <GroupBody key={key} ctx={ctx} group={child} path={path} depth={depth} />
  ));
  return (
    <div className={[s.columnsLayout, props.className].filter(Boolean).join(' ')} {...formAttrs(drop)} {...selection}>
      {props.filterField}
      {drawn === null ? props.noMatches : list ? (
        <div className={s.rows}>{children}</div>
      ) : (
        // A column per top-level child; a run of tabs shares one.
        <div className={s.columns} data-pref-scroll="">
          {children.map((child, i) => <div key={i} className={s.column}>{child}</div>)}
        </div>
      )}
    </div>
  );
}

function GroupBody({ ctx, group, path, depth }: {
  ctx: WalkCtx;
  group: PrefGroup;
  path: string;
  depth: number;
}) {
  return (
    <div className={depth === 0 ? s.panel : s.subpanel} {...selectionAttrs(path, ctx)}>
      {(group.name !== '' || group.description) && (
        <div className={s.groupHeader}>
          {group.name !== '' && <h3 className={s.groupTitle}>{group.name}</h3>}
          {group.description && <p className={s.groupDesc}>{group.description}</p>}
        </div>
      )}
      <div className={s.rows}>
        {paneChildren(ctx, Object.entries(group.children), path, depth + 1, (key, child, childPath) => (
          <GroupBody key={key} ctx={ctx} group={child} path={childPath} depth={depth + 1} />
        ))}
      </div>
    </div>
  );
}

