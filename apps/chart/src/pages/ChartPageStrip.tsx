import { pageName, useMenuHost, useMenus } from '@weasel-js/core';
import { PageTabs } from '@weasel-js/ui/components/PageTabs';
import { useCallback, useState, type ReactElement } from 'react';
import { diagramTypeOf, type DiagramTheme } from '@weasel-js/diagram';
import { PAGE_TEMPLATES } from '@weasel-js/diagram-formats';
import { getOwn } from '@weasel-js/registry';
import type { ChartScene } from '../chartDocument';
import { addChartPage, AddPageDialog } from './AddPageDialog';
import { PAGE_TAB_MENU_ID, PAGE_TAB_MENUS, usePageCommands } from './pageCommands';
import { PageSetupDialog } from './PageSetupDialog';
import type { ChartPages } from './useChartPages';

/** The page tabs under the canvas, their context menu, the Page menu's commands, Page Setup, and Add Page: the tabs' add
 *  button adds a page of the chart's own type, and Page › Add Page… a page of any kind. */
export function ChartPageStrip({ scene, pages, theme }: { scene: ChartScene; pages: ChartPages; theme: DiagramTheme }): ReactElement {
  const [setupFor, setSetupFor] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const openAdd = useCallback(() => setAdding(true), []);
  usePageCommands(pages, setSetupFor, openAdd);
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
        labelOf={pageName}
        current={pages.current}
        onSelect={pages.goTo}
        onRename={pages.rename}
        onMove={pages.move}
        onAdd={() => addChartPage(scene, pages, getOwn(PAGE_TEMPLATES, diagramTypeOf(scene).id)!, theme)}
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
      {adding && <AddPageDialog scene={scene} pages={pages} theme={theme} onClose={() => setAdding(false)} />}
    </>
  );
}
