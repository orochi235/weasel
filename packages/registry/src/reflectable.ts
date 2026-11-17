import { createEmitter } from './emitter';
import { isDev } from './isDev';

/** One registrant of a key: its value and, when the registrant named one, where it came from. */
export interface Registrant<V> {
  readonly value: V;
  readonly source: string | undefined;
  /** The tier `push` placed it in, when it was given one: see {@link PushOptions.rank}. */
  readonly rank?: number;
  /** Set when `push` registered it as an engine default: see {@link PushOptions.fallback}. */
  readonly fallback?: true;
}

/** One key as a reflection reports it. */
export interface ReflectedEntry<V, K = string> extends Registrant<V> {
  readonly key: K;
  /** The registrant whose `value`, `source`, `rank` and `fallback` this entry carries. The same
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
  /** What the registry holds, in a few plain words (`'paint kinds'`), when it was given one. */
  readonly name?: string;
  get(key: K): V | undefined;
  has(key: K): boolean;
  /** Every key's live registrant, in the order each key was first registered. */
  entries(): readonly ReflectedEntry<V, K>[];
  /** Called after every change. Returns the unsubscribe. */
  subscribe(listener: () => void): () => void;
  /** Advances on every change. */
  getVersion(): number;
}

/** Options for {@link createReflectable}. */
export interface ReflectableOptions {
  /** What the registry holds, in a few plain words: `'paint kinds'`, `'cameras'`. Its reflection reports it,
   *  and its development warnings lead with it. */
  name?: string;
  /** Registrants of one key are layers by design, each free to override or compose over the ones beneath it:
   *  a push over a live registrant is never a clash, and draws no development warning. */
  layered?: boolean;
  /** A key whose last registrant is released keeps its place in registration order until the current
   *  microtasks have run, so releasing one and pushing its replacement in the same tick, as a React effect
   *  re-running does, leaves the key where it was. Until then the key reads as absent. */
  holdPlace?: boolean;
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
  /** An engine default, meant to be replaced. Pushing over a registrant of the
   *  same rank that is not a fallback, holding a different value, is a clash, warned of once in development;
   *  over a fallback, or at a higher rank, it is a deliberate override. */
  fallback?: boolean;
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
  /** Every registrant of `key`, the live one last, as `entries()` would order its `shadowed` then `live`:
   *  empty when the key holds none. A frozen array, the same one until `key` changes, read without
   *  building the store's entries. */
  stack(key: K): readonly Registrant<V>[];
  /** This store as a {@link Reflection}, with no write methods on it. */
  readonly reflection: Reflection<V, K>;
}

const NONE: readonly never[] = Object.freeze([]);

function registrantOf<V>(value: V, options: PushOptions | undefined): Registrant<V> {
  const registrant: { value: V; source: string | undefined; rank?: number; fallback?: true } = { value, source: options?.source };
  if (options?.rank !== undefined) registrant.rank = options.rank;
  if (options?.fallback) registrant.fallback = true;
  return Object.freeze(registrant);
}

/** The development warning for a push over a same-rank registrant that is not a fallback: once per key and
 *  pair of sources while the key stays held. */
function createClashWarnings<K, V>(name: string | undefined) {
  const prefix = name === undefined ? 'weasel' : `weasel ${name}`;
  const warned = new Map<K, Set<string>>();
  const named = (r: Registrant<V>) => (r.source === undefined ? 'an unnamed registrant' : `"${r.source}"`);
  return {
    warn(key: K, under: Registrant<V>, over: Registrant<V>): void {
      const pair = `${under.source ?? ''}\u0000${over.source ?? ''}`;
      const seen = warned.get(key) ?? new Set<string>();
      if (seen.has(pair)) return;
      warned.set(key, seen.add(pair));
      console.warn(
        `${prefix}: ${named(over)} registered "${String(key)}" over ${named(under)}, which is not an engine default. ` +
        'The newer one is live; release one, or push the override at a higher rank.',
      );
    },
    forget: (key: K) => { warned.delete(key); },
    clear: () => { warned.clear(); },
  };
}

