import { pageName, type PlacedPage } from '@weasel-js/core';
import { downloadBlob, reportFileWarnings } from '@weasel-js/editor';
import { exportPagePng, exportPagesPdf } from '@weasel-js/export';
import { DEFAULT_FILENAME } from './docPersistence';
import type { DrawScene } from './drawDocument';
import { reportExportFailure } from './fileNotices';
import type { SavedDoc } from './saveSvg';

/** Output pixels per world unit in an exported PNG: 192 to the inch. */
export const PNG_SCALE = 2;

const baseName = (doc: SavedDoc): string => (doc.filename.trim() || DEFAULT_FILENAME).replace(/\.svg$/i, '');

/** Download one page of the document as a PNG, named for the document and the page, on the document's background. */
export async function exportPagePngFile(scene: DrawScene, page: PlacedPage, doc: SavedDoc): Promise<void> {
  try {
    const blob = await exportPagePng(scene, page, { scale: PNG_SCALE, background: doc.backgroundColor });
    downloadBlob(blob, `${baseName(doc)} - ${pageName(page, page.index)}.png`);
  } catch (err) {
    reportExportFailure('PNG', err);
  }
}

/** Download every page of the document as one PDF, on the document's background, and toast what it could not carry. */
export async function exportPagesPdfFile(scene: DrawScene, pages: readonly PlacedPage[], doc: SavedDoc): Promise<void> {
  try {
    const { blob, skipped } = await exportPagesPdf(scene, pages, { background: doc.backgroundColor, title: baseName(doc) });
    downloadBlob(blob, `${baseName(doc)}.pdf`);
    reportFileWarnings('Exported', skipped.map((s) => s.detail), 'pdf-warnings');
  } catch (err) {
    reportExportFailure('PDF', err);
  }
}
