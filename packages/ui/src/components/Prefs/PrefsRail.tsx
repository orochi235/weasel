import { Fragment, useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { Disclosure } from '../Disclosure';
import { dropSlot, isDropPath } from './drop';
import { HiddenBadge, hiddenAttrs, marksHidden } from './hidden';
import { prefRailAbove, prefRailParent, type PrefRailItem } from './schema';
import s from './Prefs.module.css';

/** Props for {@link PrefsRail}. */
export interface PrefsRailProps {
  items: readonly PrefRailItem[];
  /** Path of the open page. */
  section: string;
  /** Path of the section of the open page in view, from the pane's scroll spy. */
  current: string | null;
  /** A page's entry was chosen: open it. */
  onOpen: (path: string) => void;
  /** A section's entry was chosen: scroll its page to it, opening that page first if another is open. */
  onScrollTo: (path: string) => void;
  /** Accessible name for the rail's landmark. */
  ariaLabel: string;
  /** Rendered above the list — the filter field, when there is one. */
  header?: ReactNode;
  /** Show each entry's match count. Only meaningful while filtering. */
  showCounts?: boolean;
  /**
   * Each entry with nested ones folds them away behind a fold mark, shut
   * until the open page is it or one under it. Right and Left on the entry unfold
   * and fold it. Everything is unfolded while filtering, so every match shows.
   */
  foldable?: boolean;
  /** Path of the entry to mark as the one a drag would drop into. An entry whose path is a drop placeholder's is
   *  drawn as one. */
  dropInto?: string | null;
  /** Paths a `showIf` hides, in a form given `markHidden`: each one's entry is dimmed, and the outermost carries the badge. */
  hidden?: ReadonlySet<string>;
}

/**
 * The rail beside a `PrefsForm` pane: each page's entry, followed by those of
 * the groups nested in it. A nested entry scrolls its page to a section, or
 * opens a page of its own, as its item's `page` says.
 *
 * A list of buttons rather than a tablist, because only some of these entries
 * switch anything — a section's scrolls the pane a page's entry already
 * opened, and a tab that does not own a panel has no honest role.
 *
 * Two marks say where the reader is. The open page's entry is
 * `aria-current="page"` and the entry of the section in view is
 * `aria-current="location"`. Whichever of them is the reader's place carries
 * `data-rail-mark="current"`, the strong mark: the section in view, or the
 * page while none of its sections is. Under a current section its page carries
 * `data-rail-mark="open"`, the weak one.
 */
export function PrefsRail(props: PrefsRailProps) {
  const { items, section, current, onOpen, onScrollTo, ariaLabel, header, showCounts, dropInto, hidden } = props;
  const foldable = props.foldable === true;
  const holds = (path: string): boolean => {
    for (let at: string | null = section; at !== null; at = prefRailAbove(items, at)) if (at === path) return true;
    return false;
  };
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

  const parentOf = (item: PrefRailItem): string | null => (item.depth === 0 ? null : prefRailAbove(items, item.path));
  const nests = new Set(items.map(parentOf));
  const shown = items.filter((item) => {
    for (let at = parentOf(item); at !== null; at = prefRailAbove(items, at)) if (!unfolded(at)) return false;
    return true;
  });

  const activate = (item: PrefRailItem): void => {
    if (item.page === item.path) onOpen(item.path);
    else onScrollTo(item.path);
  };
  // The reader's place: the section in view, the nearest entry above one that is folded away, or the open page.
  let place = current !== null && items.some((i) => i.path === current && i.page === section) ? current : section;
  while (place !== section && !shown.some((i) => i.path === place)) place = prefRailParent(place) ?? section;
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
      const here = item.path === place;
      const nested = nests.has(item.path);
      const entry = (
        <button
          type="button"
          className={[s.railItem, item.depth > 0 && s.railSub, item.passes && s.railPasses].filter(Boolean).join(' ')}
          aria-current={open ? 'page' : here ? 'location' : undefined}
          data-rail-mark={here ? 'current' : open ? 'open' : undefined}
          data-rail-fold={foldable && nested ? item.path : undefined}
          data-pref-rail={isDropPath(item.path) ? undefined : item.path}
          data-drop-placeholder={isDropPath(item.path) ? dropSlot(item.path) ?? '' : undefined}
          data-drop-rail={isDropPath(item.path) ? '' : undefined}
          data-drop={dropInto === item.path ? 'into' : undefined}
          {...hiddenAttrs(hidden?.has(item.path) === true)}
          onClick={() => activate(item)}
        >
          <span className={s.railName}>{item.name}</span>
          {marksHidden(hidden, item.path) && <HiddenBadge gapped />}
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
