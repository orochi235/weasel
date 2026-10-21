import { readStored } from '@editor/index';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_PRESETS, type PaperSizeKey } from './paperSizes';

export { PAPER_PRESETS };

export const DOC_KEY = 'weaseldraw:doc-v1';
export const DEFAULT_FILENAME = 'untitled.svg';
export const DEFAULT_BG_COLOR = '#ffffff';

/** Document-level state kept beside the scene, under its own key. */
export interface PersistedDoc {
  filename: string;
  backgroundColor: string;
  paperSize: PaperSizeKey;
}

const DEFAULT_DOC: PersistedDoc = { filename: DEFAULT_FILENAME, backgroundColor: DEFAULT_BG_COLOR, paperSize: DEFAULT_PAPER_SIZE };

export function loadDoc(): PersistedDoc {
  return readStored(DOC_KEY, parseDoc, () => DEFAULT_DOC);
}

function parseDoc(raw: string): PersistedDoc {
  const parsed = JSON.parse(raw) as Partial<PersistedDoc>;
  return {
    filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
    backgroundColor: typeof parsed.backgroundColor === 'string' && parsed.backgroundColor ? parsed.backgroundColor : DEFAULT_BG_COLOR,
    paperSize: isPaperSize(parsed.paperSize) ? parsed.paperSize : DEFAULT_PAPER_SIZE,
  };
}
