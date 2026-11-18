import { readLocal, sameStored, writeLocal } from '@weasel-js/storage';
import { carry } from './carry';
import { packDraft, unpackDraft, type DraftStorage } from './draft';
import type { SchemaRoot } from './schemaEdit';
import type { PrefTypes } from './types';
import { upgradeStored } from './upgrade';

const sentKey = (draftKey: string): string => `${draftKey}:sent`;
const json = (packed: unknown): unknown => JSON.parse(JSON.stringify(packed));

/** `schema`, just submitted, as storage can hold it. */
export function packSent(schema: SchemaRoot, source: SchemaRoot, types?: PrefTypes): unknown {
  return json(packDraft(schema, source, types));
}

/** Keep what was submitted beside the draft under `draftKey`, to tell it later from edits made since. */
export function saveSent(draftKey: string, sent: unknown, storage?: DraftStorage): void {
  // Without storage the editor that sent it still holds it, until a reload.
  writeLocal(sentKey(draftKey), sent, storage);
}

/** What was last submitted beside the draft under `draftKey`; `null` with none. */
export function openSent(draftKey: string, storage?: DraftStorage): unknown {
  return upgradeStored(readLocal(sentKey(draftKey), storage) ?? null);
}

export function dropSent(draftKey: string, storage?: DraftStorage): void {
  writeLocal(sentKey(draftKey), undefined, storage);
}

/**
 * `schema` once what was `sent` is in `source`: the submitted changes are the source's now and no longer the
 * reader's, and edits made since the submission stay. `source` itself when none were.
 */
export function afterTaken<R extends SchemaRoot>(schema: R, sent: unknown, source: R, types?: PrefTypes): R {
  const now = json(packDraft(source, source, types));
  const next = carry(json(packDraft(schema, source, types)), sent, now);
  return sameStored(next, now) ? source : unpackDraft(next, source, types);
}
