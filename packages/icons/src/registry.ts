import { createEmitter, createReflectable } from '@weasel-js/registry';
import type { IconRef } from './names';
import type { IconGlyph, IconTable, IconVariantLoader } from './table';
import { createVariants, type IconVariantState } from './variants';

export type { IconVariantState } from './variants';

/** One icon as the registry reports it. */
export interface IconEntry {
  readonly ref: IconRef;
  readonly glyph: IconGlyph;
  readonly owner: string;
  /** Registered with `override`, over a table's glyph. */
  readonly overridden: boolean;
}

/** Thrown when a table claims a namespace another owner holds. */
export class IconNamespaceClaimedError extends Error {
  constructor(readonly namespace: string, readonly owner: string, readonly claimant: string) {
    super(`icon namespace "${namespace}" belongs to ${owner}; ${claimant} cannot register under it`);
    this.name = 'IconNamespaceClaimedError';
  }
}

export interface IconRegistry {
  get(ref: string): IconGlyph | undefined;
  add(tables: IconTable | readonly IconTable[]): () => void;
  override(ref: IconRef, glyph: IconGlyph, source?: string): () => void;
  owner(namespace: string): string | undefined;
  /** The same array until the registry next changes, so it is safe to read through `useSyncExternalStore`. */
  entries(): readonly IconEntry[];
  provideVariants(loaders: Readonly<Record<string, IconVariantLoader>>): void;
  loadVariant(name: string): Promise<void>;
  variantState(name: string): IconVariantState;
  subscribe(listener: () => void): () => void;
  getVersion(): number;
}

const OVERRIDE = 'override';

export function createIconRegistry(initial?: IconTable | readonly IconTable[]): IconRegistry {
  const glyphs = createReflectable<IconGlyph>();
  // How many live tables hold each namespace, and whose it is while any do.
  const claims = new Map<string, { owner: string; count: number }>();
  const notify = createEmitter();
  let version = 0;
  let snapshot: { version: number; entries: readonly IconEntry[] } | null = null;
  const changed = () => {
    version++;
    notify.emit();
  };
  glyphs.subscribe(changed);

  const claim = (t: IconTable) => {
    const held = claims.get(t.namespace);
    if (held && held.owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, held.owner, t.owner);
    claims.set(t.namespace, { owner: t.owner, count: (held?.count ?? 0) + 1 });
  };
  const unclaim = (t: IconTable) => {
    const held = claims.get(t.namespace);
    if (!held) return;
    if (held.count <= 1) claims.delete(t.namespace);
    else claims.set(t.namespace, { ...held, count: held.count - 1 });
  };

  const addOne = (t: IconTable): (() => void) => {
    claim(t);
    const keys = Object.keys(t.icons).map((name) => `${t.namespace}:${name}`);
    // `set`, not `push`: a same-owner table re-registering a glyph is a newer copy, not a conflict.
    for (const key of keys) glyphs.set(key, t.icons[key.slice(t.namespace.length + 1)]!, { source: t.owner });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      unclaim(t);
      if (!claims.has(t.namespace)) for (const key of keys) glyphs.delete(key);
    };
  };

  const add = (tables: IconTable | readonly IconTable[]): (() => void) => {
    const list = Array.isArray(tables) ? tables : [tables as IconTable];
    // Check every claim before writing any, so a refused batch registers nothing.
    for (const t of list) {
      const held = claims.get(t.namespace);
      if (held && held.owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, held.owner, t.owner);
    }
    const releases = list.map(addOne);
    return () => releases.forEach((r) => r());
  };

  const variants = createVariants((tables) => void add(tables), changed);
  if (initial) add(initial);

  return {
    get: (ref) => glyphs.get(ref),
    add,
    override: (ref, glyph, source = OVERRIDE) => glyphs.push(ref, glyph, { source: `${OVERRIDE}:${source}` }),
    owner: (namespace) => claims.get(namespace)?.owner,
    entries() {
      if (snapshot?.version === version) return snapshot.entries;
      const entries = glyphs.entries().map((e) => ({
        ref: e.key as IconRef,
        glyph: e.value,
        owner: e.source?.startsWith(`${OVERRIDE}:`) ? e.source.slice(OVERRIDE.length + 1) : (e.source ?? ''),
        overridden: e.source?.startsWith(`${OVERRIDE}:`) ?? false,
      }));
      snapshot = { version, entries: Object.freeze(entries) };
      return snapshot.entries;
    },
    provideVariants: variants.provide,
    loadVariant: variants.load,
    variantState: variants.state,
    subscribe: notify.subscribe,
    getVersion: () => version,
  };
}