/** Every key's live registrant and what it shadows, skipping keys only holding their place. */
function entriesOf<V, K>(stacks: ReadonlyMap<K, readonly Registrant<V>[]>): readonly ReflectedEntry<V, K>[] {
  const entries: ReflectedEntry<V, K>[] = [];
  for (const [key, stack] of stacks) {
    const live = stack.at(-1);
    if (!live) continue;
    entries.push(Object.freeze({
      key, live, value: live.value, source: live.source, shadowed: Object.freeze(stack.slice(0, -1)),
      ...(live.rank === undefined ? {} : { rank: live.rank }),
      ...(live.fallback ? { fallback: true as const } : {}),
    }));
  }
  return Object.freeze(entries);
}

/**
 * Create a keyed store with a uniform reflection surface.
 *
 * Deliberately only the cross-cutting part of a registry: validation, lookup
 * fallbacks and lifecycle stay with the registry that embeds it.
 */
export function createReflectable<V, K = string>(options?: ReflectableOptions): Reflectable<V, K> {
  const name = options?.name;
  const layered = options?.layered ?? false;
  const holdPlace = options?.holdPlace ?? false;
  /** Each key's registrants, live last, replaced whole on every write so `stack` can hand one out. An empty
   *  array is a key holding its place under `holdPlace`. */
  const stacks = new Map<K, readonly Registrant<V>[]>();
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

  const clashes = createClashWarnings<K, V>(name);

  const reflection: Reflection<V, K> = {
    ...(name === undefined ? {} : { name }),
    get: (key) => stacks.get(key)?.at(-1)?.value,
    has: (key) => (stacks.get(key)?.length ?? 0) > 0,
    entries() {
      if (snapshot?.revision !== revision) snapshot = { revision, entries: entriesOf(stacks) };
      return snapshot.entries;
    },
    subscribe: listeners.subscribe,
    getVersion: () => version,
  };

  function release(key: K, registrant: Registrant<V>): boolean {
    const stack = stacks.get(key);
    const i = stack ? stack.lastIndexOf(registrant) : -1;
    if (i === -1) return false;
    if (stack!.length > 1) stacks.set(key, Object.freeze([...stack!.slice(0, i), ...stack!.slice(i + 1)]));
    else {
      clashes.forget(key);
      if (holdPlace) {
        const held: readonly Registrant<V>[] = Object.freeze([]);
        stacks.set(key, held);
        queueMicrotask(() => {
          if (stacks.get(key) === held) stacks.delete(key);
        });
      } else stacks.delete(key);
    }
    changed();
    return true;
  }

  return {
    ...reflection,
    reflection,
    release,
    stack: (key) => stacks.get(key) ?? NONE,
    push(key, value, options) {
      const registrant = registrantOf(value, options);
      const rank = registrant.rank ?? 0;
      const stack = stacks.get(key) ?? NONE;
      let at = stack.length;
      while (at > 0 && (stack[at - 1]!.rank ?? 0) > rank) at--;
      const under = stack[at - 1];
      if (under && !layered && !under.fallback && under.value !== value && (under.rank ?? 0) === rank && isDev()) clashes.warn(key, under, registrant);
      stacks.set(key, Object.freeze([...stack.slice(0, at), registrant, ...stack.slice(at)]));
      changed();
      return () => {
        release(key, registrant);
      };
    },
    set(key, value, options) {
      const registrant = registrantOf(value, { source: options?.source });
      const stack = stacks.get(key) ?? NONE;
      stacks.set(key, Object.freeze([...stack.slice(0, -1), registrant]));
      changed();
      return () => {
        release(key, registrant);
      };
    },
    delete(key) {
      clashes.forget(key);
      const had = (stacks.get(key)?.length ?? 0) > 0;
      stacks.delete(key);
      if (had) changed();
      return had;
    },
    clear() {
      clashes.clear();
      const had = [...stacks.values()].some((stack) => stack.length > 0);
      stacks.clear();
      if (had) changed();
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
export function createValuesReader<V, K>(reflection: Reflection<V, K>): () => readonly V[] {
  let held: { from: readonly ReflectedEntry<V, K>[]; values: readonly V[] } | null = null;
  return () => {
    const from = reflection.entries();
    if (held?.from !== from) held = { from, values: Object.freeze(from.map((e) => e.value)) };
    return held.values;
  };
}
