import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { isPrefLeaf, prefGroupIsPage, type PrefGroup } from '@weasel-js/prefs';
import { ResizeHandle } from '../ResizeHandle';
import { dropDrawnPath, withDrop } from './drop';
import { useDropMotion } from './dropMotion';
import { formAttrs, useDropFrame } from './dropTarget';
import { NoMatches } from './NoMatches';
import type { PrefsFormProps } from './PrefsForm';
import { PrefsPane } from './PrefsPane';
import { PrefsRail } from './PrefsRail';
import { markScrollbar } from './scrollbar';
import type { WalkCtx } from './PrefsRow';
import { looseEntryName, prefGroupNests, prefGroupOpensPage, prefPageHasOwn, prefRailAbove, prefRailItems, prefRailParent } from './schema';
import { pathWithin, type SelectionRoot } from './selection';
import s from './Prefs.module.css';

/** The rail's width before a drag; the stylesheet's fallback for `--wzl-prefs-rail-width`. */
const RAIL_WIDTH = 176;

/** The rail layout's own state: which page is open, and where the pane is
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
  const [railWidth, setRailWidth] = useState<number | null>(null);
  const requested = props.section ?? uncontrolled;
  // A filter can take the open group out of the rail entirely, and a section
  // the schema never had can arrive from a consumer's stale state. Either way
  // the first surviving entry is what the reader should be looking at.
  const opens = (path: string): boolean => items.some((i) => i.path === path);
  // A page that went while it was open, its group now a section of the page above, leaves that page open.
  let above: string | null = requested;
  while (above !== null && above !== '' && !opens(above)) above = prefRailParent(above);
  let open = above !== null && opens(above) ? above : (items.find((i) => i.depth === 0)?.path ?? '');
  // A page with nothing of its own opens the first entry under it.
  while (root !== null && open !== '' && !hasOwn(paneGroup(root, open, schema.name))) {
    const under = open;
    const first = items.find((i) => prefRailAbove(items, i.path) === under);
    if (first === undefined) break;
    open = first.path;
  }

  const scrollRef = useRef<HTMLDivElement | null>(null);

  const show = (path: string): void => {
    if (props.section === undefined) setUncontrolled(path);
    props.onSectionChange?.(path);
  };
  // Optional-called: jsdom's elements have no `scrollTo`, and neither does
  // a pane that is not the scrolling box in some consumer's layout.
  const toTop = (): void => {
    scrollRef.current?.scrollTo?.({ top: 0 });
  };
  const setOpen = (path: string): void => {
    show(path);
    toTop();
  };
  // The pane's scrolling box outlives the page in it, and a page opens at its top however it came to open.
  useLayoutEffect(toTop, [open]);

  // The page holding the selection: the deepest page it is or lies under, else the loose leaves.
  const selected = props.ctx.lead ?? null;
  const home = selected === null ? null : items
    .filter((i) => pathWithin(i.path, selected))
    .reduce((best, i) => (i.path.length > best.length ? i.path : best), '');
  const latest = useRef({ home, open, show });
  useEffect(() => { latest.current = { home, open, show }; });
  // Opened when the selection moves, and when its page does under it: a selected group made a page of its own.
  useEffect(() => {
    const now = latest.current;
    if (now.home !== null && now.home !== now.open) now.show(now.home);
  }, [selected, home]);

  // The form as the drop would leave it. `open` and `items` above are the form's own, which the drop leaves alone.
  const drop = useDropFrame(selection.ref, props.drop, root, open);
  useDropMotion(selection.ref, props.drop !== undefined, drop, root, open);
  const drawn = useMemo(() => (root !== null && drop ? withDrop(root, drop) : root), [root, drop]);
  const drawnItems = useMemo(
    () => (drawn === root || drawn === null ? items : prefRailItems(drawn)),
    [drawn, root, items],
  );
  const ctx: WalkCtx = { ...props.ctx, drop };
  // A page being dragged stays the open one, drawn where it would land.
  const page = dropDrawnPath(drop, open);
  const whole = drawn === null ? null : paneGroup(drawn, page, schema.name);
  const group = useMemo(() => (whole === null ? null : ownOf(whole)), [whole]);

  return (
    <div className={[s.railLayout, className].filter(Boolean).join(' ')} data-across={props.rowsAcross === 2 ? 2 : undefined} {...formAttrs(drop)}
      style={railWidth === null ? undefined : ({ '--wzl-prefs-rail-width': `${railWidth}px` } as CSSProperties)} {...selection}>
      <PrefsRail
        items={drawnItems}
        section={page}
        onOpen={setOpen}
        ariaLabel={schema.name}
        header={filterField}
        showCounts={query.trim() !== ''}
        foldable={props.foldable === true} hidden={props.ctx.hidden}
        dropInto={drop?.rail && drop.where === 'into' ? drop.path : null}
      />
      {props.resizableRail === true && (
        <ResizeHandle value={railWidth ?? RAIL_WIDTH} min={120} max={360} onInput={setRailWidth} ariaLabel="Resize sections" />
      )}
      {group === null ? (
        <div className={s.pane} ref={markScrollbar} data-pref-into="" data-pref-scroll="">
          <NoMatches query={query} onClear={onClearFilter} />
        </div>
      ) : (
        // Keyed by the form's own open page: `page` moves while that page is dragged, which must not remount it.
        <PrefsPane ctx={ctx} group={group} path={page} pageKey={open} scrollRef={scrollRef} />
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

const hasOwn = (group: PrefGroup | null): boolean => group !== null && prefPageHasOwn(group);

/** A group cut down to what its own page draws: itself, its sections, and its fragments, less each group in them
 *  that opens a page of its own. The group itself when that is all of it. */
function ownOf(group: PrefGroup): PrefGroup {
  let cut = false;
  const children: PrefGroup['children'] = {};
  for (const [key, child] of Object.entries(group.children)) {
    if (!isPrefLeaf(child) && prefGroupOpensPage(child)) {
      cut = true;
      continue;
    }
    const own = isPrefLeaf(child) || !(prefGroupNests(child) || child.as === 'fragment') ? child : ownOf(child);
    if (own !== child) cut = true;
    children[key] = own;
  }
  return cut ? { ...group, children } : group;
}
