/** One registrant of a key: its value and, when the registrant named one, where it came from. */
export interface Registrant<V> {
  readonly value: V;
  readonly source: string | undefined;
}

/** One key as a reflection reports it. */
export interface ReflectedEntry<V, K = string> extends Registrant<V> {
  readonly key: K;
  /** The registrants this one displaced, oldest first. Non-empty means two
   *  registrants claimed one key — a conflict, resolved newest-wins. */
  readonly shadowed: readonly Registrant<V>[];
}

/**
 * The read-only face of a registry: what is registered, what displaced what,
 * and a way to hear about changes. Every kit registry that embeds a
 * {@link Reflectable} hands this out, so a debug overlay or a conflict check
 * can walk any of them the same way.
 *
 * `subscribe` and `getVersion` are shaped for `useSyncExternalStore`; so is
 * `entries`, which returns the same frozen array until the next change.
 */
export interface Reflection<V, K = string> {
  get(key: K): V | undefined;
  has(key: K): boolean;
  /** Every key's live registrant, in the order each key was first registered. */
  entries(): readonly ReflectedEntry<V, K>[];
  /** Called after every change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Advances on every change. */
  getVersion(): number;
}

/** Options for {@link Reflectable.push} and {@link Reflectable.set}. */
export interface RegisterOptions {
  /** Who registered this — `'kit'`, a package, a plugin id. Reported, never interpreted. */
  source?: string;
}

/**
 * A keyed store that keeps its own {@link Reflection}. The registry owning it
 * writes through `push` / `set` / `delete` and hands out `reflection`.
 */
export interface Reflectable<V, K = string> extends Reflection<V, K> {
  /** Register `value` over whatever `key` holds and return its release.
   *  Registrants stack, newest live: releasing the live one uncovers the one
   *  it displaced, and releasing a displaced one removes only it. Double-release safe. */
  push(key: K, value: V, options?: RegisterOptions): () => void;
  /** Replace `key`'s live registrant in place, the way `Map.set` does — for
   *  registries where a second registration means "newer version", not
   *  "override". Records no conflict. */
  set(key: K, value: V, options?: RegisterOptions): void;
  /** Drop every registrant of `key`. Returns whether there was one. */
  delete(key: K): boolean;
  clear(): void;
  /** Announce a change the store cannot see — a registered value mutated in place. */
  bump(): void;
  /** This store as a {@link Reflection}, with no write methods on it. */
  readonly reflection: Reflection<V, K>;
}

/**
 * Create a keyed store with a uniform reflection surface.
 *
 * Deliberately only the cross-cutting part of a registry: validation, lookup
 * fallbacks and lifecycle stay with the registry that embeds it.
 */
export function createReflectable<V, K = string>(): Reflectable<V, K> {
  const stacks = new Map<K, Registrant<V>[]>();
  const listeners = new Set<() => void>();
  let version = 0;
  let snapshot: { version: number; entries: readonly ReflectedEntry<V, K>[] } | null = null;

  function changed(): void {
    version++;
    for (const listener of listeners) {
      try {
        listener();
      } catch (err) {
        console.error('weasel registry: subscriber threw', err);
      }
    }
  }

  const reflection: Reflection<V, K> = {
    get: (key) => stacks.get(key)?.at(-1)?.value,
    has: (key) => stacks.has(key),
    entries() {
      if (snapshot?.version === version) return snapshot.entries;
      const entries: ReflectedEntry<V, K>[] = [];
      for (const [key, stack] of stacks) {
        const live = stack.at(-1)!;
        entries.push(Object.freeze({
          key, value: live.value, source: live.source, shadowed: Object.freeze(stack.slice(0, -1)),
        }));
      }
      snapshot = { version, entries: Object.freeze(entries) };
      return snapshot.entries;
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    getVersion: () => version,
  };

  return {
    ...reflection,
    reflection,
    push(key, value, options) {
      const registrant: Registrant<V> = Object.freeze({ value, source: options?.source });
      const stack = stacks.get(key);
      if (stack) stack.push(registrant);
      else stacks.set(key, [registrant]);
      changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const cur = stacks.get(key);
        const i = cur ? cur.lastIndexOf(registrant) : -1;
        if (i === -1) return;
        cur!.splice(i, 1);
        if (cur!.length === 0) stacks.delete(key);
        changed();
      };
    },
    set(key, value, options) {
      const registrant: Registrant<V> = Object.freeze({ value, source: options?.source });
      const stack = stacks.get(key);
      if (stack) stack[stack.length - 1] = registrant;
      else stacks.set(key, [registrant]);
      changed();
    },
    delete(key) {
      if (!stacks.delete(key)) return false;
      changed();
      return true;
    },
    clear() {
      if (stacks.size === 0) return;
      stacks.clear();
      changed();
    },
    bump: changed,
  };
}
