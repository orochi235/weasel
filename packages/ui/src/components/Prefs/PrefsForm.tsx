import { useMemo, useRef, useState, type ReactNode } from 'react';
import { Input } from '../Input';
import { useScrollSpy } from '../../useScrollSpy';
import {
  filterPrefSubtree,
  isPrefLeaf,
  prefRailItems,
  visiblePrefSubtree,
  type PrefGroup,
} from './schema';
import { PrefRow, type PrefRenderer, type WalkCtx } from './PrefsRow';
import { PrefsPane } from './PrefsPane';
import { PrefsRail } from './PrefsRail';
import s from './Prefs.module.css';

export type { PrefRenderer, PrefRenderContext } from './PrefsRow';

/** How a {@link PrefsForm} lays its groups out. */
export type PrefsLayout = 'columns' | 'rail';

/** Props for {@link PrefsForm}. */
export interface PrefsFormProps {
  /** Root of the schema tree. Core `ToolPrefGroup`s assign structurally. */
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
   * overflow sideways once there are more than two.
   */
  layout?: PrefsLayout;
  /** Show a filter field that narrows the form to matching leaves. */
  filterable?: boolean;
  /** Rail layout: path of the open top-level group. Controlled. */
  section?: string;
  /** Rail layout: path of the group open before the reader picks one.
   *  Defaults to the first in the schema. */
  defaultSection?: string;
  onSectionChange?: (path: string) => void;
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
    className,
  } = props;
  const [query, setQuery] = useState('');
  const root = useMemo(() => {
    const visible = visiblePrefSubtree(schema, showHidden);
    return visible === null ? null : filterPrefSubtree(visible, query);
  }, [schema, showHidden, query]);

  const ctx: WalkCtx = { values, onChange, renderers };
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
        filterField={field}
        onClearFilter={() => setQuery('')}
      />
    );
  }

  return (
    <div className={[s.columnsLayout, className].filter(Boolean).join(' ')}>
      {field}
      {root === null ? (
        <NoMatches query={query} onClear={() => setQuery('')} />
      ) : (
        <div className={s.columns}>
          {Object.entries(root.children).map(([key, child]) => (
            <div key={key} className={s.column}>
              {isPrefLeaf(child) ? (
                // Top-level leaves are unusual but legal — give each its own
                // column for symmetry with grouped siblings.
                <PrefRow ctx={ctx} path={key} pref={child} />
              ) : (
                <GroupBody ctx={ctx} group={child} path={key} depth={0} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** The rail layout's own state: which group is open, and where the pane is
 *  scrolled to within it. Split out so the columns layout runs none of it. */
function RailLayout(props: PrefsFormProps & {
  root: PrefGroup | null;
  ctx: WalkCtx;
  query: string;
  filterField: ReactNode;
  onClearFilter: () => void;
}) {
  const { schema, root, ctx, query, filterField, onClearFilter, className } = props;
  const items = useMemo(() => (root === null ? [] : prefRailItems(root)), [root]);
  const [uncontrolled, setUncontrolled] = useState(
    () => props.defaultSection ?? '',
  );
  const requested = props.section ?? uncontrolled;
  // A filter can take the open group out of the rail entirely, and a section
  // the schema never had can arrive from a consumer's stale state. Either way
  // the first surviving entry is what the reader should be looking at.
  const open = items.some((i) => i.path === requested && i.depth === 0)
    ? requested
    : (items.find((i) => i.depth === 0)?.path ?? '');

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const sectionIds = useMemo(
    () => items.filter((i) => i.depth === 1 && i.section === open).map((i) => i.path),
    [items, open],
  );
  const spy = useScrollSpy({ rootRef: scrollRef, ids: sectionIds });

  const setOpen = (path: string): void => {
    if (props.section === undefined) setUncontrolled(path);
    props.onSectionChange?.(path);
    // Optional-called: jsdom's elements have no `scrollTo`, and neither does
    // a pane that is not the scrolling box in some consumer's layout.
    scrollRef.current?.scrollTo?.({ top: 0 });
  };

  const group = root === null ? null : paneGroup(root, open, schema.name);

  return (
    <div className={[s.railLayout, className].filter(Boolean).join(' ')}>
      <PrefsRail
        items={items}
        section={open}
        current={spy.active}
        onOpen={setOpen}
        onScrollTo={spy.scrollTo}
        ariaLabel={schema.name}
        header={filterField}
        showCounts={query.trim() !== ''}
      />
      {group === null ? (
        <div className={s.pane}>
          <NoMatches query={query} onClear={onClearFilter} />
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
      Object.entries(root.children).filter(([, child]) => isPrefLeaf(child)),
    );
    return Object.keys(children).length === 0
      ? null
      : { ...root, name: rootName, children };
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
    <div className={depth === 0 ? s.panel : s.subpanel}>
      <div className={s.groupHeader}>
        <h3 className={s.groupTitle}>{group.name}</h3>
        {group.description !== undefined && (
          <p className={s.groupDesc}>{group.description}</p>
        )}
      </div>
      <div className={s.rows}>
        {Object.entries(group.children).map(([key, child]) => {
          const childPath = `${path}.${key}`;
          return isPrefLeaf(child) ? (
            <PrefRow key={key} ctx={ctx} path={childPath} pref={child} />
          ) : (
            <GroupBody key={key} ctx={ctx} group={child} path={childPath} depth={depth + 1} />
          );
        })}
      </div>
    </div>
  );
}

