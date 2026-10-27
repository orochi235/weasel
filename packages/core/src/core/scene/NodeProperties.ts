import type { PrefSection } from '@weasel-js/prefs';

/**
 * One kind's entry in the **properties trait's** registry: a declarative
 * schema of the kind's editable properties.
 *
 * `schema` is a `PrefSection`, not the `PrefGroup` a preferences schema
 * is: a leaf's own key is its whole dotted node path (`pose.x`,
 * `data.fill`, `data.style.fontSize`), rooted at `pose` or `data`, or a
 * field the node declares for its children (`clip`, `units.unit`), which a
 * panel writes through `scene.setClip` / `scene.setUnits`. The sections it
 * nests are headings only; their keys do not contribute to the node path.
 *
 * Kind names share the routing trait's vocabulary — an entry registered
 * as `'rect'` describes nodes `NodeRouting.classify` maps to `'rect'`.
 */
export interface NodePropertiesEntry {
  /** Kind name — same vocabulary as the routing trait. */
  name: string;
  /** Property schema for this kind. */
  schema: PrefSection;
  /**
   * What a property write stores, given the node as the write left it and as
   * it was: lets a kind keep fields derived from the one written in step
   * with it, in the same undo step. Unset, the write is stored as made.
   */
  settle?(
    next: { pose: unknown; data: unknown },
    prev: { pose: unknown; data: unknown },
  ): { pose: unknown; data: unknown };
}

/**
 * The **properties trait's** registry. Each trait of a node (shape, routing,
 * properties, …) is its own registry; this one answers "what editable
 * properties does this kind expose?"
 */
export interface NodeProperties {
  /** Register a kind. Throws if a kind with this name is already
   *  registered. */
  register(entry: NodePropertiesEntry): void;
  /** Lookup a kind's entry by name. */
  get(name: string): NodePropertiesEntry | undefined;
  /** Enumerate registered kinds in registration order. */
  list(): readonly NodePropertiesEntry[];
}

/** Build a registry of per-node-kind property descriptors, which schema-driven
 *  property panels read to know what a node exposes. Registering a duplicate
 *  kind name throws. */
export function createNodeProperties(): NodeProperties {
  const entries: NodePropertiesEntry[] = [];
  const byName = new Map<string, NodePropertiesEntry>();
  return {
    register(entry) {
      if (byName.has(entry.name)) {
        throw new Error(
          `createNodeProperties: duplicate kind name "${entry.name}"`,
        );
      }
      byName.set(entry.name, entry);
      entries.push(entry);
    },
    get(name) {
      return byName.get(name);
    },
    list() {
      return entries;
    },
  };
}
