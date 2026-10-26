import { useMemo, useState, type ReactNode } from 'react';
import { applyPrefConditions, prefAliasTargets, prefJudge, prefReader, visiblePrefSubtree, type PrefEntry, type PrefGroup, type PrefSection } from '@weasel-js/prefs';
import { Input } from '../Input';
import { MotifFrame } from '../MotifFrame';
import { withDrop, type PrefDrop } from './drop';
import { entryApplier } from './entry';
import { FORM_FRAMES, headingInline } from './frames';
import { groupHeading } from './groupHeading';
import { useDropMotion } from './dropMotion';
import { formAttrs, useDropFrame } from './dropTarget';
import { HiddenBadge, marksHidden, type MarkHiddenProps } from './hidden';
import { NoMatches } from './NoMatches';
import { filterPrefRoot, prefFieldChoices, type PrefFieldChoice } from './schema';
import type { PrefRenderer, WalkCtx } from './PrefsRow';
import { paneChildren } from './PrefsPane';
import { BarRootLayout } from './BarRootLayout';
import type { BarOrientation } from '../Bar/BarLayout';
import { RailLayout } from './RailLayout';
import { selectionAttrs, shownPath, useSelectedRow, type PrefSelectHow, type SelectionRoot } from './selection';
import { useSplitRows, type PrefSplitProps } from './splitRows';
import { useParamsPolicy } from './useParamsPolicy';
import s from './Prefs.module.css';

export type { PrefRenderer, PrefRenderContext } from './PrefsRow';

/** How a {@link PrefsForm} lays its groups out. */
export type PrefsLayout = 'columns' | 'rail' | 'list';

/** Props for {@link PrefsForm}. */
export interface PrefsFormProps extends MarkHiddenProps, PrefSplitProps {
  /** Root of the schema tree. A root drawn `as: 'bar'` is the form: one bar,
   *  whatever `layout` says. */
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
   * column. `'rail'` puts a navigation rail beside one page of settings at a
   * time: each top-level group is a page, a group nested in one is a section
   * drawn on that page with no rail entry, and a nested group set `as: 'page'`
   * opens a page of its own — what a dialog-sized surface wants, since columns
   * overflow sideways once there are more than two. `'list'` sets the root's
   * children down one column with no panel around them, nested groups as
   * sub-panels — for a form that is already the whole of a pane.
   */
  layout?: PrefsLayout;
  /** Which way a root drawn `as: 'bar'` runs. Default `'horizontal'`. */
  orientation?: BarOrientation;
  /** Show a filter field that narrows the form to matching leaves. */
  filterable?: boolean;
  /** Rail layout: how many rows the pane sets side by side. At 2 a block leaf,
   *  an object leaf, or a leaf whose value is a list spans both. Default 1. */
  rowsAcross?: 1 | 2;
  /** Rail layout: put a handle between the rail and the pane that drags the
   *  rail wider or narrower. The width is the form's own and starts at the
   *  default, 176px. */
  resizableRail?: boolean;
  /** Rail layout: path of the open page, a top-level group's or that of a group nested as `as: 'page'`.
   *  Controlled. */
  section?: string;
  /** Rail layout: path of the page open before the reader picks one.
   *  Defaults to the first in the schema. */
  defaultSection?: string;
  onSectionChange?: (path: string) => void;
  /**
   * Rail layout: each entry folds its nested entries away, shut until the
   * open group is it or one under it. Default false.
   */
  foldable?: boolean;
  /** Dotted paths whose leaves currently inherit: each still draws its control,
   *  dimmed, showing the value in `values` — pass it already resolved. Editing
   *  it calls `onChange` as usual, which is the owner's cue to pin it. */
  auto?: ReadonlySet<string>;
  /** Dotted paths whose values stand for several that disagree: a leaf's, or a
   *  field's inside an `object` or a `union` leaf (`appearance.stroke.width`).
   *  Each draws its control in its mixed state, with no value; a list or a map
   *  draws the word `Mixed` in place of its editor. Editing one calls `onChange`
   *  as usual, which is the owner's cue to write them all. While an object
   *  leaf's path or any under it is named, each of its fields is written at the
   *  field's own path and not as the whole object, so the owner keeps every
   *  value's other fields. */
  mixed?: ReadonlySet<string>;
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
  /** The schema this one's `alias` leaves point into. Default: this schema itself. A form drawn from a schema of
   *  aliases into another passes that other: each alias row is drawn as the leaf of it at the alias's path, reads
   *  and writes `values` at that path, and is hidden and disabled by that leaf's conditions as well as its own.
   *  Those conditions read `values`, and that schema's defaults where `values` holds nothing. A condition of this
   *  schema's own may read a setting of that one too: a path no leaf here holds is read there, with that leaf's
   *  default and as its control shows it. */
  over?: PrefGroup | PrefSection;
  /** Small text after an inherited leaf's label, e.g. `() => 'from Defaults'`.
   *  Default: none. */
  inheritHint?: (path: string) => string | undefined;
  /** Dotted paths of the leaves and groups to mark. Each time the last one
   *  changes the form brings it into view, and a rail opens the group that
   *  holds it. A path the form does not draw marks nothing. */
  selected?: readonly string[];
  /** The reader pressed or focused into a leaf's row, a group, or a group's
   *  entry in a rail. The empty path is the root, from the rail entry for its
   *  own leaves. `how.toggle` is true when Cmd or Ctrl was held. A press on
   *  one of several selected rows is reported on its click, so a drag can
   *  carry them all. */
  onSelect?: (path: string, how: PrefSelectHow) => void;
  /** Paths of the leaves whose rows are marked as changed, their labels in the accent color (`PropertyRow`'s `changed`): what differs
   *  from a default, or from what was last saved. What counts as changed is the caller's to say. An alias row is marked when the leaf
   *  it shows is named. */
  changed?: ReadonlySet<string>;
  /** A drag over the form. The form lays out as it would after the drop,
   *  with the dragged nodes drawn where they would land: `prefDropTargetAt`
   *  finds where that is from a pointer position. */
  drop?: PrefDrop | null;
  /** Draw groups that hold no leaves, which the form otherwise leaves out —
   *  for an editor, where an empty group is somewhere to drop into. */
  showEmpty?: boolean;
  className?: string;
}

