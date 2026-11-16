import { createEmitter } from './emitter';

/** One registrant of a key: its value and, when the registrant named one, where it came from. */
export interface Registrant<V> {
  readonly value: V;
  readonly source: string | undefined;
  /** The tier `push` placed it in, when it was given one: see {@link PushOptions.rank}. */
  readonly rank?: number;
}

/** One key as a reflection reports it. */
export interface ReflectedEntry<V, K = string> extends Registrant<V> {
  readonly key: K;
  /** The registrant whose `value` and `source` this entry carries. The same
   *  object across snapshots, and the one `shadowed` lists once it is
   *  displaced, so it identifies the registrant to {@link Reflectable.release}. */
  readonly live: Registrant<V>;
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

/** Options for {@link Reflectable.push}. */
export interface PushOptions extends RegisterOptions {
  /** The tier the registrant joins. A key's registrants stack by rank, then by
   *  age: a newer registrant goes over every one of its rank or lower and under
   *  every one ranked higher, so an override tier can stay live over registrants
   *  that arrive after it. Default 0. */
  rank?: number;
}

/**
 * A keyed store that keeps its own {@link Reflection}. The registry owning it
 * writes through `push` / `set` / `delete` and hands out `reflection`.
 */
export interface Reflectable<V, K = string> extends Reflection<V, K> {
  /** Register `value` over whatever `key` holds and return its release.
   *  Registrants stack, newest live: releasing the live one uncovers the one
   *  it displaced, and releasing a displaced one removes only it. Double-release safe. */
  push(key: K, value: V, options?: PushOptions): () => void;
  /** Replace `key`'s live registrant in place, the way `Map.set` does — for
   *  registries where a second registration means "newer version", not
   *  "override". Records no conflict. Returns a release that removes this
   *  registrant if it is still there, and does nothing once a later `set`
   *  replaced it. */
  set(key: K, value: V, options?: RegisterOptions): () => void;
  /** Remove exactly `registrant` — one a reflection reported under `key`, live
   *  or shadowed, written by `push` or by `set`. Removing the live one uncovers
   *  the one beneath. Returns whether it was there; the release `push` returned
   *  for it does nothing afterward, and the reverse. */
  release(key: K, registrant: Registrant<V>): boolean;
  /** Drop every registrant of `key`. Returns whether there was one. */
  delete(key: K): boolean;
  clear(): void;
  /** Announce a change the store cannot see — a registered value mutated in place. */
  bump(): void;
  /** Run `fn`, announcing whatever it changed as one change when it returns:
   *  one version step and one notification, or none if it changed nothing.
   *  Nests; the outermost call announces. */
  batch<T>(fn: () => T): T;
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
  const listeners = createEmitter();
  let version = 0;
  /** Advances on every change, announced or still held by a `batch`, so `entries` inside one sees it. */
  let revision = 0;
  let snapshot: { revision: number; entries: readonly ReflectedEntry<V, K>[] } | null = null;
  let depth = 0;
  let pending = false;

  function changed(): void {
    revision++;
    if (depth > 0) {
      pending = true;
      return;
    }
    version++;
    listeners.emit();
  }

  const registrantOf = (value: V, options: PushOptions | undefined): Registrant<V> => Object.freeze(
    options?.rank === undefined ? { value, source: options?.source } : { value, source: options.source, rank: options.rank },
  );

  const reflection: Reflection<V, K> = {
    get: (key) => stacks.get(key)?.at(-1)?.value,
    has: (key) => stacks.has(key),
    entries() {
      if (snapshot?.revision === revision) return snapshot.entries;
      const entries: ReflectedEntry<V, K>[] = [];
      for (const [key, stack] of stacks) {
        const live = stack.at(-1)!;
        entries.push(Object.freeze({
          key, live, value: live.value, source: live.source, shadowed: Object.freeze(stack.slice(0, -1)),
        }));
      }
      snapshot = { revision, entries: Object.freeze(entries) };
      return snapshot.entries;
    },
    subscribe: listeners.subscribe,
    getVersion: () => version,
  };

  function release(key: K, registrant: Registrant<V>): boolean {
    const stack = stacks.get(key);
    const i = stack ? stack.lastIndexOf(registrant) : -1;
    if (i === -1) return false;
    stack!.splice(i, 1);
    if (stack!.length === 0) stacks.delete(key);
    changed();
    return true;
  }

  return {
    ...reflection,
    reflection,
    release,
    push(key, value, options) {
      const registrant = registrantOf(value, options);
      const rank = registrant.rank ?? 0;
      const stack = stacks.get(key);
      if (!stack) stacks.set(key, [registrant]);
      else {
        let at = stack.length;
        while (at > 0 && (stack[at - 1]!.rank ?? 0) > rank) at--;
        stack.splice(at, 0, registrant);
      }
      changed();
      return () => {
        release(key, registrant);
      };
    },
    set(key, value, options) {
      const registrant = registrantOf(value, { source: options?.source });
      const stack = stacks.get(key);
      if (stack) stack[stack.length - 1] = registrant;
      else stacks.set(key, [registrant]);
      changed();
      return () => {
        release(key, registrant);
      };
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
    batch(fn) {
      depth++;
      try {
        return fn();
      } finally {
        if (--depth === 0 && pending) {
          pending = false;
          version++;
          listeners.emit();
        }
      }
    },
  };
}

/** A reader of `reflection`'s live values in the order their keys were first registered: the same frozen
 *  array until the reflection's entries change. */
export function valuesOf<V, K>(reflection: Reflection<V, K>): () => readonly V[] {
  let held: { from: readonly ReflectedEntry<V, K>[]; values: readonly V[] } | null = null;
  return () => {
    const from = reflection.entries();
    if (held?.from !== from) held = { from, values: Object.freeze(from.map((e) => e.value)) };
    return held.values;
  };
}
