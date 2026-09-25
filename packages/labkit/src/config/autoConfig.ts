import type { PrefGroup, PrefLeaf } from '@weasel-js/ui';
import { isAuto } from './auto';
import { isRecord, withValueAtPath } from './path';
import type { ResolvedConfig } from './types';

type Resolver = (config: Record<string, unknown>) => unknown;

/** Reads a labkit-only extra off a resolved leaf. `PrefLeaf` has no field for
 *  these; they ride as extra keys and survive the resolve walk. */
function extra<T>(leaf: PrefLeaf, key: string): T | undefined {
  return (leaf as unknown as Record<string, T | undefined>)[key];
}

/** Every leaf in a resolved schema, in schema order, with its dotted path. */
function* leaves(group: PrefGroup, at = ''): Generator<[string, PrefLeaf]> {
  for (const [key, child] of Object.entries(group.children)) {
    const path = at === '' ? key : `${at}.${key}`;
    if ('kind' in child) yield [path, child];
    else yield* leaves(child, path);
  }
}

/** The dotted paths a schema declares as starting auto — every leaf that said
 *  `.initial(auto)`. This is what seeds a new trial's unpinned set. */
export function autoPathsOf(resolved: ResolvedConfig): string[] {
  const out: string[] = [];
  for (const [path, leaf] of leaves(resolved.group)) {
    if (extra<boolean>(leaf, 'unpinned')) out.push(path);
  }
  return out;
}

/**
 * The config an instrument reads: the stored one, with every unpinned path
 * either computed by its resolver or removed.
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
  for (const [path, leaf] of leaves(resolved.group)) {
    if (autoPaths.has(path)) resolvers.set(path, extra<Resolver>(leaf, 'autoResolve'));
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
    if (!resolve) {
      done.add(path);
      return;
    }
    inFlight.add(path);
    try {
      // Read `out` only after the resolver has run: it forces its own
      // dependencies, and each of those replaced `out`.
      const value = resolve(demand(() => out, resolvers, need));
      out = withValueAtPath(out, path, value);
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
  if (head === undefined || !(head in config)) return config;
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
 * unpinned paths. `auto` pins nothing and joins the set; any other value is
 * written and leaves it. Both the store and the chrome go through this, so
 * they cannot disagree about what a write meant.
 */
export function applyConfigWrite<TC>(
  config: TC,
  autoPaths: readonly string[],
  path: string,
  value: unknown,
): { config: TC; autoPaths: readonly string[] } {
  if (isAuto(value)) {
    if (autoPaths.includes(path)) return { config, autoPaths };
    return { config, autoPaths: [...autoPaths, path] };
  }
  return {
    config: withValueAtPath(config, path, value),
    autoPaths: autoPaths.includes(path) ? autoPaths.filter((p) => p !== path) : autoPaths,
  };
}
