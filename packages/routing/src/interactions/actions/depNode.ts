/**
 * The dep registry: named "live source" thunks. Actions declare
 * `requires: ['selection']`; the dispatcher calls `registry.get('selection')`
 * at invocation time to build a typed Deps bag.
 */
import { createReflectable, type Reflection, type Registrant } from '@weasel-js/registry';
import type { DepSchema, DepName } from '../../index';
import { ScopeNode } from './scopeNode';

/** Holds the live sources an action's declared dependencies resolve to.
 *  Sources are thunks, read at invocation time, so an action never captures
 *  stale state. */
export interface DepRegistry {
  /** Adds a live source for `name` over any already there. `below` answers
   *  what the registry would without this source, so one can handle part of
   *  a dep and hand the rest to the default it displaced. */
  register<K extends DepName>(name: K, source: DepSource<K>): () => void;
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
  /** The sources registered at this registry itself, none from the scopes above it. A hand-built
   *  registry may leave it out. */
  readonly reflection?: Reflection<DepSource<DepName>>;
}

/** A live source for dep `K`: a thunk read at invocation time. `below` reads
 *  the source this one displaced, under it in its scope or in a scope above. */
export type DepSource<K extends DepName> = (below: () => DepSchema[K] | undefined) => DepSchema[K];

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
  private readonly sources = createReflectable<DepSource<DepName>>({ name: 'dep sources', layered: true });

  readonly registry: DepRegistry = {
    register: <K extends DepName>(name: K, source: DepSource<K>) =>
      this.sources.push(name as string, source as unknown as DepSource<DepName>),
    get: <K extends DepName>(name: K) => {
      const stacks = [...this.start().chain()].map((n) => n.sources.stack(name as string));
      return readFrom(stacks, 0, (stacks[0]?.length ?? 0) - 1) as DepSchema[K] | undefined;
    },
    subscribe: (listener: () => void) => this.tree.listeners.subscribe(listener),
    list: () => {
      const found = new Map<string, DepListing>();
      let depth = 0;
      for (const n of this.start().chain()) {
        for (const { key: name, shadowed } of n.sources.entries()) {
          if (!found.has(name)) found.set(name, { name, depth, stacked: shadowed.length + 1 });
        }
        depth++;
      }
      return [...found.values()].sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
    },
    changed: () => this.changed(),
    reflection: this.sources.reflection,
  };

  constructor(parent: DepNode | null, descends: boolean) {
    super(parent, descends);
    this.sources.subscribe(() => this.changed());
    NODES.set(this.registry, this);
  }
}

type Source = (below: () => unknown) => unknown;

/** The source at `stacks[scope][index]`, or the first one under it, read with
 *  its own `below`. `stacks` runs from the asking scope outward. */
function readFrom(stacks: readonly (readonly Registrant<DepSource<DepName>>[])[], scope: number, index: number): unknown {
  if (scope >= stacks.length) return undefined;
  if (index < 0) return readFrom(stacks, scope + 1, (stacks[scope + 1]?.length ?? 0) - 1);
  return (stacks[scope]![index]!.value as Source)(() => readFrom(stacks, scope, index - 1));
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
