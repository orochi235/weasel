import { createEmitter } from './emitter';
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
 *   returns its own release, and the id stays until every one of them has run. In a child, a value
 *   the id resolves to through the parent is held there: it follows a replacement in the parent, and
 *   if the parent drops the id the child takes it over.
 * - **Explicit replacement.** Registering a different value under a taken id throws
 *   {@link ExtensionConflictError}, in development and production alike, unless the call passes
 *   `replace: true`.
 * - **Disposal.** `register` returns the release. A release after a replacement, or a second call
 *   of one, does nothing.
 * - **Scoped.** A registry made with a `parent` resolves its own ids first and then the parent's.
 *   Hosts that should not see each other's extensions each make their own; hosts that should share
 *   them hold one registry, or children of one. A parent never sees its children, so its own
 *   registration is never refused for an id a child holds: the child's value goes on shadowing it.
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
  /** What the registry holds, for error messages and its reflection's `name`: `'op factory'`, `'shader program'`. */
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

/** Counts registrations across every registry, so a child can order its ids among its parent's. */
let nextOrder = 0;
/** When each registry made with {@link createExtensionRegistry} first held an id, here or in a parent. */
const orderOfRegistry = new WeakMap<object, (id: string) => number | undefined>();

interface Holding {
  /** Identifies the registration a release belongs to; a replacement makes a new one. */
  token: object;
  count: number;
}

/** Registrations of a value a child's parent already resolves the id to, which the child holds without a copy. */
interface Lean<V> {
  holding: Holding;
  value: V;
  source: string | undefined;
  /** Where the id stood when the hold began, so taking it over keeps its place. */
  order: number;
}

/** A child's holds through its parent. It hears the parent while it holds any: one the parent replaces with a
 *  different value is dropped, and one whose id the parent drops is handed to `take`. */
function createLeans<V>(
  parent: ExtensionRegistry<V>, same: (a: V, b: V) => boolean, take: (id: string, lean: Lean<V>) => void,
) {
  const leans = new Map<string, Lean<V>>();
  let off: (() => void) | null = null;
  const stop = (): void => {
    if (leans.size > 0 || !off) return;
    off();
    off = null;
  };
  const settle = (): void => {
    for (const [id, lean] of leans) {
      const theirs = parent.get(id);
      if (theirs !== undefined && same(theirs, lean.value)) continue;
      leans.delete(id);
      if (theirs === undefined) take(id, lean);
    }
    stop();
  };
  return {
    get: (id: string): Lean<V> | undefined => leans.get(id),
    add(id: string, lean: Lean<V>): void {
      leans.set(id, lean);
      off ??= parent.subscribe(settle);
    },
    drop(id: string): void {
      leans.delete(id);
      stop();
    },
    clear(): void {
      leans.clear();
      stop();
    },
  };
}

/** Bring `seen` up to the ids `parent` resolves: drop the gone, and order the new after everything so far. */
function see(parent: Reflection<unknown>, seen: Map<string, number>): void {
  const ids = new Set(parent.entries().map((e) => e.key));
  for (const id of seen.keys()) if (!ids.has(id)) seen.delete(id);
  for (const id of ids) if (!seen.has(id)) seen.set(id, nextOrder++);
}

/** Make an {@link ExtensionRegistry}: one per host that should keep its extensions to itself, or one
 *  shared by hosts that should not. */
