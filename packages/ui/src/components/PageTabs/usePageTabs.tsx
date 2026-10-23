import { pageName } from '@weasel-js/core';
import { useCallback, useRef, useState, type KeyboardEvent, type ReactElement } from 'react';
import type { Key } from 'react-aria-components';
import { useReorderDragList, type ReorderDragHandlers, type ReorderLine } from '../../useReorderDragList';
import { DragGhost } from '../DragGhost';
import { Tab } from '../Tabs';
import type { PageTabItem, PageTabsProps } from './PageTabs';
import { RenameField } from './RenameField';
import s from './PageTabs.module.css';

/** Two presses on one tab this close together are a double press. */
const DOUBLE_PRESS_MS = 500;
/** Lit when no page is current: a key no tab has, so React Aria does not light the first. */
export const NONE = '\u0000none';

const ARROW_STEP: Partial<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowRight: 1 };

/** What a page strip draws from, straight or along a run. */
export interface PageTabsParts {
  drag: ReorderDragHandlers;
  bindList: (el: HTMLDivElement | null) => void;
  onSelectionChange: (key: Key | null) => void;
  onKeyDownCapture: (e: KeyboardEvent) => void;
  onPointerDownCapture: () => void;
  tabs: ReactElement[];
  ghost: ReactElement | null;
}

/**
 * The behavior every page strip shares, whatever its tabs lie along: a press goes to a page and a double press renames
 * it, a drag or Alt+arrow moves it. `line`, when given, is what a drag measures the tabs and the pointer along.
 */
export function usePageTabs<P extends PageTabItem>(props: PageTabsProps<P>, line?: ReorderLine): PageTabsParts {
  const { pages, current, onSelect, onRename, onMove, onTabContextMenu } = props;
  const labelOf = props.labelOf ?? pageName;
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
    line,
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

  // Captured ahead of the tab list, which would take Alt+arrow as a plain arrow and move focus.
  const onKeyDownCapture = (e: KeyboardEvent) => {
    const by = e.altKey && onMove ? ARROW_STEP[e.key] : undefined;
    const tab = (e.target as Element).closest('[role="tab"]');
    const at = tab ? Array.from(tab.parentElement?.children ?? []).indexOf(tab) : -1;
    if (by === undefined || at < 0 || pages[at] === undefined) return;
    e.preventDefault();
    e.stopPropagation();
    drag.nudge(pages[at].id, at, by);
  };

  const tabs = pages.map((page, i) => {
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
  });

  return {
    drag,
    bindList,
    onSelectionChange,
    onKeyDownCapture,
    onPointerDownCapture: () => { selectedByPress.current = null; },
    tabs,
    ghost: ghost && listRef.current
      ? (
        <DragGhost at={ghost} from={listRef.current}>
          <span className={s.ghost}>{items.find((it) => ghost.ids.includes(it.id))?.label}</span>
        </DragGhost>
      )
      : null,
  };
}
