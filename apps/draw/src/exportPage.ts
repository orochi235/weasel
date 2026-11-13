import {
  exportPages, exportRegions, pageName, selectionRegion, type ExportFormat, type ExportOptions, type PlacedPage,
} from '@weasel-js/core';
import { downloadBlob, reportFileWarnings } from '@weasel-js/editor';
import { registerPdfExport } from '@weasel-js/pdf/export';
import { registerSvgExport } from '@weasel-js/svg';
import { DEFAULT_FILENAME } from './docPersistence';
import type { DrawScene } from './drawDocument';
import { reportExportFailure } from './fileNotices';
import type { SavedDoc } from './saveSvg';

/** Output pixels per world unit in an exported PNG: 192 to the inch. */
export const PNG_SCALE = 2;

/** Register the export formats draw offers beside core's PNG: SVG and PDF. Returns the disposer. */
export function registerDrawExports(): () => void {
  const svg = registerSvgExport();
  const pdf = registerPdfExport();
  return () => {
    pdf();
    svg();
  };
}

const baseName = (doc: SavedDoc): string => (doc.filename.trim() || DEFAULT_FILENAME).replace(/\.svg$/i, '');

/** Download what `write` makes as `name` in `format`, and toast what it left out or why it failed. */
async function writeExport(
  format: ExportFormat, name: string, doc: SavedDoc, write: (opts: ExportOptions & Record<string, unknown>) => Promise<Blob>,
): Promise<void> {
  const warnings: string[] = [];
  try {
    const blob = await write({
      background: doc.backgroundColor, scale: PNG_SCALE, title: name, onWarn: (w: string) => warnings.push(w),
    });
    downloadBlob(blob, `${name}.${format.extension}`);
  } catch (err) {
    reportExportFailure(format.extension.toUpperCase(), err);
    return;
  }
  reportFileWarnings('Exported', warnings, 'export-warnings');
}

/**
 * Download `pages` in `format`, which takes one page unless it is `multiRegion`:
 * one page is named for the document and the page, several for the document.
 */
export function exportPagesFile(scene: DrawScene, format: ExportFormat, pages: readonly PlacedPage[], doc: SavedDoc): Promise<void> {
  const [only] = pages;
  const name = !format.multiRegion && only ? `${baseName(doc)} - ${pageName(only, only.index)}` : baseName(doc);
  return writeExport(format, name, doc, (opts) => exportPages(scene, pages, format.id, opts));
}

/** Download the box `ids` draw in, in `format`, named for the document. Nothing happens when they draw nothing. */
export function exportSelectionFile(scene: DrawScene, format: ExportFormat, ids: readonly string[], doc: SavedDoc): Promise<void> {
  const name = `${baseName(doc)} - Selection`;
  const region = selectionRegion(scene, ids, 'Selection');
  if (region === null) return Promise.resolve();
  return writeExport(format, name, doc, (opts) => exportRegions(scene, [region], format.id, opts));
}
