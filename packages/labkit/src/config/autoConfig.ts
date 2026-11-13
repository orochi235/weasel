import { type PrefLeaf, prefAutoValue, prefStartsAuto } from '@weasel-js/prefs';
import { isAuto } from './auto';
import { configLeaves } from './leaves';
import { isRecord, setOwn, valueAtPath, withValueAtPath } from './path';
import { storedDefault } from './storedDefault';
import type { ResolvedConfig } from './types';

type Resolver = (config: Record<string, unknown>) => unknown;

/** Reads a labkit-only extra off a resolved leaf. `PrefLeaf` has no field for
 *  these; they ride as extra keys and survive the resolve walk. */
function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/** The resolver a leaf's `.auto(fn)` declared, which computes it while it is auto ahead of anything the
 *  schema says (`prefAutoValue`). */
export function autoResolverOf(leaf: PrefLeaf): Resolver | undefined {
  return extra<Resolver>(leaf, 'autoResolve');
}

/** Whether a leaf's auto row reads out its value beside the word: `.quote()`. */
export function autoQuotes(leaf: PrefLeaf): boolean {
  return extra<boolean>(leaf, 'autoQuote') === true;
}

/** The dotted paths a schema declares as starting auto — every leaf that said
 *  `.initial(auto)`. This is what seeds a new trial's unpinned set. */
export function autoPathsOf(resolved: ResolvedConfig): string[] {
  const out: string[] = [];
  for (const [path, leaf] of configLeaves(resolved.group)) {
    if (prefStartsAuto(leaf)) out.push(path);
  }
  return out;
}

/**
 * The config an instrument reads: the stored one, with every unpinned path at
 * what it reads while auto (`prefAutoValue`): its resolver's value, else its
 * `auto.value`, else its default. A path with no resolver and no `auto.value`
 * is removed instead: the instrument is that leaf's resolver (`.auto()`), and
 * reading `undefined` is how it knows to work the value out.
 *
 * Resolution is demand-driven — a resolver reading another unpinned path
 * forces that one first, whatever order the schema declared them in — so a
 * cycle is a real cycle and not an ordering accident.
 */
export function resolveAutoConfig<TC>(
  resolved: ResolvedConfig,
  config: TC,
  autoPaths: ReadonlySet<string>,
): TC {
  if (autoPaths.size === 0) return config;

  const resolvers = new Map<string, Resolver | undefined>();
  const leaves = new Map<string, PrefLeaf>();
  for (const [path, leaf] of configLeaves(resolved.group)) {
    if (!autoPaths.has(path)) continue;
    resolvers.set(path, autoResolverOf(leaf));
    leaves.set(path, leaf);
  }
  if (resolvers.size === 0) return config;

  // Drop first, so a resolver reading a still-unresolved auto path sees
  // `undefined` rather than a stale pinned value it would silently believe.
  let out = config as unknown as Record<string, unknown>;
  for (const path of resolvers.keys()) out = dropAtPath(out, path);

  const inFlight = new Set<string>();
  const done = new Set<string>();

  const need = (path: string): void => {
    if (done.has(path)) return;
    if (inFlight.has(path)) {
      throw new Error(`[labkit] auto resolver cycle at "${path}"`);
    }
    const resolve = resolvers.get(path);
    const leaf = leaves.get(path);
    if (leaf === undefined) {
      done.add(path);
      return;
    }
    inFlight.add(path);
    try {
      // Read `out` only after the resolver has run: it forces its own
      // dependencies, and each of those replaced `out`.
      const computed = resolve?.(demand(() => out, resolvers, need));
      const value = prefAutoValue(leaf, computed, () =>
        resolve ? storedDefault(leaf) : undefined,
      );
      if (value !== undefined) out = withValueAtPath(out, path, value);
    } finally {
      inFlight.delete(path);
    }
    done.add(path);
  };

  for (const path of resolvers.keys()) need(path);
  return out as unknown as TC;
}

/**
 * The config a resolver reads. A top-level key that is itself unpinned is
 * forced before it is handed back, which is what makes declaration order
 * irrelevant and turns a genuine loop into a named error.
 *
 * Only top-level keys are trapped: a resolver reaching `c.grid.size` gets the
 * already-dropped branch, and a nested auto path it depends on resolves by
 * schema order alone.
 */
function demand(
  read: () => Record<string, unknown>,
  resolvers: ReadonlyMap<string, Resolver | undefined>,
  need: (path: string) => void,
): Record<string, unknown> {
  return new Proxy(read(), {
    get(_target, key) {
      if (typeof key === 'string' && resolvers.has(key)) need(key);
      return Reflect.get(read(), key);
    },
    has(_target, key) {
      return Reflect.has(read(), key);
    },
    ownKeys() {
      return Reflect.ownKeys(read());
    },
    getOwnPropertyDescriptor(_target, key) {
      return Reflect.getOwnPropertyDescriptor(read(), key);
    },
  });
}

/** A copy of `config` with the dotted path removed, copying every record on
 *  the way down. A path that is not there comes back unchanged. */
function dropAtPath(config: Record<string, unknown>, path: string): Record<string, unknown> {
  const [head, ...rest] = path.split('.');
  if (head === undefined || !Object.hasOwn(config, head)) return config;
  if (rest.length === 0) {
    const { [head]: _dropped, ...kept } = config;
    return kept;
  }
  const child = config[head];
  if (!isRecord(child)) return config;
  return { ...config, [head]: dropAtPath(child, rest.join('.')) };
}

/**
 * What writing `value` at `path` makes of a trial's raw config and its set of
 * unpinned paths. A write pins every leaf at or under `path`, except where it
 * holds the `auto` sentinel: that leaf joins the set and keeps what it last
 * held, so a group's value can unpin some leaves and pin the rest in one write
 * (a reset). Both the store and the chrome go through this, so they cannot
 * disagree about what a write meant.
 */
export function applyConfigWrite<TC>(
  config: TC,
  autoPaths: readonly string[],
  path: string,
  value: unknown,
): { config: TC; autoPaths: readonly string[] } {
  const unpin: string[] = [];
  const held = valueAtPath(config as Record<string, unknown>, path);
  const stored = withoutAuto(value, path, held, unpin);
  const under = (p: string): boolean => p === path || p.startsWith(`${path}.`);
  const next = [...autoPaths.filter((p) => !under(p)), ...unpin];
  const same = next.length === autoPaths.length && next.every((p) => autoPaths.includes(p));
  return {
    config: isAuto(value) ? config : withValueAtPath(config, path, stored),
    autoPaths: same ? autoPaths : next,
  };
}

/** `value` with each `auto` sentinel in it replaced by what `held` has there, its path added to `unpin`. */
function withoutAuto(value: unknown, at: string, held: unknown, unpin: string[]): unknown {
  if (isAuto(value)) {
    unpin.push(at);
    return held;
  }
  if (!isRecord(value)) return value;
  let out: Record<string, unknown> | undefined;
  for (const [key, child] of Object.entries(value)) {
    const next = withoutAuto(child, `${at}.${key}`, isRecord(held) ? held[key] : undefined, unpin);
    if (next === child) continue;
    out ??= { ...value };
    setOwn(out, key, next);
  }
  return out ?? value;
}
