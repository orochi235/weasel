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

export function loadDoc(): PersistedDoc {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedDoc>;
      return {
        filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
        backgroundColor: typeof parsed.backgroundColor === 'string' && parsed.backgroundColor ? parsed.backgroundColor : DEFAULT_BG_COLOR,
        paperSize: isPaperSize(parsed.paperSize) ? parsed.paperSize : DEFAULT_PAPER_SIZE,
      };
    }
  } catch { /* fall through */ }
  return { filename: DEFAULT_FILENAME, backgroundColor: DEFAULT_BG_COLOR, paperSize: DEFAULT_PAPER_SIZE };
}

/** Best-effort: a full or unavailable store leaves the last saved document. */
export function saveDoc(doc: PersistedDoc): void {
  try {
    localStorage.setItem(DOC_KEY, JSON.stringify(doc));
  } catch { /* best-effort */ }
}
