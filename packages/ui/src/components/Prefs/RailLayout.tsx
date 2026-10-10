import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isPrefLeaf, prefGroupIsPage, type PrefGroup } from '@weasel-js/prefs';
import { ResizeHandle } from '../ResizeHandle';
import { useScrollSpy } from '../../useScrollSpy';
import { dropDrawnPath, withDrop } from './drop';
import { formAttrs, useDropFrame } from './dropTarget';
import { NoMatches } from './NoMatches';
import type { PrefsFormProps } from './PrefsForm';
import { PrefsPane } from './PrefsPane';
import { PrefsRail } from './PrefsRail';
import type { WalkCtx } from './PrefsRow';
import { looseEntryName, prefRailItems } from './schema';
import type { SelectionRoot } from './selection';
import s from './Prefs.module.css';

/** The rail's width before a drag; the stylesheet's fallback for `--wzl-prefs-rail-width`. */
const RAIL_WIDTH = 176;

/** The rail layout's own state: which group is open, and where the pane is
 *  scrolled to within it. Split out so the columns layout runs none of it. */
export function RailLayout(props: PrefsFormProps & {
  root: PrefGroup | null;
  /** Everything the rows read but the drop, which the layout settles. */
  ctx: WalkCtx;
  query: string;
  selection: SelectionRoot;
  filterField: ReactNode;
  onClearFilter: () => void;
}) {
  const { schema, root, query, selection, filterField, onClearFilter, className } = props;
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
  const selected = props.ctx.selected ?? null;
  const home = selected === null ? null : items
    .filter((i) => (i.depth === 0 || subPages) && (selected === i.path || selected.startsWith(`${i.path}.`)))
    .reduce((best, i) => (i.path.length > best.length ? i.path : best), '');
  const latest = useRef({ home, open, show });
  useEffect(() => { latest.current = { home, open, show }; });
  useEffect(() => {
    const now = latest.current;
    if (now.home !== null && now.home !== now.open) now.show(now.home);
  }, [props.selected]);

  // The form as the drop would leave it. `open` and `items` above are the form's own, which the drop leaves alone.
  const drop = useDropFrame(selection.ref, props.drop, root, open);
  const drawn = useMemo(() => (root !== null && drop ? withDrop(root, drop) : root), [root, drop]);
  const drawnItems = useMemo(() => (drawn === root || drawn === null ? items : prefRailItems(drawn)), [drawn, root, items]);
  const ctx: WalkCtx = { ...props.ctx, drop };
  // A page being dragged stays the open one, drawn where it would land.
  const page = dropDrawnPath(drop, open);
  const whole = drawn === null ? null : paneGroup(drawn, page, schema.name);
  const opensTop = items.some((i) => i.path === open && i.depth === 0);
  const group = subPages && opensTop && whole !== null ? leavesOf(whole) : whole;

  return (
    <div className={[s.railLayout, className].filter(Boolean).join(' ')} data-across={props.rowsAcross === 2 ? 2 : undefined} {...formAttrs(drop)}
      style={railWidth === null ? undefined : ({ '--wzl-prefs-rail-width': `${railWidth}px` } as CSSProperties)} {...selection}>
      <PrefsRail
        items={drawnItems}
        section={page}
        current={subPages ? null : spy.active}
        onOpen={setOpen}
        onScrollTo={subPages ? setOpen : spy.scrollTo}
        ariaLabel={schema.name}
        header={filterField}
        showCounts={query.trim() !== ''}
        foldable={props.foldable === true}
        dropInto={drop?.rail && drop.where === 'into' ? drop.path : null}
      />
      {props.resizableRail === true && (
        <ResizeHandle value={railWidth ?? RAIL_WIDTH} min={120} max={360} onInput={setRailWidth} ariaLabel="Resize sections" />
      )}
      {group === null ? (
        <div className={s.pane} data-pref-into="" data-pref-scroll="">
          {query.trim() !== '' && <NoMatches query={query} onClear={onClearFilter} />}
        </div>
      ) : (
        <PrefsPane ctx={ctx} group={group} path={page} scrollRef={scrollRef} />
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
