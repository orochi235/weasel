import type { PaperSizeKey } from './CommandBar';

/** Page dimensions in CSS px for each paper size. */
export const PAPER_PRESETS: Record<PaperSizeKey, { width: number; height: number }> = {
  letter: { width: 816, height: 1056 },
  a4:     { width: 794, height: 1123 },
  legal:  { width: 816, height: 1344 },
};

export const DOC_KEY = 'weaseldraw:doc-v1';
export const DEFAULT_FILENAME = 'untitled.svg';
export const DEFAULT_BG_COLOR = '#ffffff';
const DEFAULT_PAPER_SIZE: PaperSizeKey = 'letter';

/** Document-level state kept beside the scene, under its own key. */
export interface PersistedDoc {
  filename: string;
  backgroundColor: string;
  paperSize: PaperSizeKey;
}

const isPaperSize = (v: unknown): v is PaperSizeKey => typeof v === 'string' && Object.hasOwn(PAPER_PRESETS, v);

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