export function createExtensionRegistry<V>(options: ExtensionRegistryOptions<V>): ExtensionRegistry<V> {
  const { kind } = options;
  const parent = options.parent ?? null;
  const same = options.same ?? Object.is;
  const store = createReflectable<V>({ name: kind, holdPlace: true });
  const held = new Map<string, Holding>();
  /** When this registry's store came to hold each id it holds. */
  const since = new Map<string, number>();
  const knownOrder = parent ? orderOfRegistry.get(parent) : undefined;
  const foreignParent = parent !== null && knownOrder === undefined;
  /** For a parent this module did not make, which keeps no order to read: when this registry first saw each id. */
  const seen = new Map<string, number>();
  const seeParent = (): void => { see(parent!, seen); };
  const parentOrder = knownOrder ?? (foreignParent ? (id: string) => seen.get(id) : undefined);
  const orderOf = (id: string): number | undefined => {
    // A released id keeps its `since` until the next tick, to take its place back if registered again; until then it sits where its parent puts it.
    const mine = held.has(id) ? since.get(id) : undefined;
    const theirs = parentOrder?.(id);
    return mine === undefined ? theirs : theirs === undefined ? mine : Math.min(mine, theirs);
  };
  let cached: { version: number; entries: readonly ReflectedEntry<V>[] } | null = null;
  /** This registry's own listeners, so subscribing here never shares a subscription a listener holds on `own` or
   *  the parent; it hears the store and the parent only while it has listeners. */
  const changes = createEmitter();
  const notify = (): void => { changes.emit(); };
  let offUpstream: (() => void) | null = null;
  const leans = parent ? createLeans(parent, same, (id, lean) => {
    held.set(id, lean.holding);
    since.set(id, lean.order);
    store.set(id, lean.value, lean.source !== undefined ? { source: lean.source } : undefined);
  }) : null;

  const get = (id: string): V | undefined => (store.has(id) ? store.get(id) : parent?.get(id));
  const getVersion = (): number => store.getVersion() + (parent?.getVersion() ?? 0);

  function createRelease(id: string, holding: Holding): () => void {
    let done = false;
    return () => {
      if (done) return;
      done = true;
      const leaning = held.get(id)?.token !== holding.token;
      if (leaning && leans?.get(id)?.holding !== holding) return;
      if (--holding.count > 0) return;
      if (leaning) return leans!.drop(id);
      held.delete(id);
      const live = store.stack(id).at(-1);
      if (live) store.release(id, live);
      queueMicrotask(() => {
        if (!held.has(id)) since.delete(id);
      });
    };
  }

  const registry: ExtensionRegistry<V> = {
    name: kind,
    parent,
    own: store.reflection,
    get,
    has: (id) => store.has(id) || (parent?.has(id) ?? false),
    entries() {
      const version = getVersion();
      if (cached?.version === version) return cached.entries;
      if (foreignParent) seeParent();
      const mine = store.entries();
      const inherited = (parent?.entries() ?? []).filter((e) => !store.has(e.key));
      const all = [...inherited, ...mine];
      if (parentOrder) all.sort((a, b) => (orderOf(a.key) ?? 0) - (orderOf(b.key) ?? 0));
      cached = { version, entries: Object.freeze(all) };
      return cached.entries;
    },
    subscribe(listener) {
      if (changes.size === 0) {
        const offStore = store.subscribe(notify);
        const offParent = parent?.subscribe(notify);
        offUpstream = () => { offStore(); offParent?.(); };
      }
      const off = changes.subscribe(listener);
      return () => {
        off();
        if (changes.size > 0 || !offUpstream) return;
        offUpstream();
        offUpstream = null;
      };
    },
    getVersion,
    register(id, value, opts = {}) {
      const have = get(id);
      if (have !== undefined && same(have, value)) {
        const holding = held.get(id) ?? leans?.get(id)?.holding;
        if (holding) {
          holding.count++;
          return createRelease(id, holding);
        }
        if (foreignParent) seeParent();
        const lean: Lean<V> = { holding: { token: {}, count: 1 }, value, source: opts.source, order: orderOf(id) ?? nextOrder++ };
        leans!.add(id, lean);
        return createRelease(id, lean.holding);
      }
      if (have !== undefined && !same(have, value) && !opts.replace) throw new ExtensionConflictError(kind, id);
      const next: Holding = { token: {}, count: 1 };
      held.set(id, next);
      leans?.drop(id);
      if (foreignParent) seeParent();
      if (!since.has(id)) since.set(id, nextOrder++);
      store.set(id, value, opts.source !== undefined ? { source: opts.source } : undefined);
      return createRelease(id, next);
    },
    clear() {
      held.clear();
      leans?.clear();
      since.clear();
      store.clear();
    },
  };
  orderOfRegistry.set(registry, orderOf);
  return registry;
}
