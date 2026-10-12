import type { Scene } from '@weasel-js/core';
import { DEFAULT_FILENAME, PAPER_PRESETS } from './docPersistence';
import type { WeaselDrawData, WeaselDrawLayer, WeaselDrawPose } from './drawDocument';
import { reportSaveFailure, reportSvgWarnings } from './fileNotices';
import type { PaperSizeKey } from './paperSizes';
import { sceneToSvgString } from './svgExport';
import { downloadSvg } from './svgInterop';

/** The document state a saved file carries beside the scene. */
export interface SavedDoc {
  filename: string;
  paperSize: PaperSizeKey;
  backgroundColor: string;
}

/** Download the document as an SVG file, and toast what it left out or why it failed. */
export async function saveSvgFile(
  scene: Scene<WeaselDrawData, WeaselDrawLayer, WeaselDrawPose>,
  doc: SavedDoc,
): Promise<void> {
  const paper = PAPER_PRESETS[doc.paperSize];
  const name = doc.filename.trim() || DEFAULT_FILENAME;
  const warnings: string[] = [];
  try {
    const svg = await sceneToSvgString(scene, {
      ...doc,
      paperWidth: paper.width,
      paperHeight: paper.height,
      onWarn: (w) => warnings.push(w),
    });
    downloadSvg(svg, /\.svg$/i.test(name) ? name : `${name}.svg`);
  } catch (err) {
    reportSaveFailure(err);
    return;
  }
  reportSvgWarnings('Saved', warnings);
}
