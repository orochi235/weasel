import { useMenuHost, useMenus } from '@weasel-js/core';
import { PageTabs } from '@weasel-js/ui/components/PageTabs';
import type { DocPages } from '@editor/index';
import type { ReactElement } from 'react';
import { PAGE_TAB_MENU_ID, PAGE_TAB_MENUS, usePageCommands } from './pageCommands';
import './pageStrip.css';

/** The page tabs under the workspace, their context menu, and the page commands. */
export function DrawPageStrip({ pages }: { pages: DocPages }): ReactElement {
  usePageCommands(pages);
  useMenus(PAGE_TAB_MENUS);
  const host = useMenuHost();
  return (
    <PageTabs
      className="wd-pages"
      aria-label="Pages"
      pages={pages.placed}
      current={pages.current}
      onSelect={pages.goTo}
      onRename={pages.rename}
      onMove={pages.move}
      onAdd={pages.add}
      onTabContextMenu={(id, e) => {
        const opened = host?.open({ menu: PAGE_TAB_MENU_ID, client: { x: e.clientX, y: e.clientY }, params: { page: id }, source: 'pointer' });
        if (opened) e.preventDefault();
      }}
    />
  );
}
