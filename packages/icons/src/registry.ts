import { createEmitter } from '@weasel-js/registry';
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

interface Layer {
  readonly glyph: IconGlyph;
  readonly owner: string;
}

interface Slot {
  /** One layer per live table, oldest first; the newest is what the table side shows. */
  readonly tables: Map<object, Layer>;
  /** Explicit overrides, oldest first; the newest covers every table layer. */
  readonly overrides: Layer[];
}

const lastOf = <T>(it: Iterable<T>): T | undefined => {
  let last: T | undefined;
  for (const v of it) last = v;
  return last;
};

export function createIconRegistry(initial?: IconTable | readonly IconTable[]): IconRegistry {
  const slots = new Map<string, Slot>();
  // How many live tables hold each namespace, and whose it is while any do.
  const claims = new Map<string, { owner: string; count: number }>();
  const notify = createEmitter();
  let version = 0;
  let snapshot: { version: number; entries: readonly IconEntry[] } | null = null;
  const changed = () => {
    version++;
    notify.emit();
  };

  const slotFor = (key: string): Slot => {
    let slot = slots.get(key);
    if (!slot) slots.set(key, (slot = { tables: new Map(), overrides: [] }));
    return slot;
  };
  const prune = (key: string) => {
    const slot = slots.get(key);
    if (slot && slot.tables.size === 0 && slot.overrides.length === 0) slots.delete(key);
  };
  const live = (slot: Slot | undefined): Layer | undefined =>
    slot && (slot.overrides.at(-1) ?? lastOf(slot.tables.values()));

  const unclaim = (namespace: string) => {
    const held = claims.get(namespace);
    if (!held) return;
    if (held.count <= 1) claims.delete(namespace);
    else claims.set(namespace, { ...held, count: held.count - 1 });
  };

  const add = (tables: IconTable | readonly IconTable[]): (() => void) => {
    const list = Array.isArray(tables) ? tables : [tables as IconTable];
    // Check every claim, those within the batch included, before writing any: a refused batch registers nothing.
    const pending = new Map<string, string>();
    for (const t of list) {
      const owner = claims.get(t.namespace)?.owner ?? pending.get(t.namespace);
      if (owner !== undefined && owner !== t.owner) throw new IconNamespaceClaimedError(t.namespace, owner, t.owner);
      pending.set(t.namespace, t.owner);
    }
    const releases = list.map((t) => {
      const held = claims.get(t.namespace);
      claims.set(t.namespace, { owner: t.owner, count: (held?.count ?? 0) + 1 });
      const token = {};
      const keys = Object.keys(t.icons).map((name) => `${t.namespace}:${name}`);
      for (const key of keys) {
        slotFor(key).tables.set(token, { glyph: t.icons[key.slice(t.namespace.length + 1)]!, owner: t.owner });
      }
      let released = false;
      return () => {
        if (released) return;
        released = true;
        unclaim(t.namespace);
        for (const key of keys) {
          slots.get(key)?.tables.delete(token);
          prune(key);
        }
      };
    });
    changed();
    return () => {
      releases.forEach((r) => r());
      changed();
    };
  };

  const variants = createVariants((tables) => void add(tables), changed);
  if (initial) add(initial);

  return {
    get: (ref) => live(slots.get(ref))?.glyph,
    add,
    override(ref, glyph, source = OVERRIDE) {
      const layer: Layer = { glyph, owner: source };
      slotFor(ref).overrides.push(layer);
      changed();
      return () => {
        const slot = slots.get(ref);
        const i = slot ? slot.overrides.indexOf(layer) : -1;
        if (i === -1) return;
        slot!.overrides.splice(i, 1);
        prune(ref);
        changed();
      };
    },
    owner: (namespace) => claims.get(namespace)?.owner,
    entries() {
      if (snapshot?.version === version) return snapshot.entries;
      const entries: IconEntry[] = [];
      for (const [key, slot] of slots) {
        const top = live(slot)!;
        entries.push({ ref: key as IconRef, glyph: top.glyph, owner: top.owner, overridden: slot.overrides.length > 0 });
      }
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
