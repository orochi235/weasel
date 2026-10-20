import { pageName, useMenuHost, useMenus } from '@weasel-js/core';
import { PageTabs } from '@weasel-js/ui/components/PageTabs';
import { useState, type ReactElement } from 'react';
import { PAGE_TAB_MENU_ID, PAGE_TAB_MENUS, usePageCommands } from './pageCommands';
import { PageSetupDialog } from './PageSetupDialog';
import type { ChartPages } from './useChartPages';

/** The page tabs under the canvas, their context menu, the Page menu's commands, and Page Setup. */
export function ChartPageStrip({ pages }: { pages: ChartPages }): ReactElement {
  const [setupFor, setSetupFor] = useState<string | null>(null);
  usePageCommands(pages, setSetupFor);
  useMenus(PAGE_TAB_MENUS);
  const host = useMenuHost();
  const index = pages.placed.findIndex((p) => p.id === setupFor);
  const setupPage = pages.placed[index];

  return (
    <>
      <PageTabs
        className="wc-pages"
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
      <PageSetupDialog
        page={setupPage ? { name: pageName(setupPage, index), size: setupPage } : null}
        onApply={(size) => { if (setupFor !== null) pages.resize(setupFor, size); }}
        onClose={() => setSetupFor(null)}
      />
    </>
  );
}
