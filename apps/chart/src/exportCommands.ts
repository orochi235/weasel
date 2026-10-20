import { pageName, useCommand, type PlacedPage } from '@weasel-js/core';
import { exportPagePng, exportPageSvg } from '@weasel-js/diagram-formats';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { downloadBlob } from '@editor/index';
import type { ChartScene } from './chartDocument';
import { run } from './menuBar';
import type { ChartPages } from './pages/useChartPages';

export const EXPORT_ACTIONS = {
  svg: 'chart.export.svg', png1: 'chart.export.png1', png2: 'chart.export.png2', png4: 'chart.export.png4',
} as const;

/** File › Export. */
export const EXPORT_MENU: PrefGroup = pref.group('', {
  export: pref.group('Export', { page: run(EXPORT_ACTIONS) }, { as: 'menu' }),
});

/** The page an export draws: the one in view, else the first. */
function exportedPage(pages: ChartPages): PlacedPage | undefined {
  return pages.placed.find((p) => p.id === pages.current) ?? pages.placed[0];
}

function exportPage(pages: ChartPages, write: (page: PlacedPage, name: string) => Promise<{ blob: Blob; name: string }>): void {
  const page = exportedPage(pages);
  if (page === undefined) return;
  write(page, pageName(page, page.index))
    .then(({ blob, name }) => downloadBlob(blob, name))
    .catch((err: unknown) => console.warn('weaselchart: could not export the page', err));
}

/** Registers File › Export's commands: the page in view as an SVG document, or as a PNG at 1×, 2×, or 4×. */
export function useExportCommands(scene: ChartScene, pages: ChartPages): void {
  useCommand(EXPORT_ACTIONS.svg, 'Page as SVG…', () => exportPage(pages, async (page, name) => ({
    blob: new Blob([await exportPageSvg(scene, page, { title: name })], { type: 'image/svg+xml' }),
    name: `${name}.svg`,
  })));
  usePngCommand(scene, pages, 1);
  usePngCommand(scene, pages, 2);
  usePngCommand(scene, pages, 4);
}

function usePngCommand(scene: ChartScene, pages: ChartPages, scale: 1 | 2 | 4): void {
  useCommand(EXPORT_ACTIONS[`png${scale}`], `Page as PNG (${scale}×)`, () => exportPage(pages, async (page, name) => ({
    blob: await exportPagePng(scene, page, { scale }),
    name: scale === 1 ? `${name}.png` : `${name}@${scale}x.png`,
  })));
}
