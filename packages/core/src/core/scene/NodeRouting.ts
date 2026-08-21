/**
 * NodeRoutingEntry — a routing-trait classifier entry.
 *
 * The kit consults `NodeRouting` (the routing trait's registry)
 * to derive a kind string for each scene node. Other traits (shape,
 * label, icon, …) are independent registries — fields like `label`
 * or `icon` are NOT future additions to this interface. See:
 * `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`.
 */
export interface NodeRoutingEntry {
  /** Unique kind name. Routing tables key on this string. Consumer-defined;
   *  the kit places no constraint beyond uniqueness within a registry. */
  name: string;
  /** Predicate over a node's `data` payload. First registered kind whose
   *  `matches` returns true claims the node. */
  matches: (data: unknown) => boolean;
}

/**
 * NodeRouting — the **routing trait's** registry. Each trait of a
 * node (shape, routing, label, icon, affordances, …) is its own
 * registry; this one answers "what routing-kind string does this
 * node's data map to?" The result flows into declarative tool-routing
 * tables (`{ target: 'rect', actionId: 'move' }`).
 *
 * Other traits (shape painters, future label/icon/propertyRows
 * registries) are their own registries — they are NOT optional
 * fields on `NodeRoutingEntry`. See:
 * `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`.
 *
 * Instances are constructed by `<SceneCanvas>` from its `routing` prop
 * and used to classify each hit node's `data` into a `kind` string when
 * building `getNodeAtPoint`. Direct use from consumer code is supported
 * but not required for the common SceneCanvas flow.
 */
export interface NodeRouting {
  /** Register a kind. Order matters: first match wins during `classify`.
   *  Throws if a kind with this name is already registered. */
  register(kind: NodeRoutingEntry): void;
  /** Walk registered kinds in registration order; return the first kind
   *  whose `matches(data)` returns true, or `'unknown'` if none match. */
  classify(data: unknown): string;
  /** Lookup a kind entry by name. */
  get(name: string): NodeRoutingEntry | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodeRoutingEntry[];
}

/** Build a registry of per-node-kind routing entries, which decide how a node
 *  kind is drawn, hit-tested and serialized. Registering a duplicate kind name
 *  throws. */
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
    classify(data) {
      for (const kind of entries) {
        if (kind.matches(data)) return kind.name;
      }
      return 'unknown';
    },
    get(name) {
      return byName.get(name);
    },
    list() {
      return entries;
    },
  };
}
