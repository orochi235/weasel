import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import {
  filterPrefSubtree,
  isPrefLeaf,
  prefGroupIsPage,
  visiblePrefSubtree,
  type PrefGroup,
} from '@weasel-js/prefs';
import { Input } from '../Input';
import { ResizeHandle } from '../ResizeHandle';
import { useScrollSpy } from '../../useScrollSpy';
import {
  prefFieldChoices,
  looseEntryName,
  prefRailItems,
  type PrefFieldChoice,
} from './schema';
import type { PrefRenderer, WalkCtx } from './PrefsRow';
import { paneChildren, PrefsPane } from './PrefsPane';
import { PrefsRail } from './PrefsRail';
import { selectionAttrs, shownPath, useSelectedRow, type PrefDropMark, type SelectionRoot } from './selection';
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
   * Rail layout: a nested entry opens a page of its own group instead of
   * scrolling the open one to it, and a top-level entry's page holds only its
   * own leaves (or opens its first nested entry when it has none). For a
   * top-level group whose subgroups are long enough that one page of all of
   * them reads as a wall. Default false.
   */
  subPages?: boolean;
  /**
   * Rail layout: each top-level entry folds its nested entries away, shut
   * until its group is the one open. Default false.
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
  /** Where a drag would drop, for the form to mark: `prefDropTargetAt` finds
   *  one from a pointer position. */
  dropMark?: PrefDropMark | null;
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
  const ctx: WalkCtx = { values, onChange, renderers, auto, onAutoChange, canInherit, inheritHint, fields, selected: shown, dropMark: props.dropMark };
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

  if (layout === 'list') {
    return (
      <div className={[s.columnsLayout, className].filter(Boolean).join(' ')} {...selection}>
        {field}
        {root === null ? (
          <NoMatches query={query} onClear={() => setQuery('')} />
        ) : (
          <div className={s.rows}>
            {paneChildren(ctx, Object.entries(root.children), '', 1, (key, child, path) => (
              <GroupBody key={key} ctx={ctx} group={child} path={path} depth={1} />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={[s.columnsLayout, className].filter(Boolean).join(' ')} {...selection}>
      {field}
      {root === null ? (
        <NoMatches query={query} onClear={() => setQuery('')} />
      ) : (
        <div className={s.columns}>
          {/* A column per top-level child; a run of tabs shares one. */}
          {paneChildren(ctx, Object.entries(root.children), '', 0, (key, child, path) => (
            <GroupBody key={key} ctx={ctx} group={child} path={path} depth={0} />
          )).map((child, i) => (
            <div key={i} className={s.column}>{child}</div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The rail's width before a drag; the stylesheet's fallback for `--wzl-prefs-rail-width`. */
const RAIL_WIDTH = 176;

/** The rail layout's own state: which group is open, and where the pane is
 *  scrolled to within it. Split out so the columns layout runs none of it. */
function RailLayout(props: PrefsFormProps & {
  root: PrefGroup | null;
  ctx: WalkCtx;
  query: string;
  selection: SelectionRoot;
  filterField: ReactNode;
  onClearFilter: () => void;
}) {
  const { schema, root, ctx, query, selection, filterField, onClearFilter, className } = props;
  const items = useMemo(() => (root === null ? [] : prefRailItems(root)), [root]);
  const [uncontrolled, setUncontrolled] = useState(
    () => props.defaultSection ?? '',
  );
  const subPages = props.subPages === true;
  const [railWidth, setRailWidth] = useState<number | null>(null);
  const requested = props.section ?? uncontrolled;
  // A filter can take the open group out of the rail entirely, and a section
  // the schema never had can arrive from a consumer's stale state. Either way
  // the first surviving entry is what the reader should be looking at.
  let open = items.some((i) => i.path === requested && (i.depth === 0 || subPages))
    ? requested
    : (items.find((i) => i.depth === 0)?.path ?? '');
  if (subPages && root !== null && !hasLeaves(paneGroup(root, open, schema.name))) {
    open = items.find((i) => i.depth === 1 && i.section === open)?.path ?? open;
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionIds = useMemo(
    () =>
      subPages
        ? []
        : items.filter((i) => i.depth === 1 && i.section === open).map((i) => i.path),
    [items, open, subPages],
  );
  const spy = useScrollSpy({ rootRef: scrollRef, ids: sectionIds });

  const show = (path: string): void => {
    if (props.section === undefined) setUncontrolled(path);
    props.onSectionChange?.(path);
  };
  const setOpen = (path: string): void => {
    show(path);
    // Optional-called: jsdom's elements have no `scrollTo`, and neither does
    // a pane that is not the scrolling box in some consumer's layout.
    scrollRef.current?.scrollTo?.({ top: 0 });
  };

  // The page holding the selection: the deepest rail entry it is or lies under, else the loose leaves.
  const selected = ctx.selected ?? null;
  const home = selected === null ? null : items
    .filter((i) => (i.depth === 0 || subPages) && (selected === i.path || selected.startsWith(`${i.path}.`)))
    .reduce((best, i) => (i.path.length > best.length ? i.path : best), '');
  const latest = useRef({ home, open, show });
  useEffect(() => { latest.current = { home, open, show }; });
  useEffect(() => {
    const now = latest.current;
    if (now.home !== null && now.home !== now.open) now.show(now.home);
  }, [props.selected]);

  const whole = root === null ? null : paneGroup(root, open, schema.name);
  const opensTop = items.some((i) => i.path === open && i.depth === 0);
  const group = subPages && opensTop && whole !== null ? leavesOf(whole) : whole;

  return (
    <div className={[s.railLayout, className].filter(Boolean).join(' ')} data-across={props.rowsAcross === 2 ? 2 : undefined}
      style={railWidth === null ? undefined : ({ '--wzl-prefs-rail-width': `${railWidth}px` } as CSSProperties)} {...selection}>
      <PrefsRail
        items={items}
        section={open}
        current={subPages ? null : spy.active}
        onOpen={setOpen}
        onScrollTo={subPages ? setOpen : spy.scrollTo}
        ariaLabel={schema.name}
        header={filterField}
        showCounts={query.trim() !== ''}
        foldable={props.foldable === true}
        dropInto={props.dropMark?.rail ? props.dropMark.path : null}
      />
      {props.resizableRail === true && (
        <ResizeHandle value={railWidth ?? RAIL_WIDTH} min={120} max={360} onInput={setRailWidth} ariaLabel="Resize sections" />
      )}
      {group === null ? (
        <div className={s.pane} data-pref-into="">
          {query.trim() !== '' && <NoMatches query={query} onClear={onClearFilter} />}
        </div>
      ) : (
        <PrefsPane ctx={ctx} group={group} path={open} scrollRef={scrollRef} />
      )}
    </div>
  );
}

/**
 * The group a rail path opens. The empty path is the root's loose leaves,
 * which belong to no group of their own and are handed back as one named for
 * the schema — the rail lists them under the same name.
 */
function paneGroup(root: PrefGroup, path: string, rootName: string): PrefGroup | null {
  if (path === '') {
    const children = Object.fromEntries(
      Object.entries(root.children).filter(([, child]) => isPrefLeaf(child) || !prefGroupIsPage(child)),
    );
    return Object.keys(children).length === 0
      ? null
      : { ...root, name: looseEntryName(rootName), children };
  }
  let node: PrefGroup | undefined;
  let cursor = root;
  for (const seg of path.split('.')) {
    const next = cursor.children[seg];
    if (next === undefined || isPrefLeaf(next)) return null;
    node = next;
    cursor = next;
  }
  return node ?? null;
}

/** Whether a group holds any leaf directly, not counting its subgroups. */
function hasLeaves(group: PrefGroup | null): boolean {
  return group !== null && Object.values(group.children).some(isPrefLeaf);
}

/** A group cut down to its direct leaves, for a page its subgroups each get their own of. */
function leavesOf(group: PrefGroup): PrefGroup {
  return {
    ...group,
    children: Object.fromEntries(
      Object.entries(group.children).filter(([, child]) => isPrefLeaf(child)),
    ),
  };
}

/** What a filter matching nothing leaves behind. */
function NoMatches({ query, onClear }: { query: string; onClear: () => void }) {
  return (
    <div className={s.noMatches}>
      <p>No settings match “{query.trim()}”.</p>
      <button type="button" className={s.clearFilter} onClick={onClear}>
        Clear filter
      </button>
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

