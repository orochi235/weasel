/**
 * Dep registry for registry unification.
 *
 * Holds named "live source" thunks. Actions declare `requires: ['selection']`;
 * the dispatcher calls `registry.get('selection')` at invocation time to
 * build a typed Deps bag.
 *
 * `DepSchema` — the map of dep name → value type — is the single source of
 * truth for what `requires`/`register`/`get` accept. Its concrete fields live
 * in `./depSchema` (co-located with the dep value types). It is declared there
 * as a plain `export interface` rather than via a cross-module
 * `declare module './depRegistry'` augmentation: that augmentation does NOT
 * merge once rollup-plugin-dts flattens both files into one `.d.ts` chunk,
 * which silently emptied `DepSchema` for consumers. Consumers still extend it
 * via `declare module '@weasel-js/core'` augmentation.
 */
import type { DepSchema, DepName } from '../../index';
import { ScopeNode } from './scopeNode';

/** Holds the live sources an action's declared dependencies resolve to.
 *  Sources are thunks, read at invocation time, so an action never captures
 *  stale state. */
export interface DepRegistry {
  register<K extends DepName>(name: K, source: () => DepSchema[K]): () => void;
  get<K extends DepName>(name: K): DepSchema[K] | undefined;
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
      };
    },
    get: <K extends DepName>(name: K) => {
      for (const n of this.start().chain()) {
        const source = n.sources.get(name as string)?.at(-1);
        if (source) return source() as DepSchema[K];
      }
      return undefined;
    },
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
