import type { DocumentCodec } from './document';
import { dropDraft, openDraft, saveDraft } from './draft';
import type { SchemaRoot } from './schemaEdit';
import { afterTaken, packSent } from './sent';
import type { PrefTypes } from './types';

/** A schema as a document keeps it: packed against its source, with code named by where the source holds it. */
export function schemaCodec<S extends SchemaRoot>(types: PrefTypes): DocumentCodec<S> {
  return {
    openDraft(key, base, storage) {
      const opened = openDraft(key, base, storage, types);
      return opened && { savedAt: opened.savedAt, value: opened.schema, stacks: opened.stacks, met: opened.met };
    },
    saveDraft: (key, value, base, stacks, savedAt, storage) => saveDraft(key, value, base, stacks, savedAt, storage, types),
    dropDraft,
    packSent: (value, base) => packSent(value, base, types),
    afterTaken: (value, sent, base) => afterTaken(value, sent, base, types),
  };
}
