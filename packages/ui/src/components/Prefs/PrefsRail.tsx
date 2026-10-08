import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import { Disclosure } from '../Disclosure';
import type { PrefRailItem } from './schema';
import s from './Prefs.module.css';

/** Props for {@link PrefsRail}. */
export interface PrefsRailProps {
  items: readonly PrefRailItem[];
  /** Path of the open group: depth 0, or depth 1 under `subPages`. */
  section: string;
  /** Path of the depth-1 group in view, from the pane's scroll spy. */
  current: string | null;
  /** A depth-0 entry was chosen: open its pane. */
  onOpen: (path: string) => void;
  /** A depth-1 entry was chosen: scroll the open pane to it, or, under
   *  `subPages`, open it. */
  onScrollTo: (path: string) => void;
  /** Accessible name for the rail's landmark. */
  ariaLabel: string;
  /** Rendered above the list — the filter field, when there is one. */
  header?: ReactNode;
  /** Show each entry's match count. Only meaningful while filtering. */
  showCounts?: boolean;
  /**
   * Each depth-0 entry with nested ones folds them away behind a fold mark,
   * shut until its group is the one open. Right and Left on the entry unfold
   * and fold it. Everything is unfolded while filtering, so every match shows.
   */
  foldable?: boolean;
}

/**
 * The rail beside a `PrefsForm` pane: depth-0 groups, each followed by the
 * depth-1 groups that scroll within it.
 *
 * A list of buttons rather than a tablist, because only half of these entries
 * switch anything — the nested ones scroll the pane the selected entry already
 * opened, and a tab that does not own a panel has no honest role. The open
 * group is `aria-current="page"`; the nested group in view is
 * `aria-current="location"`.
 */
export function PrefsRail(props: PrefsRailProps) {
  const { items, section, current, onOpen, onScrollTo, ariaLabel, header, showCounts } = props;
  const foldable = props.foldable === true;
  const selected = items.find((i) => i.path === section)?.section ?? null;
  // Folds the reader set by hand, by section; any other group is unfolded only while it is selected.
  const [folds, setFolds] = useState<ReadonlyMap<string, boolean>>(new Map());
  const [lastSelected, setLastSelected] = useState(selected);
  if (selected !== lastSelected) {
    setLastSelected(selected);
    if (selected !== null && folds.has(selected)) setFolds(without(folds, selected));
  }
  const unfolded = (path: string): boolean =>
    !foldable || showCounts === true || (folds.get(path) ?? path === selected);
  const fold = (path: string, open: boolean): void => setFolds(new Map(folds).set(path, open));

  const nests = new Set(items.filter((i) => i.depth === 1).map((i) => i.section));
  const shown = items.filter((i) => i.depth === 0 || unfolded(i.section));

  const activate = (index: number): void => {
    const item = shown[index];
    if (!item) return;
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

  return (
    <nav className={s.rail} aria-label={ariaLabel}>
      {header}
      <div
        className={foldable ? `${s.railList} ${s.railFoldable}` : s.railList}
        ref={roving.rootRef}
        onKeyDown={onKeyDown}
      >
        {shown.map((item, index) => {
          const open = item.path === section;
          const inView = item.depth === 1 && item.path === current;
          const nested = foldable && item.depth === 0 && nests.has(item.path);
          const entry = (
            <button
              key={item.path === '' ? '\u0000root' : item.path}
              type="button"
              className={[s.railItem, item.depth === 1 && s.railSub, open && s.railOpen, inView && s.railInView]
                .filter(Boolean)
                .join(' ')}
              aria-current={open ? 'page' : inView ? 'location' : undefined}
              data-rail-fold={nested ? item.path : undefined}
              onClick={() => activate(index)}
            >
              <span className={s.railName}>{item.name}</span>
              {showCounts ? <span className={s.railCount}>{item.matches}</span> : null}
            </button>
          );
          if (!foldable || item.depth === 1) return entry;
          return (
            <div key={`row:${item.path}`} className={s.railRow}>
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
          );
        })}
      </div>
    </nav>
  );
}

function without<K, V>(map: ReadonlyMap<K, V>, key: K): Map<K, V> {
  const next = new Map(map);
  next.delete(key);
  return next;
}
