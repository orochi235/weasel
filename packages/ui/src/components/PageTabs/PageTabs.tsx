import { useCallback, useRef, useState, type MouseEvent, type ReactNode } from 'react';
import type { Key } from 'react-aria-components';
import { useReorderDragList } from '../../useReorderDragList';
import { DragGhost } from '../DragGhost';
import { Tab, TabList, Tabs } from '../Tabs';
import { RenameField } from './RenameField';
import s from './PageTabs.module.css';

/** What a page needs to be shown as a tab. */
export interface PageTabItem {
  id: string;
  name?: string;
}

/** Props for {@link PageTabs}. */
export interface PageTabsProps<P extends PageTabItem> {
  pages: readonly P[];
  /** The lit tab's page, or `null` to light none. */
  current: string | null;
  /** A tab was pressed or chosen from the keyboard, the lit one included. */
  onSelect(id: string): void;
  /** A double press renames; absent, tabs cannot be renamed. */
  onRename?(id: string, name: string): void;
  /** A tab was dragged to `index`, its place in the new order; absent, tabs cannot be dragged. */
  onMove?(id: string, index: number): void;
  /** Absent, there is no + button. */
  onAdd?(): void;
  /** A right-click on a tab. Call `preventDefault` on the event to keep the browser's own menu shut. */
  onTabContextMenu?(id: string, e: MouseEvent): void;
  /** A tab's text. Default: the page's name, else "Page" and its place. */
  labelOf?(page: P, index: number): string;
  'aria-label'?: string;
  className?: string;
}

/** Two presses on one tab this close together are a double press. */
const DOUBLE_PRESS_MS = 500;
/** Lit when no page is current: a key no tab has, so React Aria does not light the first. */
const NONE = '\u0000none';

const defaultLabel = (page: PageTabItem, index: number) => page.name ?? `Page ${index + 1}`;

/**
 * A strip of tabs over a document's pages: press one to go to its page, press
 * twice to rename it, drag to reorder, and + to add one. Built on {@link Tabs},
 * with no panels: what a tab shows is the caller's to show.
 */
export function PageTabs<P extends PageTabItem>(props: PageTabsProps<P>): ReactNode {
  const { pages, current, onSelect, onRename, onMove, onAdd, onTabContextMenu } = props;
  const labelOf = props.labelOf ?? defaultLabel;
  const [editing, setEditing] = useState<string | null>(null);
  const lastPress = useRef<{ id: string; at: number } | null>(null);
  /** The tab React Aria selected during the press under way, which the press must not report again. */
  const selectedByPress = useRef<string | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  const onPress = useCallback((id: string) => {
    const prev = lastPress.current;
    const now = performance.now();
    lastPress.current = { id, at: now };
    if (onRename && prev?.id === id && now - prev.at < DOUBLE_PRESS_MS) {
      lastPress.current = null;
      setEditing(id);
      return;
    }
    if (selectedByPress.current !== id) onSelect(id);
    selectedByPress.current = null;
  }, [onRename, onSelect]);

  const items = pages.map((p, i) => ({ id: p.id, label: labelOf(p, i) }));
  const drag = useReorderDragList({
    items,
    selectedIds: [],
    axis: 'x',
    rowSelector: '[role="tab"]',
    // A strip without onMove still runs the drag session, for its presses, but nothing crosses this threshold.
    ...(onMove ? {} : { threshold: Number.POSITIVE_INFINITY }),
    onReorder: (ids, target) => {
      const id = ids[0]!;
      const from = items.findIndex((it) => it.id === id);
      onMove?.(id, target > from ? target - 1 : target);
    },
    onPress,
  });
  const bindContainer = drag.containerProps.ref;
  const bindList = useCallback((el: HTMLDivElement | null) => {
    listRef.current = el;
    bindContainer(el);
  }, [bindContainer]);
  const { draggedIds, targetIndex, ghost } = drag.state;

  const commit = (id: string, name: string | null) => {
    setEditing(null);
    if (name !== null) onRename?.(id, name);
  };
  // React Aria selects on a pointer's press and on the keyboard; the drag's `onPress` reports the
  // rest, a press on the lit tab.
  const onSelectionChange = (key: Key | null) => {
    if (key === null || key === current || key === NONE) return;
    selectedByPress.current = String(key);
    onSelect(String(key));
  };

  return (
    <div
      className={[s.strip, props.className].filter(Boolean).join(' ')}
      onPointerDownCapture={() => { selectedByPress.current = null; }}
    >
      <Tabs className={s.tabs} selectedKey={current ?? NONE} onSelectionChange={onSelectionChange}>
        <TabList aria-label={props['aria-label'] ?? 'Pages'} className={s.list} ref={bindList}>
          {pages.map((page, i) => {
            const cls = [s.tab];
            if (draggedIds?.includes(page.id)) cls.push(s.dragging);
            if (targetIndex === i && !draggedIds?.includes(page.id)) cls.push(s.dropBefore);
            if (targetIndex === pages.length && i === pages.length - 1) cls.push(s.dropAfter);
            return (
              <Tab
                key={page.id}
                id={page.id}
                className={cls.join(' ')}
                onPointerDown={(e) => { if (e.button === 0 && editing !== page.id) drag.rowProps(page.id, i).onPointerDown(e); }}
                onContextMenu={(e) => onTabContextMenu?.(page.id, e)}
              >
                {editing === page.id
                  ? <RenameField initial={page.name ?? labelOf(page, i)} onDone={(name) => commit(page.id, name)} />
                  : labelOf(page, i)}
              </Tab>
            );
          })}
        </TabList>
      </Tabs>
      {onAdd && (
        <button type="button" className={s.add} aria-label="Add page" title="Add page" onClick={onAdd}>+</button>
      )}
      {ghost && listRef.current && (
        <DragGhost at={ghost} from={listRef.current}>
          <span className={s.ghost}>{items.find((it) => ghost.ids.includes(it.id))?.label}</span>
        </DragGhost>
      )}
    </div>
  );
}
