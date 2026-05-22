/**
 * NodeKind — a classifier entry registered with a `NodeKindRegistry`.
 *
 * The kit consults the registry to derive a kind string for each scene
 * node, which then flows into declarative tool-routing tables (e.g.
 * `{ target: 'rect', actionId: 'move' }`).
 *
 * v1 carries only the classification facet. Future kind-keyed concerns
 * (label / icon / propertyRows / bindings / serialize) land here as
 * optional fields per the convergence policy in the design spec.
 *
 * See `docs/superpowers/specs/2026-05-21-node-kind-registry-design.md`.
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
 * NodeKindRegistry — per-`<SceneCanvas>` collection of `NodeKind` entries.
 *
 * Instances are constructed by `<SceneCanvas>` from its `kinds` prop and
 * threaded into the synthesized adapter as a `kindOf(id)` method. Direct
 * use from consumer code is supported but not required for the common
 * SceneCanvas flow.
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
