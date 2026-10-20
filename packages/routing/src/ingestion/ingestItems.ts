/**
 * IngestItem materialization — turns a live `DataTransfer` (drop) or
 * clipboard `DataTransfer` (paste) into fully-owned `IngestItem[]`.
 *
 * `DataTransfer` items are only readable while the originating DOM event is
 * on the stack, so BOTH functions must be called synchronously from the event
 * handler. `itemsFromDataTransfer` kicks off every `getAsString` read
 * immediately and resolves once all strings are collected;
 * `itemsFromClipboardData` is fully synchronous (`getData` + `files`).
 *
 * MIME strings are normalized to bare lowercase `type/subtype` (parameters
 * like `;charset=utf-8` stripped) — downstream exact matching (binding
 * `types`, content-handler `match`) assumes the bare form.
 *
 * Output shape: **files first (source order), then strings (item order)**.
 * For paste (`itemsFromClipboardData`) string flavors are emitted in
 * `INGEST_STRING_MIMES` order: text/plain, text/html, text/uri-list, then
 * the admitted ones in the order they were first admitted.
 */
import { UNKNOWN_MIME, type IngestItem } from '@weasel-js/gestures';

export type { IngestItem };

/** The string flavors the kit always keeps. Any other is dropped at
 *  materialization unless {@link admitIngestMime} has admitted it. */
export const INGEST_STRING_MIMES: ReadonlySet<string> = new Set([
  'text/plain',
  'text/html',
  'text/uri-list',
]);

const FALLBACK_MIME = 'application/octet-stream';

/** Normalize a raw MIME to bare lowercase `type/subtype`. */
function normalizeMime(raw: string): string {
  const bare = raw.split(';')[0].trim().toLowerCase();
  return bare || FALLBACK_MIME;
}

const admitted = new Map<string, number>();

/**
 * Keep string flavors of `mime` on drops, drags and pastes as well as the
 * {@link INGEST_STRING_MIMES}, so content from the app's own UI can travel
 * under a type of its own. Returns a release; the flavor is kept while any
 * admission of it is unreleased. Core admits each exact MIME a registered
 * content handler names.
 */
export function admitIngestMime(mime: string): () => void {
  const key = normalizeMime(mime);
  admitted.set(key, (admitted.get(key) ?? 0) + 1);
  let released = false;
  return () => {
    if (released) return;
    released = true;
    const n = (admitted.get(key) ?? 1) - 1;
    if (n > 0) admitted.set(key, n);
    else admitted.delete(key);
  };
}

const keepsString = (mime: string): boolean => INGEST_STRING_MIMES.has(mime) || admitted.has(mime);

/** Wrap raw `File`s (file picker, `CanvasExtensionApi.ingest`) as
 *  `IngestItem`s, normalizing each MIME the same way the drop/paste paths
 *  do. Synchronous — `File` objects are already fully owned. */
export function itemsFromFiles(files: File[]): IngestItem[] {
  return files.map((file) => ({ kind: 'file', mime: normalizeMime(file.type), file }));
}

/** Materialize a drop's `DataTransfer`. MUST be called during the `drop`
 *  event dispatch (see module doc). */
export function itemsFromDataTransfer(dt: DataTransfer): Promise<IngestItem[]> {
  const files: IngestItem[] = [];
  const strings: IngestItem[] = [];
  const reads: Promise<void>[] = [];

  for (const item of Array.from(dt.items ?? [])) {
    if (item.kind === 'file') {
      const file = item.getAsFile();
      if (file) files.push({ kind: 'file', mime: normalizeMime(file.type), file });
    } else if (item.kind === 'string') {
      const mime = normalizeMime(item.type);
      if (keepsString(mime)) {
        const slot = strings.length;
        strings.push(null as never);
        reads.push(
          new Promise((resolve) => {
            item.getAsString((text) => {
              strings[slot] = { kind: 'string', mime, text };
              resolve();
            });
          }),
        );
      }
    }
  }

  // Some sources populate `files` without `items` (older engines, jsdom).
  if (files.length === 0 && reads.length === 0) {
    for (const file of Array.from(dt.files ?? [])) {
      files.push({ kind: 'file', mime: normalizeMime(file.type), file });
    }
  }

  return Promise.all(reads).then(() => [...files, ...strings]);
}

/**
 * What a drag still in flight says it carries: one item per flavor, MIME
 * only. A browser withholds contents until the drop, so nothing may read
 * `file` or `text` off these; they exist to ask which bindings would match.
 * A file the browser does not name yet (Firefox reports
 * `application/x-moz-file`, others only a `Files` type) is `UNKNOWN_MIME`.
 */
export function itemTypesFromDataTransfer(dt: DataTransfer): readonly IngestItem[] {
  const mimes: string[] = [];
  for (const item of Array.from(dt.items ?? [])) {
    const mime = item.type ? normalizeMime(item.type) : '';
    if (item.kind === 'file') mimes.push(mime && mime !== 'application/x-moz-file' ? mime : UNKNOWN_MIME);
    else if (keepsString(mime)) mimes.push(mime);
  }
  if (mimes.length === 0 && Array.from(dt.types ?? []).includes('Files')) mimes.push(UNKNOWN_MIME);
  return mimes.map((mime) => ({ mime })) as unknown as IngestItem[];
}

/** Materialize a paste's `clipboardData`. Fully synchronous. */
export function itemsFromClipboardData(cd: DataTransfer): IngestItem[] {
  const out: IngestItem[] = [];
  for (const file of Array.from(cd.files ?? [])) {
    out.push({ kind: 'file', mime: normalizeMime(file.type), file });
  }
  for (const mime of new Set([...INGEST_STRING_MIMES, ...admitted.keys()])) {
    const text = cd.getData(mime);
    if (text) out.push({ kind: 'string', mime, text });
  }
  return out;
}
