/**
 * A routing-trait classifier entry. Other traits (shape, label, icon, …)
 * are independent registries — fields like `label` or `icon` do NOT belong
 * on this interface.
 */
export interface NodeRoutingEntry {
  /** Unique kind name. Routing tables key on this string. Consumer-defined;
   *  the kit places no constraint beyond uniqueness within a registry. */
  name: string;
  /** Predicate over a node's `data` payload, and the node itself where the caller has one, for
   *  a kind its data cannot show (`'group'`). First registered kind whose `matches` returns
   *  true claims the node. */
  matches: (data: unknown, node?: RoutedNode) => boolean;
}

/** What a routing entry may read of a node beside its data. */
export interface RoutedNode {
  /** The node's structural kind: `'mark'` or `'group'`. */
  readonly kind?: string;
}

/**
 * The **routing trait's** registry: answers "what routing-kind string does
 * this node's data map to?" The result flows into declarative tool-routing
 * tables (`{ target: 'rect', actionId: 'move' }`).
 */
export interface NodeRouting {
  /** Register a kind. Order matters: first match wins during `classify`.
   *  Throws if a kind with this name is already registered. */
  register(kind: NodeRoutingEntry): void;
  /** Walk registered kinds in registration order; return the first kind
   *  whose `matches(data, node)` returns true, or `'unknown'` if none match. */
  classify(data: unknown, node?: RoutedNode): string;
  /** Lookup a kind entry by name. */
  get(name: string): NodeRoutingEntry | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodeRoutingEntry[];
}

/** The routing kind of a node: the name of the first entry whose `matches(data, node)` returns
 *  true, or `'unknown'`. What `NodeRouting.classify` answers, for a caller holding a plain list. */
export function routeKind(
  entries: readonly NodeRoutingEntry[],
  data: unknown,
  node?: RoutedNode,
): string {
  for (const kind of entries) {
    if (kind.matches(data, node)) return kind.name;
  }
  return 'unknown';
}

/** Build a registry of per-node-kind routing entries. Registering a duplicate
 *  kind name throws. */
export function createNodeRouting(): NodeRouting {
  const entries: NodeRoutingEntry[] = [];
  const byName = new Map<string, NodeRoutingEntry>();
  return {
    register(kind) {
      if (byName.has(kind.name)) {
        throw new Error(
          `createNodeRouting: duplicate kind name "${kind.name}"`,
        );
      }
      byName.set(kind.name, kind);
      entries.push(kind);
    },
    classify(data, node) {
      return routeKind(entries, data, node);
    },
    get(name) {
      return byName.get(name);
    },
    list() {
      return entries;
    },
  };
}
