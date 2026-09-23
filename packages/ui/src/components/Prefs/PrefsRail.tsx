import type { ReactNode } from 'react';
import { useRovingTabIndex } from '../../useRovingTabIndex';
import type { PrefRailItem } from './schema';
import s from './Prefs.module.css';

/** Props for {@link PrefsRail}. */
export interface PrefsRailProps {
  items: readonly PrefRailItem[];
  /** Path of the open depth-0 group. */
  section: string;
  /** Path of the depth-1 group in view, from the pane's scroll spy. */
  current: string | null;
  /** A depth-0 entry was chosen: open its pane. */
  onOpen: (path: string) => void;
  /** A depth-1 entry was chosen: scroll the open pane to it. */
  onScrollTo: (path: string) => void;
  /** Accessible name for the rail's landmark. */
  ariaLabel: string;
  /** Rendered above the list — the filter field, when there is one. */
  header?: ReactNode;
  /** Show each entry's match count. Only meaningful while filtering. */
  showCounts?: boolean;
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
  const activate = (index: number): void => {
    const item = items[index];
    if (!item) return;
    if (item.depth === 0) onOpen(item.path);
    else onScrollTo(item.path);
  };
  const roving = useRovingTabIndex<HTMLDivElement>({
    items: items.map(() => ({})),
    itemClassName: s.railItem,
    tabStopIndex: Math.max(0, items.findIndex((i) => i.path === section)),
  });

  return (
    <nav className={s.rail} aria-label={ariaLabel}>
      {header}
      <div className={s.railList} ref={roving.rootRef}>
        {items.map((item, index) => {
          const open = item.depth === 0 && item.path === section;
          const inView = item.depth === 1 && item.path === current;
          return (
            <button
              key={item.path === '' ? '\u0000root' : item.path}
              type="button"
              className={[s.railItem, item.depth === 1 && s.railSub, open && s.railOpen, inView && s.railInView]
                .filter(Boolean)
                .join(' ')}
              aria-current={open ? 'page' : inView ? 'location' : undefined}
              tabIndex={roving.tabIndexFor(index)}
              onKeyDown={roving.onKeyDown(index)}
              onClick={() => activate(index)}
            >
              <span className={s.railName}>{item.name}</span>
              {showCounts ? <span className={s.railCount}>{item.matches}</span> : null}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
