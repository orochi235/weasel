import { readStored } from '@weasel-js/editor';
import { DEFAULT_PAPER_SIZE, isPaperSize, PAPER_PRESETS, type PaperSizeKey } from './paperSizes';
import { sessionRecords } from './sessionRecords';

export { PAPER_PRESETS };

export const DOC_KEY = 'weaseldraw:doc-v1';
export const DEFAULT_FILENAME = 'untitled.svg';
export const DEFAULT_BG_COLOR = '#ffffff';

/** Document-level state kept beside the scene, under its own key, and out of its history. The pages
 *  and the background are the scene's. */
export interface PersistedDoc {
  filename: string;
}

/** A {@link PersistedDoc} as read back. `paperSize` is the page size a document saved before draw had
 *  pages kept here, and Letter for one that kept none; `backgroundColor` the background one saved
 *  before the background was the scene's kept here, and white for one that kept none. */
export interface LoadedDoc extends PersistedDoc {
  backgroundColor: string;
  paperSize: PaperSizeKey;
}

const DEFAULT_DOC: LoadedDoc = { filename: DEFAULT_FILENAME, backgroundColor: DEFAULT_BG_COLOR, paperSize: DEFAULT_PAPER_SIZE };

export function loadDoc(): LoadedDoc {
  return readStored(DOC_KEY, parseDoc, () => DEFAULT_DOC, sessionRecords());
}

function parseDoc(value: unknown): LoadedDoc {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new Error('Not a document entry');
  const parsed = value as Partial<LoadedDoc>;
  return {
    filename: typeof parsed.filename === 'string' && parsed.filename ? parsed.filename : DEFAULT_FILENAME,
    backgroundColor: typeof parsed.backgroundColor === 'string' && parsed.backgroundColor ? parsed.backgroundColor : DEFAULT_BG_COLOR,
    paperSize: isPaperSize(parsed.paperSize) ? parsed.paperSize : DEFAULT_PAPER_SIZE,
  };
}

/** The fields of a {@link LoadedDoc} only a drawing saved before its pages and background were the scene's keeps. */
const LEGACY_FIELDS = ['paperSize', 'backgroundColor'] as const;

type DocEntry = Record<string, unknown>;

/** The stored entry with `change` applied, `null` for none or one that cannot be read. */
function storedDocWith(change: (stored: DocEntry) => DocEntry): DocEntry | null {
  return readStored(DOC_KEY, (stored) => {
    if (stored === null || typeof stored !== 'object' || Array.isArray(stored)) throw new Error('Not a document entry');
    return change(stored as DocEntry);
  }, () => null, sessionRecords());
}

/** `doc` as its entry holds it, keeping the fields an older drawing kept beside it until the scene has taken them in
 *  ({@link retireLegacyDoc}): the scene's load reads them. */
export function docEntry(doc: PersistedDoc): DocEntry {
  const legacy = (stored: DocEntry) =>
    Object.fromEntries(LEGACY_FIELDS.flatMap((k) => (k in stored ? [[k, stored[k]]] : [])));
  return storedDocWith((stored) => ({ ...legacy(stored), ...doc })) ?? { ...doc };
}

/** Drop the fields an older drawing kept beside it, once a saved scene holds its pages and background. */
export function retireLegacyDoc(): void {
  const next = storedDocWith((stored) => {
    const out = { ...stored };
    for (const k of LEGACY_FIELDS) delete out[k];
    return out;
  });
  if (next === null) return;
  const records = sessionRecords();
  try {
    const text = JSON.stringify(next);
    if (records) {
      if (text !== JSON.stringify(records.get(DOC_KEY))) records.set(DOC_KEY, next);
    } else if (text !== localStorage.getItem(DOC_KEY)) localStorage.setItem(DOC_KEY, text);
  } catch { /* the next save tries again */ }
}
