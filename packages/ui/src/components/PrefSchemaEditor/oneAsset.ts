import type { PrefGroup } from '@weasel-js/prefs';
import type { DocumentCodec } from './document';
import { schemaCodec } from './schemaCodec';
import type { SchemaRoot } from './schemaEdit';
import { mapSwaps } from './swaps';
import type { PrefTypes } from './types';
import { catalogOf, type Workspace } from './workspace';
import { workspaceCodec } from './workspaceCodec';

/** The id of the one asset a lone schema is edited as. */
export const ONE = 'schema';
/** The id of the catalog a lone schema's Actions pane sorts the host's actions in. */
export const CATALOG = 'actions';

/** A workspace of `schema`, and of `catalog` where the editor keeps one. */
export function asWorkspace(schema: SchemaRoot, catalog?: PrefGroup): Workspace {
  return {
    assets: [
      { id: ONE, kind: 'schema', label: schema.name, root: schema },
      ...(catalog ? [{ id: CATALOG, kind: 'actions' as const, label: catalog.name, root: catalog }] : []),
    ],
  };
}

export function schemaOf<S extends SchemaRoot>(workspace: Workspace): S {
  return workspace.assets[0]!.root as S;
}

/** The catalog a workspace of one keeps beside its schema, where it keeps one. */
export const catalogIn = (workspace: Workspace): PrefGroup | undefined => catalogOf(workspace)?.root as PrefGroup | undefined;

/** Whether two workspaces of one hold the same schema and the same catalog, which is all either holds. */
export const sameSchema = (a: Workspace, b: Workspace): boolean => schemaOf(a) === schemaOf(b) && catalogIn(a) === catalogIn(b);

/**
 * How a document keeps a workspace of one. With no catalog it stores what {@link schemaCodec} stores for the schema
 * alone; with one, what {@link workspaceCodec} stores for both, and a draft saved before the catalog was kept still
 * opens, on the baseline's catalog.
 */
export function oneAssetCodec<S extends SchemaRoot>(types: PrefTypes): DocumentCodec<Workspace> {
  const lone = schemaCodec<S>(types);
  const both = workspaceCodec(types);
  const of = (workspace: Workspace) => schemaOf<S>(workspace);
  return {
    openDraft(key, base, storage) {
      const kept = catalogIn(base) && both.openDraft(key, base, storage);
      if (kept) return kept;
      const opened = lone.openDraft(key, of(base), storage);
      const around = (schema: S) => asWorkspace(schema, catalogIn(base));
      return opened && { ...opened, value: around(opened.value), stacks: opened.stacks && mapSwaps(opened.stacks, around) };
    },
    saveDraft(key, value, base, stacks, savedAt, storage) {
      if (catalogIn(base)) both.saveDraft(key, value, base, stacks, savedAt, storage);
      else lone.saveDraft(key, of(value), of(base), mapSwaps(stacks, of), savedAt, storage);
    },
    dropDraft: lone.dropDraft,
    packSent: (value, base) => (catalogIn(base) ? both.packSent(value, base) : lone.packSent(of(value), of(base))),
    afterTaken: (value, sent, base) => (catalogIn(base) ? both.afterTaken(value, sent, base) : asWorkspace(lone.afterTaken(of(value), sent, of(base)))),
    saveSent: lone.saveSent,
    openSent: lone.openSent,
    dropSent: lone.dropSent,
  };
}
