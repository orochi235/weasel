// Op-factory registries: each pairs a stable `name` (stamped onto each op by
// its factory) with a `(args) => Op` rebuilder, so a `{ name, args }` snapshot
// can be reconstituted into a live `Op` whose `apply`/`invert` behave like the
// original's. A restored history resolves its ops through the registry its
// host was given; the rules every registration follows are
// `ExtensionRegistry`'s (`@weasel-js/registry`).

import { createExtensionRegistry, type ExtensionRegisterOptions, type ExtensionRegistry } from '@weasel-js/registry';
import type { Op } from './types';

/** Rebuilds an op from its serialized `args`. */
export type OpFactory = (args: unknown) => Op;

/** A host's op factories by name. See `ExtensionRegistry` for the registration rules. */
export interface OpRegistry extends ExtensionRegistry<OpFactory> {
  /** The op `name` and `args` describe, or `null` when no factory here or in a parent has the name. */
  rebuild(name: string, args: unknown): Op | null;
}

/** Options for {@link createOpRegistry}. */
export interface CreateOpRegistryOptions {
  /** Resolved for every name this registry does not hold. Defaults to the kit's built-in factories
   *  (`insert`, `delete`, `transform`, …); `null` resolves nothing but this registry's own. */
  parent?: OpRegistry | null;
}

function wrap(base: ExtensionRegistry<OpFactory>): OpRegistry {
  return Object.assign(base, {
    rebuild(name: string, args: unknown): Op | null {
      const f = base.get(name);
      return f ? f(args) : null;
    },
  });
}

/** The kit's own factories, which every registry falls back to unless made with `parent: null`. */
const KIT = wrap(createExtensionRegistry<OpFactory>({ kind: 'op factory' }));

/** A registry of op factories: one per host that should not see another's, or one held by every
 *  host that should share them. */
export function createOpRegistry(options: CreateOpRegistryOptions = {}): OpRegistry {
  const parent = options.parent === undefined ? KIT : options.parent;
  return wrap(createExtensionRegistry<OpFactory>({ kind: 'op factory', parent }));
}

/** The registry a history or scene resolves through when its host names none. Shared by every
 *  such host in the page. */
export const defaultOpRegistry: OpRegistry = createOpRegistry();

/** Register a factory on {@link defaultOpRegistry} and return its release. The builder receives the
 *  serialized `args` and must return an `Op` equivalent to one freshly constructed at the original
 *  call site. A different builder under a name already taken throws unless `replace` is passed. */
export function registerOpFactory<A>(name: string, build: (args: A) => Op, options?: ExtensionRegisterOptions): () => void {
  return defaultOpRegistry.register(name, build as OpFactory, options);
}

/** Register one of the kit's own factories. Not exported from the kit barrel. Replaces, since a
 *  second run of the module registering it is a newer copy of the same factory (hot reload). */
export function registerKitOpFactory<A>(name: string, build: (args: A) => Op): void {
  KIT.register(name, build as OpFactory, { source: 'kit', replace: true });
}
