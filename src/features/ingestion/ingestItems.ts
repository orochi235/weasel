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
 * `INGEST_STRING_MIMES` order: text/plain, text/html, text/uri-list.
 */
import type { IngestItem } from '@weasel-js/gestures';

export type { IngestItem };

/** The string flavors the kit normalizes. Everything else (browser-internal
 *  custom flavors, etc.) is dropped at materialization. */
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
      if (INGEST_STRING_MIMES.has(mime)) {
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

/** Materialize a paste's `clipboardData`. Fully synchronous. */
export function itemsFromClipboardData(cd: DataTransfer): IngestItem[] {
  const out: IngestItem[] = [];
  for (const file of Array.from(cd.files ?? [])) {
    out.push({ kind: 'file', mime: normalizeMime(file.type), file });
  }
  for (const mime of INGEST_STRING_MIMES) {
    const text = cd.getData(mime);
    if (text) out.push({ kind: 'string', mime, text });
  }
  return out;
}