const NO_SELECTION: readonly string[] = [];

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
    markHidden = false,
    className,
  } = props;
  const [query, setQuery] = useState('');
  // The whole schema, as for `fields`: an alias may show a leaf the filter or `showHidden` left out.
  const over = props.over ?? schema;
  const targets = useMemo(
    () => prefAliasTargets(over, (entry) => prefJudge(over, prefReader(over, values), entry), { showHidden, markHidden }),
    [over, values, showHidden, markHidden],
  );
  const keepEmpty = props.showEmpty === true;
  // Apart from the conditions, which a new `values` object asks again: what they hand back is this tree itself
  // while they drop nothing, and a drop in flight restarts whenever the tree it is drawn in is a new one.
  const visible = useMemo(() => visiblePrefSubtree(schema, showHidden, keepEmpty), [schema, showHidden, keepEmpty]);
  // The form's own conditions, each asked for one entry of a list or a map where it is given one.
  const judge = useMemo(() => {
    const read = prefReader(schema, values, props.over);
    return (entry?: PrefEntry) => prefJudge(schema, read, entry, props.over);
  }, [schema, values, props.over]);
  const applied = useMemo(
    () => (visible === null ? null : applyPrefConditions(visible, judge(), { keepEmpty, keepHidden: markHidden, aliasOver: over, aliasHolds: targets.holds })),
    [visible, judge, keepEmpty, markHidden, over, targets],
  );
  const entryAt = useMemo(() => entryApplier(judge, markHidden), [judge, markHidden]);
  const conditioned = applied?.shown ?? null;
  const root = useMemo(
    () => (conditioned === null ? null : filterPrefRoot(conditioned, query, over)),
    [conditioned, query, over],
  );

  // Every field of the whole schema, not only the visible ones: a reference may name a hidden field.
  const own = useMemo(() => prefFieldChoices(schema), [schema]);
  const fields = props.fields ?? own;
  const selected = props.selected ?? NO_SELECTION;
  const shown = useMemo(
    () => selected.map((p) => shownPath(root, p)).filter((p): p is string => p !== null),
    [root, selected],
  );
  const lead = shown.at(-1) ?? null;
  const selection = useSelectedRow(selected, lead, props.onSelect);
  const split = useSplitRows(props, schema, props.over);
  const { settles } = useParamsPolicy('form');
  const ctx: WalkCtx = { values, onChange, renderers, auto, mixed: props.mixed, onAutoChange, canInherit, inheritHint, fields, targets, changed: props.changed, selected: shown, lead, disabled: applied?.disabled, hidden: markHidden ? applied?.hidden : undefined, entryAt, droppable: props.drop !== undefined, split, settles };
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

  if (root?.as === 'bar') {
    return (
      <BarRootLayout root={root} ctx={ctx} drop={props.drop} selection={selection} orientation={props.orientation}
        filterField={field} className={className} />
    );
  }

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
  useDropMotion(selection.ref, props.drop !== undefined, drop, root, '');
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
  const marked = marksHidden(ctx.hidden, path);
  const head = groupHeading(ctx, group, path);
  const named = group.name !== '';
  return (
    <MotifFrame
      kind={depth === 0 ? 'group' : 'subpanel'}
      motif={group.motif}
      fallback={depth === 0 ? FORM_FRAMES.column : FORM_FRAMES.nested}
      title={named ? group.name : undefined}
      disabled={head.off}
      inline={named ? headingInline(marked, head.control) : undefined}
      note={group.description || undefined}
      level={3}
      className={depth === 0 ? s.panel : s.subpanel}
      attrs={selectionAttrs(path, ctx)}
    >
      {!named && marked && <HiddenBadge lead />}
      <div className={s.rows}>
        {paneChildren(ctx, head.entries, path, depth + 1, (key, child, childPath) => (
          <GroupBody key={key} ctx={ctx} group={child} path={childPath} depth={depth + 1} />
        ))}
      </div>
    </MotifFrame>
  );
}

