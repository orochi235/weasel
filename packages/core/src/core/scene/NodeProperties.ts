import type { ToolPrefGroup } from 'tools/prefs';

/**
 * NodePropertiesEntry — one kind's entry in the **properties trait's**
 * registry: a declarative schema of the kind's editable properties.
 *
 * Leaf keys inside `schema` are dotted node paths (`pose.x`,
 * `data.fill`, `data.style.fontSize`) — a path of any depth rooted at
 * `pose` or `data` — so schema consumers (weasel-ui `SelectionPanel`)
 * can read/aggregate/write generically with no per-kind code. Group
 * keys are organizational only; they do not contribute to the node
 * path.
 *
 * Kind names share the routing trait's vocabulary — an entry registered
 * as `'rect'` describes nodes `NodeRouting.classify` maps to `'rect'`.
 * See `docs/superpowers/specs/2026-07-20-selection-panel-design.md` and
 * the trait taxonomy in
 * `docs/superpowers/specs/2026-05-24-node-traits-reframe-design.md`.
 */
export interface NodePropertiesEntry {
  /** Kind name — same vocabulary as the routing trait. */
  name: string;
  /** Property schema for this kind. */
  schema: ToolPrefGroup;
}

/**
 * NodeProperties — the **properties trait's** registry. Each trait of a
 * node (shape, routing, properties, …) is its own registry; this one
 * answers "what editable properties does this kind expose?" Consumed by
 * weasel-ui's `<SelectionPanel>`.
 *
 * (Supersedes the speculative `NodePropertyRows` name in the traits
 * spec — the stored value is a schema, not render contributors.)
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
