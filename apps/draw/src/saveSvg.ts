import { pageName, placedPagesOf, type PlacedPage } from '@weasel-js/core';
import { DEFAULT_FILENAME } from './docPersistence';
import type { DrawScene } from './drawDocument';
import { reportSaveFailure, reportSvgWarnings } from './fileNotices';
import { pageToSvgString, sceneToSvgString } from './svgExport';
import { downloadSvg } from './svgInterop';

/** The document state a saved file carries beside the scene. */
export interface SavedDoc {
  filename: string;
  backgroundColor: string;
}

/** Write `svg`, downloaded as `name`, and toast what it left out or why it failed. */
async function writeSvg(name: string, svg: (onWarn: (w: string) => void) => Promise<string>): Promise<void> {
  const warnings: string[] = [];
  try {
    downloadSvg(await svg((w) => warnings.push(w)), name);
  } catch (err) {
    reportSaveFailure(err);
    return;
  }
  reportSvgWarnings('Saved', warnings);
}

const baseName = (doc: SavedDoc): string => (doc.filename.trim() || DEFAULT_FILENAME).replace(/\.svg$/i, '');

/** Download the document, every page, as an SVG file. */
export function saveSvgFile(scene: DrawScene, doc: SavedDoc): Promise<void> {
  return writeSvg(`${baseName(doc)}.svg`, (onWarn) => sceneToSvgString(scene, {
    filename: doc.filename.trim() || DEFAULT_FILENAME,
    pages: placedPagesOf(scene),
    backgroundColor: doc.backgroundColor,
    onWarn,
  }));
}

/** Download one page of the document as an SVG file, named for the document and the page. */
export function exportPageSvgFile(scene: DrawScene, page: PlacedPage, doc: SavedDoc): Promise<void> {
  const name = `${baseName(doc)} - ${pageName(page, page.index)}`;
  return writeSvg(`${name}.svg`, (onWarn) => pageToSvgString(scene, page, {
    title: name,
    backgroundColor: doc.backgroundColor,
    onWarn,
  }));
}
