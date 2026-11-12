import { pageName, useCommand, type PlacedPage } from '@weasel-js/core';
import { exportPagePng, exportPageSvg, exportPagesPdf } from '@weasel-js/diagram-formats';
import { pref, type PrefGroup } from '@weasel-js/prefs';
import { downloadBlob, reportFileWarnings, menuRun } from '@weasel-js/editor';
import type { ChartScene } from './chartDocument';
import { FORMAT_EXPORT_RUN } from './importExport';
import type { ChartPages } from './pages/useChartPages';
import { reportFailure } from './reportFailure';

export const EXPORT_ACTIONS = {
  pdf: 'chart.export.pdf', svg: 'chart.export.svg', png1: 'chart.export.png1', png2: 'chart.export.png2', png4: 'chart.export.png4',
} as const;

/** File › Export: the page in view as an image, then the chart in each diagram format. */
export const EXPORT_MENU: PrefGroup = pref.group('', {
  export: pref.group('Export', { page: menuRun(EXPORT_ACTIONS), formats: FORMAT_EXPORT_RUN }, { as: 'menu' }),
});

/** The page an export draws: the one shown (`DocPages.shown`). */
function exportedPage(pages: ChartPages): PlacedPage | undefined {
  return pages.shown ?? undefined;
}

/** A page export's file, and what it could not carry, which the toast `warnings` names says. */
interface ExportedPage {
  blob: Blob;
  name: string;
  warnings?: { toast: string; said: readonly string[] };
}

function exportPage(pages: ChartPages, write: (page: PlacedPage, name: string) => Promise<ExportedPage>): void {
  const page = exportedPage(pages);
  if (page === undefined) return;
  write(page, pageName(page, page.index))
    .then(({ blob, name, warnings }) => {
      downloadBlob(blob, name);
      if (warnings) reportFileWarnings('Exported', warnings.said, warnings.toast);
    })
    .catch(reportFailure('Could not export the page'));
}

/** Registers File › Export's commands: every page as one PDF, the page in view as an SVG document, or as a PNG at 1×, 2×, or 4×. */
export function useExportCommands(scene: ChartScene, pages: ChartPages): void {
  usePdfCommand(scene, pages);
  useCommand(EXPORT_ACTIONS.svg, 'Page as SVG…', () => exportPage(pages, async (page, name) => {
    const said: string[] = [];
    const svg = await exportPageSvg(scene, page, { title: name, onWarn: (w) => said.push(w) });
    return { blob: new Blob([svg], { type: 'image/svg+xml' }), name: `${name}.svg`, warnings: { toast: 'chart-export-svg', said } };
  }));
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

function usePdfCommand(scene: ChartScene, pages: ChartPages): void {
  useCommand(EXPORT_ACTIONS.pdf, 'Pages as PDF…', () => {
    if (pages.placed.length === 0) return;
    exportPagesPdf(scene, pages.placed)
      .then(({ blob, skipped }) => {
        downloadBlob(blob, 'chart.pdf');
        reportFileWarnings('Exported', skipped.map((s) => s.detail), 'chart-export-pdf');
      })
      .catch(reportFailure('Could not export the pages'));
  });
}
