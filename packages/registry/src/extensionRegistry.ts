import { createReflectable, type ReflectedEntry, type Reflection } from './reflectable';

/** Options for {@link ExtensionRegistry.register}. */
export interface ExtensionRegisterOptions {
  /** Put `value` in place of a different one the id resolves to, here or in a parent, instead of
   *  throwing. Registrations of the value it displaces stop holding the id. */
  replace?: boolean;
  /** Who registered this — `'kit'`, a package, a plugin id. Reported, never interpreted. */
  source?: string;
}

/**
 * A host's table of extensions by id: op factories, shader sources. Every one follows the same
 * rules, so a host can reason about any of them the same way:
 *
 * - **Idempotent.** Registering the value an id already resolves to is no change; each such call
 *   returns its own release, and the id stays until every one of them has run.
 * - **Explicit replacement.** Registering a different value under a taken id throws
 *   {@link ExtensionConflictError}, in development and production alike, unless the call passes
 *   `replace: true`.
 * - **Disposal.** `register` returns the release. A release after a replacement, or a second call
 *   of one, does nothing.
 * - **Scoped.** A registry made with a `parent` resolves its own ids first and then the parent's.
 *   Hosts that should not see each other's extensions each make their own; hosts that should share
 *   them hold one registry, or children of one.
 *
 * The registry is itself a {@link Reflection} over every id it resolves, its parent's included.
 */
export interface ExtensionRegistry<V> extends Reflection<V> {
  /** Register `value` under `id` and return its release. */
  register(id: string, value: V, options?: ExtensionRegisterOptions): () => void;
  /** The registry this one falls back to, or null. */
  readonly parent: ExtensionRegistry<V> | null;
  /** This registry's own ids, without its parent's. */
  readonly own: Reflection<V>;
  /** Drop every registration this registry holds itself; outstanding releases do nothing after. */
  clear(): void;
}

/** Options for {@link createExtensionRegistry}. */
export interface ExtensionRegistryOptions<V> {
  /** What the registry holds, for error messages: `'op factory'`, `'shader program'`. */
  kind: string;
  /** Resolved second, for every id this registry does not hold itself. */
  parent?: ExtensionRegistry<V> | null;
  /** Whether two values are the same registration. Defaults to `Object.is`. */
  same?: (a: V, b: V) => boolean;
}

/** A registration that would have put a different value under a taken id without `replace`. */
export class ExtensionConflictError extends Error {
  constructor(readonly kind: string, readonly id: string) {
    super(`${kind} "${id}" is already registered with a different value; pass \`replace: true\` to replace it`);
    this.name = 'ExtensionConflictError';
  }
}

interface Holding {
  /** Identifies the registration a release belongs to; a replacement makes a new one. */
  token: object;
  count: number;
}

export function createExtensionRegistry<V>(options: ExtensionRegistryOptions<V>): ExtensionRegistry<V> {
  const { kind } = options;
  const parent = options.parent ?? null;
  const same = options.same ?? Object.is;
  const store = createReflectable<V>();
  const held = new Map<string, Holding>();
  let cached: { version: number; entries: readonly ReflectedEntry<V>[] } | null = null;

  const get = (id: string): V | undefined => (store.has(id) ? store.get(id) : parent?.get(id));
  const getVersion = (): number => store.getVersion() + (parent?.getVersion() ?? 0);

  function releaseOf(id: string, holding: Holding): () => void {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      if (held.get(id)?.token !== holding.token) return;
      if (--holding.count > 0) return;
      held.delete(id);
      store.delete(id);
    };
  }

  return {
    parent,
    own: store.reflection,
    get,
    has: (id) => store.has(id) || (parent?.has(id) ?? false),
    entries() {
      const version = getVersion();
      if (cached?.version === version) return cached.entries;
      const mine = store.entries();
      const inherited = (parent?.entries() ?? []).filter((e) => !store.has(e.key));
      cached = { version, entries: Object.freeze([...inherited, ...mine]) };
      return cached.entries;
    },
    subscribe(listener) {
      const off = store.subscribe(listener);
      const offParent = parent?.subscribe(listener);
      return () => { off(); offParent?.(); };
    },
    getVersion,
    register(id, value, opts = {}) {
      const have = get(id);
      const holding = held.get(id);
      if (have !== undefined && same(have, value) && holding) {
        holding.count++;
        return releaseOf(id, holding);
      }
      if (have !== undefined && !same(have, value) && !opts.replace) throw new ExtensionConflictError(kind, id);
      const next: Holding = { token: {}, count: 1 };
      held.set(id, next);
      store.set(id, value, opts.source !== undefined ? { source: opts.source } : undefined);
      return releaseOf(id, next);
    },
    clear() {
      held.clear();
      store.clear();
    },
  };
}
