import type { DocumentCodec } from './document';
import { schemaCodec } from './schemaCodec';
import type { SchemaRoot } from './schemaEdit';
import { mapSwaps } from './swaps';
import type { PrefTypes } from './types';
import type { Workspace } from './workspace';

/** The id of the one asset a lone schema is edited as. */
export const ONE = 'schema';

// A document tells its own value from a host's by identity, so a schema has to meet the same workspace every render.
const held = new WeakMap<SchemaRoot, Workspace>();

const rootOf = <S extends SchemaRoot>(workspace: Workspace): S => workspace.assets[0]!.root as S;

/** `schema` as a workspace of one: the same workspace each time it is asked for. */
export function asWorkspace(schema: SchemaRoot): Workspace {
  let workspace = held.get(schema);
  if (!workspace) {
    workspace = { assets: [{ id: ONE, kind: 'schema', label: schema.name, root: schema }] };
    held.set(schema, workspace);
  }
  return workspace;
}

/** The schema a workspace of one holds. Handed on to a host, it comes back through {@link asWorkspace} as `workspace`. */
export function schemaOf<S extends SchemaRoot>(workspace: Workspace): S {
  const schema = rootOf<S>(workspace);
  held.set(schema, workspace);
  return schema;
}

/** {@link schemaCodec} for a workspace of one, which stores what that stores for the schema alone. */
export function oneAssetCodec<S extends SchemaRoot>(types: PrefTypes): DocumentCodec<Workspace> {
  const codec = schemaCodec<S>(types);
  // The baseline's schema is the baseline, whatever workspace it was last handed on in.
  const over = (base: Workspace) => (schema: SchemaRoot): Workspace => (schema === rootOf(base) ? base : asWorkspace(schema));
  return {
    openDraft(key, base, storage) {
      const opened = codec.openDraft(key, rootOf<S>(base), storage);
      return opened && { ...opened, value: over(base)(opened.value), stacks: opened.stacks && mapSwaps(opened.stacks, over(base)) };
    },
    saveDraft: (key, value, base, stacks, savedAt, storage) =>
      codec.saveDraft(key, rootOf<S>(value), rootOf<S>(base), mapSwaps(stacks, (w: Workspace) => rootOf<S>(w)), savedAt, storage),
    dropDraft: codec.dropDraft,
    packSent: (value, base) => codec.packSent(rootOf<S>(value), rootOf<S>(base)),
    afterTaken: (value, sent, base) => over(base)(codec.afterTaken(rootOf<S>(value), sent, rootOf<S>(base))),
    saveSent: codec.saveSent,
    openSent: codec.openSent,
    dropSent: codec.dropSent,
  };
}
