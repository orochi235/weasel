/**
 * NodeKind — a routing-facet classifier entry.
 *
 * The kit consults `NodeKindRegistry` (the routing facet's registry)
 * to derive a kind string for each scene node. Other facets (shape,
 * label, icon, …) are independent registries — fields like `label`
 * or `icon` are NOT future additions to this interface. See:
 * `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.
 */
export interface NodeKind {
  /** Unique kind name. Routing tables key on this string. Consumer-defined;
   *  the kit places no constraint beyond uniqueness within a registry. */
  name: string;
  /** Predicate over a node's `data` payload. First registered kind whose
   *  `matches` returns true claims the node. */
  matches: (data: unknown) => boolean;
}

/**
 * NodeKindRegistry — the **routing facet's** classifier registry.
 *
 * The kit thinks about a node along several **facets** (shape,
 * routing, label, icon, …) — independent per-axis registries. This
 * registry covers the routing facet: it answers "what routing-kind
 * string does this node's data map to?" The result flows into
 * declarative tool-routing tables (`{ target: 'rect', actionId: 'move' }`).
 *
 * Other facets (shape painters, future label/icon/propertyRows
 * registries) are their own registries — they are NOT optional
 * fields on `NodeKind`. See:
 * `docs/superpowers/specs/2026-05-22-node-facets-reframe-design.md`.
 *
 * Instances are constructed by `<SceneCanvas>` from its `kinds` prop
 * and threaded into the synthesized adapter as a `kindOf(id)` method.
 * Direct use from consumer code is supported but not required for the
 * common SceneCanvas flow.
 */
export interface NodeKindRegistry {
  /** Register a kind. Order matters: first match wins during `classify`.
   *  Throws if a kind with this name is already registered. */
  register(kind: NodeKind): void;
  /** Walk registered kinds in registration order; return the first kind
   *  whose `matches(data)` returns true, or `'unknown'` if none match. */
  classify(data: unknown): string;
  /** Lookup a kind entry by name. */
  get(name: string): NodeKind | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodeKind[];
}

export function createNodeKindRegistry(): NodeKindRegistry {
  const entries: NodeKind[] = [];
  const byName = new Map<string, NodeKind>();
  return {
    register(kind) {
      if (byName.has(kind.name)) {
        throw new Error(
          `createNodeKindRegistry: duplicate kind name "${kind.name}"`,
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
