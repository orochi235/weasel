/**
 * The dep registry: named "live source" thunks. Actions declare
 * `requires: ['selection']`; the dispatcher calls `registry.get('selection')`
 * at invocation time to build a typed Deps bag.
 */
import type { DepSchema, DepName } from '../../index';
import { ScopeNode } from './scopeNode';

/** Holds the live sources an action's declared dependencies resolve to.
 *  Sources are thunks, read at invocation time, so an action never captures
 *  stale state. */
export interface DepRegistry {
  register<K extends DepName>(name: K, source: () => DepSchema[K]): () => void;
  get<K extends DepName>(name: K): DepSchema[K] | undefined;
  /** Hear that what the registry answers may have changed: a source was
   *  registered or released anywhere in its tree, or an owner called
   *  {@link DepRegistry.changed}. Returns the unsubscribe. A hand-built
   *  registry whose answers never change leaves this and `changed` out. */
  subscribe?(listener: () => void): () => void;
  /** Say that a source's value changed. A source is a thunk read on demand,
   *  so its owner is the only one who knows; chrome showing an action's
   *  `enabled` or `active` state re-reads on this. */
  changed?(): void;
  /** Every name a `get` here would answer, sorted, with where its live
   *  source sits. For inspection; a hand-built registry may leave it out. */
  list?(): readonly DepListing[];
}

/** One name a dep registry answers, as {@link DepRegistry.list} reports it. */
export interface DepListing {
  name: string;
  /** How many scopes above the asking one the live source was registered: 0 for its own. */
  depth: number;
  /** How many sources that scope holds under the name, the live one included. */
  stacked: number;
}

/** One node of the dep tree: the sources registered at it, over its parent's.
 *  Each name holds a stack of sources, newest live, so a displaced source is
 *  restored when the one above it leaves. */
export class DepNode extends ScopeNode<DepNode> {
  private readonly sources = new Map<string, (() => unknown)[]>();

  readonly registry: DepRegistry = {
    register: <K extends DepName>(name: K, source: () => DepSchema[K]) => {
      const key = name as string;
      const entry = source as () => unknown;
      const stack = this.sources.get(key);
      if (stack) stack.push(entry);
      else this.sources.set(key, [entry]);
      this.changed();
      let released = false;
      return () => {
        if (released) return;
        released = true;
        const cur = this.sources.get(key);
        if (!cur) return;
        // Our own entry, wherever it now sits: a source already displaced must
        // take itself out without disturbing the one above it.
        const i = cur.lastIndexOf(entry);
        if (i === -1) return;
        cur.splice(i, 1);
        if (cur.length === 0) this.sources.delete(key);
        this.changed();
      };
    },
    get: <K extends DepName>(name: K) => {
      for (const n of this.start().chain()) {
        const source = n.sources.get(name as string)?.at(-1);
        if (source) return source() as DepSchema[K];
      }
      return undefined;
    },
    subscribe: (listener: () => void) => this.tree.listeners.subscribe(listener),
    list: () => {
      const found = new Map<string, DepListing>();
      let depth = 0;
      for (const n of this.start().chain()) {
        for (const [name, stack] of n.sources) {
          if (!found.has(name)) found.set(name, { name, depth, stacked: stack.length });
        }
        depth++;
      }
      return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    changed: () => this.changed(),
  };

  constructor(parent: DepNode | null, descends: boolean) {
    super(parent, descends);
    NODES.set(this.registry, this);
  }
}

const NODES = new WeakMap<DepRegistry, DepNode>();

/** The tree node behind `registry`, when it is one of ours. */
export function depNodeOf(registry: DepRegistry | null): DepNode | null {
  return registry ? (NODES.get(registry) ?? null) : null;
}

/**
 * A stock dep registry with no parent: what `<DepRegistryProvider>` mounts,
 * for a dispatcher driven without React. Sources registered under one name
 * stack, newest live, and releasing one restores the one beneath it.
 */
export function createDepRegistry(): DepRegistry {
  return new DepNode(null, true).registry;
}
