import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { Disclosure } from '../Disclosure';
import { dropSlot, isDropPath } from './drop';
import { prefRailParent, type PrefRailItem } from './schema';
import s from './Prefs.module.css';

/** Props for {@link PrefsRail}. */
export interface PrefsRailProps {
  items: readonly PrefRailItem[];
  /** Path of the open group: depth 0, or any depth under `subPages`. */
  section: string;
  /** Path of the depth-1 group in view, from the pane's scroll spy. */
  current: string | null;
  /** A depth-0 entry was chosen: open its pane. */
  onOpen: (path: string) => void;
  /** A nested entry was chosen: scroll the open pane to it, or, under
   *  `subPages`, open it. */
  onScrollTo: (path: string) => void;
  /** Accessible name for the rail's landmark. */
  ariaLabel: string;
  /** Rendered above the list — the filter field, when there is one. */
  header?: ReactNode;
  /** Show each entry's match count. Only meaningful while filtering. */
  showCounts?: boolean;
  /**
   * Each entry with nested ones folds them away behind a fold mark, shut
   * until the open group is it or one under it. Right and Left on the entry unfold
   * and fold it. Everything is unfolded while filtering, so every match shows.
   */
  foldable?: boolean;
  /** Path of the entry to mark as the one a drag would drop into. An entry whose path is a drop placeholder's is
   *  drawn as one. */
  dropInto?: string | null;
}

/**
 * The rail beside a `PrefsForm` pane: depth-0 groups, each followed by the
 * groups nested in it, which scroll within its pane or, under `subPages`,
 * open panes of their own and nest further.
 *
 * A list of buttons rather than a tablist, because only half of these entries
 * switch anything — the nested ones scroll the pane the selected entry already
 * opened, and a tab that does not own a panel has no honest role. The open
 * group is `aria-current="page"`; the nested group in view is
 * `aria-current="location"`.
 */
export function PrefsRail(props: PrefsRailProps) {
  const { items, section, current, onOpen, onScrollTo, ariaLabel, header, showCounts, dropInto } = props;
  const foldable = props.foldable === true;
  const holds = (path: string): boolean => section === path || (path !== '' && section.startsWith(`${path}.`));
  // Folds the reader set by hand, by entry; any other entry is unfolded only while the open group is it or under it.
  const [folds, setFolds] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [lastSection, setLastSection] = useState(section);
  if (section !== lastSection) {
    setLastSection(section);
    const kept = new Map([...folds].filter(([path]) => !holds(path)));
    if (kept.size !== folds.size) setFolds(kept);
  }
  const unfolded = (path: string): boolean =>
    !foldable || showCounts === true || (folds.get(path) ?? holds(path));
  const fold = (path: string, open: boolean): void => setFolds(new Map(folds).set(path, open));

  const parentOf = (item: PrefRailItem): string | null => (item.depth === 0 ? null : prefRailParent(item.path));
  const nests = new Set(items.map(parentOf));
  const shown = items.filter((item) => {
    for (let at = parentOf(item); at !== null; at = prefRailParent(at)) if (!unfolded(at)) return false;
    return true;
  });

  const activate = (item: PrefRailItem): void => {
    if (item.depth === 0) onOpen(item.path);
    else onScrollTo(item.path);
  };
  const roving = useRovingTabIndex<HTMLDivElement>({
    itemSelector: `.${s.railItem}`,
    orientation: foldable ? 'vertical' : 'both',
    tabStopIndex: Math.max(0, shown.findIndex((i) => i.path === section)),
  });
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>): void => {
    const path = (e.target as HTMLElement).dataset.railFold;
    if (foldable && path !== undefined && (e.key === 'ArrowRight' || e.key === 'ArrowLeft')) {
      e.preventDefault();
      fold(path, e.key === 'ArrowRight');
      return;
    }
    roving.onKeyDown(e);
  };

  /** The entries under `parent`, each followed by its own. */
  const entries = (parent: string | null): ReactNode[] =>
    shown.filter((item) => parentOf(item) === parent).map((item) => {
      const key = item.path === '' ? '\u0000root' : item.path;
      const open = item.path === section;
      const inView = item.depth > 0 && item.path === current;
      const nested = nests.has(item.path);
      const entry = (
        <button
          type="button"
          className={[s.railItem, item.depth > 0 && s.railSub, open && s.railOpen, inView && s.railInView, item.passes && s.railPasses]
            .filter(Boolean)
            .join(' ')}
          aria-current={open ? 'page' : inView ? 'location' : undefined}
          data-rail-fold={foldable && nested ? item.path : undefined}
          data-pref-rail={isDropPath(item.path) ? undefined : item.path}
          data-drop-placeholder={isDropPath(item.path) ? dropSlot(item.path) ?? '' : undefined}
          data-drop-rail={isDropPath(item.path) ? '' : undefined}
          data-drop={dropInto === item.path ? 'into' : undefined}
          onClick={() => activate(item)}
        >
          <span className={s.railName}>{item.name}</span>
          {showCounts ? <span className={s.railCount}>{item.matches}</span> : null}
        </button>
      );
      return (
        <Fragment key={key}>
          {foldable ? (
            <div className={s.railRow}>
              {nested ? (
                <Disclosure
                  open={unfolded(item.path)}
                  onToggle={() => fold(item.path, !unfolded(item.path))}
                  label={item.name}
                  tabIndex={-1}
                  className={s.railFold}
                />
              ) : (
                <span className={s.railFold} aria-hidden="true" />
              )}
              {entry}
            </div>
          ) : entry}
          {nested && unfolded(item.path) && <div className={s.railNest}>{entries(item.path)}</div>}
        </Fragment>
      );
    });

  return (
    <nav className={s.rail} aria-label={ariaLabel} data-pref-scroll="">
      {header}
      <div className={s.railList} ref={roving.rootRef} onKeyDown={onKeyDown}>
        {entries(null)}
      </div>
    </nav>
  );
}
