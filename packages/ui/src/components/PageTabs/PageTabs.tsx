import type { MouseEvent, ReactNode } from 'react';
import { useTrackShape } from '../Along/alongContext';
import { TabList, Tabs } from '../Tabs';
import { PageTabsAlong } from './PageTabsAlong';
import { NONE, usePageTabs } from './usePageTabs';
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
  /** A tab was dragged, or moved with Alt+Left or Alt+Right, to `index`, its place in the new order; absent, tabs
   *  cannot be moved. */
  onMove?(id: string, index: number): void;
  /** Absent, there is no + button. */
  onAdd?(): void;
  /** A right-click on a tab. Call `preventDefault` on the event to keep the browser's own menu shut. */
  onTabContextMenu?(id: string, e: MouseEvent): void;
  /** A tab's text. Default: the page's name, else "Page" and its place. */
  labelOf?(page: P, index: number): string;
  /** The id of the element that shows the current page, which the lit tab names as what it controls. Absent, no
   *  tab names one. */
  panelId?: string;
  'aria-label'?: string;
  className?: string;
}

/**
 * A strip of tabs over a document's pages: press one to go to its page, press
 * twice to rename it, drag or Alt+arrow to reorder, and + to add one. Built on {@link Tabs},
 * with no panels: what a tab shows is the caller's to show. Inside an `Along` with a curved
 * shape the tabs lie along it, the + button last, and a drag measures along the run.
 */
export function PageTabs<P extends PageTabItem>(props: PageTabsProps<P>): ReactNode {
  const along = useTrackShape();
  if (along !== null && along.shape.kind !== 'line') return <PageTabsAlong {...props} shape={along.shape} align={along.align} />;
  return <PageTabsLine {...props} />;
}

function PageTabsLine<P extends PageTabItem>(props: PageTabsProps<P>): ReactNode {
  const parts = usePageTabs(props);
  return (
    <div
      className={[s.strip, props.className].filter(Boolean).join(' ')}
      onPointerDownCapture={parts.onPointerDownCapture}
      onKeyDownCapture={parts.onKeyDownCapture}
    >
      <Tabs className={s.tabs} selectedKey={props.current ?? NONE} onSelectionChange={parts.onSelectionChange}>
        <TabList aria-label={props['aria-label'] ?? 'Pages'} className={s.list} ref={parts.bindList}>
          {parts.tabs}
        </TabList>
      </Tabs>
      {props.onAdd && (
        <button type="button" className={s.add} aria-label="Add page" title="Add page" onClick={props.onAdd}>+</button>
      )}
      {parts.ghost}
    </div>
  );
}
