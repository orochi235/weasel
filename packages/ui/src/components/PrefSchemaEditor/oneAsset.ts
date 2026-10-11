import type { DocumentCodec } from './document';
import { schemaCodec } from './schemaCodec';
import type { SchemaRoot } from './schemaEdit';
import { mapSwaps } from './swaps';
import type { PrefTypes } from './types';
import type { Workspace } from './workspace';

/** The id of the one asset a lone schema is edited as. */
export const ONE = 'schema';

export function asWorkspace(schema: SchemaRoot): Workspace {
  return { assets: [{ id: ONE, kind: 'schema', label: schema.name, root: schema }] };
}

export function schemaOf<S extends SchemaRoot>(workspace: Workspace): S {
  return workspace.assets[0]!.root as S;
}

/** Whether two workspaces of one hold the same schema, which is all either holds. */
export const sameSchema = (a: Workspace, b: Workspace): boolean => schemaOf(a) === schemaOf(b);

/** {@link schemaCodec} for a workspace of one, which stores what that stores for the schema alone. */
export function oneAssetCodec<S extends SchemaRoot>(types: PrefTypes): DocumentCodec<Workspace> {
  const codec = schemaCodec<S>(types);
  const of = (workspace: Workspace) => schemaOf<S>(workspace);
  return {
    openDraft(key, base, storage) {
      const opened = codec.openDraft(key, of(base), storage);
      return opened && { ...opened, value: asWorkspace(opened.value), stacks: opened.stacks && mapSwaps(opened.stacks, asWorkspace) };
    },
    saveDraft: (key, value, base, stacks, savedAt, storage) => codec.saveDraft(key, of(value), of(base), mapSwaps(stacks, of), savedAt, storage),
    dropDraft: codec.dropDraft,
    packSent: (value, base) => codec.packSent(of(value), of(base)),
    afterTaken: (value, sent, base) => asWorkspace(codec.afterTaken(of(value), sent, of(base))),
    saveSent: codec.saveSent,
    openSent: codec.openSent,
    dropSent: codec.dropSent,
  };
}
