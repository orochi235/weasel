import { readStored } from '@editor/index';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_PRESETS, type PaperSizeKey } from './paperSizes';

export { PAPER_PRESETS };

export const DOC_KEY = 'weaseldraw:doc-v1';
export const DEFAULT_FILENAME = 'untitled.svg';
export const DEFAULT_BG_COLOR = '#ffffff';

/** Document-level state kept beside the scene, under its own key. The pages are the scene's. */
export interface PersistedDoc {
  filename: string;
  backgroundColor: string;
}

/** A {@link PersistedDoc} as read back: `paperSize` is the page size a document saved before
 *  draw had pages kept here, and Letter for one that kept none. */
export interface LoadedDoc extends PersistedDoc {
  paperSize: PaperSizeKey;
}

const DEFAULT_DOC: LoadedDoc = { filename: DEFAULT_FILENAME, backgroundColor: DEFAULT_BG_COLOR, paperSize: DEFAULT_PAPER_SIZE };

export function loadDoc(): LoadedDoc {
  return readStored(DOC_KEY, parseDoc, () => DEFAULT_DOC);
}

function parseDoc(raw: string): LoadedDoc {
  const parsed = JSON.parse(raw) as Partial<LoadedDoc>;
  return {
    filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
    backgroundColor: typeof parsed.backgroundColor === 'string' && parsed.backgroundColor ? parsed.backgroundColor : DEFAULT_BG_COLOR,
    paperSize: isPaperSize(parsed.paperSize) ? parsed.paperSize : DEFAULT_PAPER_SIZE,
  };
}
