import { carry } from './carry';
import { packDraft, unpackDraft } from './draft';
import type { SchemaRoot } from './schemaEdit';

const sentKey = (draftKey: string): string => `${draftKey}:sent`;
const json = (packed: unknown): unknown => JSON.parse(JSON.stringify(packed));

/** `schema`, just submitted, as storage can hold it. */
export function packSent(schema: SchemaRoot, source: SchemaRoot): unknown {
  return json(packDraft(schema, source));
}

/** Keep what was submitted beside the draft under `draftKey`, to tell it later from edits made since. */
export function saveSent(draftKey: string, sent: unknown): void {
  try {
    localStorage.setItem(sentKey(draftKey), JSON.stringify(sent));
  } catch {
    // Without storage the editor that sent it still holds it, until a reload.
  }
}

/** What was last submitted beside the draft under `draftKey`; `null` with none. */
export function openSent(draftKey: string): unknown {
  try {
    const raw = localStorage.getItem(sentKey(draftKey));
    return raw === null ? null : (JSON.parse(raw) as unknown);
  } catch {
    return null;
  }
}

export function dropSent(draftKey: string): void {
  try {
    localStorage.removeItem(sentKey(draftKey));
  } catch {
    // Storage that cannot be reached holds nothing to remove.
  }
}

/**
 * `schema` once what was `sent` is in `source`: the submitted changes are the source's now and no longer the
 * reader's, and edits made since the submission stay. `source` itself when none were.
 */
export function afterTaken<R extends SchemaRoot>(schema: R, sent: unknown, source: R): R {
  const now = json(packDraft(source, source));
  const next = carry(json(packDraft(schema, source)), sent, now);
  return JSON.stringify(next) === JSON.stringify(now) ? source : unpackDraft(next, source);
}
