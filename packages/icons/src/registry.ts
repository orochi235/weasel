import { createReflectable, type ReflectedEntry, type Reflection } from '@weasel-js/registry';
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

/** Resolves icon refs to glyphs across registered tables and overrides, and reports who owns each namespace. */
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
  /** Every ref and the registrations behind its glyph: each source is the table's owner or the override's
   *  source, and an override sits over the tables at rank 1. */
  readonly reflection: Reflection<IconGlyph>;
}

const OVERRIDE = 'override';
/** Overrides stack over every table's glyph, whenever the table arrives. */
const OVERRIDE_RANK = 1;

/** A registry, optionally seeded with tables; each `add` and `override` returns its own release function. */
export function createIconRegistry(initial?: IconTable | readonly IconTable[]): IconRegistry {
  const glyphs = createReflectable<IconGlyph>({ name: 'icons' });
  // How many live tables hold each namespace, and whose it is while any do.
  const claims = new Map<string, { owner: string; count: number }>();
  let snapshot: { from: readonly ReflectedEntry<IconGlyph>[]; entries: readonly IconEntry[] } | null = null;

  const unclaim = (namespace: string) => {
    const held = claims.get(namespace);
    if (!held) return;
    if (held.count <= 1) claims.delete(namespace);
    else claims.set(namespace, { ...held, count: held.count - 1 });
  };

  const add = (tables: IconTable | readonly IconTable[]): (() => void) => {
    const list = Array.isArray(tables) ? tables : [tables as IconTable];
    if (list.length === 0) return () => {};
    for (const t of list) {
      const icons: unknown = t?.icons;
      if (typeof t?.namespace !== 'string' || typeof t.owner !== 'string' || icons === null || typeof icons !== 'object' || Array.isArray(icons)) {
        throw new TypeError(`an icon table needs a string namespace and owner and an object of icons, got ${String(t?.namespace)}`);
      }
    }
    // Check every claim, those within the batch included, before writing any: a refused batch registers nothing.
    const pending = new Map<string, string>();
    for (const t of list) {
      const owner = claims.get(t.namespace)?.owner ?? pending.get(t.namespace);
      if (owner !== undefined && owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, owner, t.owner);
      pending.set(t.namespace, t.owner);
    }
    // A claim changes `owner` though no glyph may move, so each add and its release is announced as one change.
    const releases = glyphs.batch(() => {
      glyphs.bump();
      return list.flatMap((t) => {
        const held = claims.get(t.namespace);
        claims.set(t.namespace, { owner: t.owner, count: (held?.count ?? 0) + 1 });
        const offs = Object.keys(t.icons).map((name) => glyphs.push(`${t.namespace}:${name}`, t.icons[name]!, { source: t.owner, fallback: true }));
        return [() => unclaim(t.namespace), ...offs];
      });
    });
    let released = false;
    return () => {
      if (released) return;
      released = true;
      glyphs.batch(() => {
        glyphs.bump();
        releases.forEach((r) => r());
      });
    };
  };

  const variants = createVariants((tables) => void add(tables), glyphs.bump);
  if (initial) add(initial);

  return {
    get: glyphs.get,
    add,
    override: (ref, glyph, source = OVERRIDE) => glyphs.push(ref, glyph, { source, rank: OVERRIDE_RANK }),
    owner: (namespace) => claims.get(namespace)?.owner,
    entries() {
      const from = glyphs.entries();
      if (snapshot?.from === from) return snapshot.entries;
      const entries = from.map((e): IconEntry => ({
        ref: e.key as IconRef,
        glyph: e.value,
        owner: e.source!,
        overridden: e.live.rank === OVERRIDE_RANK || e.shadowed.some((r) => r.rank === OVERRIDE_RANK),
      }));
      snapshot = { from, entries: Object.freeze(entries) };
      return snapshot.entries;
    },
    provideVariants: variants.provide,
    loadVariant: variants.load,
    variantState: variants.state,
    subscribe: glyphs.subscribe,
    getVersion: glyphs.getVersion,
    reflection: glyphs.reflection,
  };
}
