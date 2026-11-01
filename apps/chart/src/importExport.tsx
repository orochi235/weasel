import { pageName, useCommand } from '@weasel-js/core';
import { diagramThemeFrom, rendererMeasure } from '@weasel-js/diagram';
import {
  DIAGRAM_FORMATS, documentFromScene, documentSpecs, formatTakes, readDocument, scenePageKinds, writtenPage, type DiagramFormat,
} from '@weasel-js/diagram-formats';
import type { PrefGroup } from '@weasel-js/prefs';
import { downloadBlob, pickFile, reportFileWarnings, menuRun } from '@weasel-js/editor';
import type { ReactElement } from 'react';
import { chartDoc, type ChartScene } from './chartDocument';
import { replaceChart } from './chartPersistence';
import { can } from './menuBar';
import type { ChartPages } from './pages/useChartPages';
import { CHART_DEFAULT_THEME, chartThemeOf } from './theme/themeCommands';

export const IMPORT_ACTION = 'chart.import';

const READABLE = DIAGRAM_FORMATS.filter((f) => f.read !== undefined);
const WRITABLE = DIAGRAM_FORMATS.filter((f) => f.write !== undefined);

/** File › Export › As …: one command per format that writes, by format id. */
export const FORMAT_EXPORT_ACTIONS: Readonly<Record<string, string>> =
  Object.fromEntries(WRITABLE.map((f) => [f.id, `chart.export.format.${f.id}`]));

/** File › Export's run of formats. */
export const FORMAT_EXPORT_RUN: PrefGroup = menuRun(FORMAT_EXPORT_ACTIONS);

/** Replaces the chart with the diagram file `file` holds, as one undo entry, "Import". Resolves with what the file had
 *  that a chart cannot hold; rejects on a file no format reads. */
export async function importChart(scene: ChartScene, file: { name: string; text(): Promise<string> }): Promise<readonly string[]> {
  const { document, warnings } = await readDocument(await file.text(), file.name);
  const theme = diagramThemeFrom(document.theme, CHART_DEFAULT_THEME);
  const { specs, doc } = documentSpecs(document, { layer: 'shapes', theme, measure: rendererMeasure });
  replaceChart(scene, { specs, doc: chartDoc(doc) }, 'Import');
  return warnings;
}

/** The chart in `format`: the whole chart, or for a one-page format the page in view, named for what it holds. */
export function exportChart(scene: ChartScene, format: DiagramFormat, pages: ChartPages): { blob: Blob; name: string; warnings: readonly string[] } {
  const doc = documentFromScene(scene, { theme: chartThemeOf(scene) });
  const page = pages.current ?? undefined;
  const { text, warnings } = format.write!(doc, page !== undefined ? { page } : {});
  const written = format.onePage ? writtenPage(doc, page !== undefined ? { page } : {}) : null;
  const index = written === null ? -1 : doc.pages.indexOf(written);
  const base = written === null ? 'chart' : pageName(written, index);
  return { blob: new Blob([text], { type: 'text/plain' }), name: `${base}${format.extensions[0] ?? ''}`, warnings };
}

async function pickAndImport(scene: ChartScene): Promise<void> {
  const file = await pickFile(READABLE.flatMap((f) => f.extensions).join(','));
  if (file === null) return;
  reportFileWarnings('Imported', await importChart(scene, file), 'chart-import-warnings');
}

function FormatExport({ scene, pages, format }: { scene: ChartScene; pages: ChartPages; format: DiagramFormat }): null {
  useCommand(FORMAT_EXPORT_ACTIONS[format.id]!, `As ${format.name}…`, () => {
    const { blob, name, warnings } = exportChart(scene, format, pages);
    downloadBlob(blob, name);
    reportFileWarnings('Exported', warnings, 'chart-export-warnings');
  }, { enabled: () => can(formatTakes(format, scenePageKinds(scene))) });
  return null;
}

/** Registers File › Import… and File › Export's command for every diagram format that writes, each off while the format cannot
 *  hold every kind of page the chart has. */
export function ImportExportCommands({ scene, pages }: { scene: ChartScene; pages: ChartPages }): ReactElement {
  useCommand(IMPORT_ACTION, 'Import…', () => {
    pickAndImport(scene).catch((err: unknown) => console.warn('weaselchart: could not import the file', err));
  });
  return <>{WRITABLE.map((format) => <FormatExport key={format.id} scene={scene} pages={pages} format={format} />)}</>;
}
