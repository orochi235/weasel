/**
 * Tool options kept in a prefs store: the schema a host's prefs hold them
 * under, and the `toolOptionValues` that reads and writes them there.
 */
import type { PrefGroup, PrefLeaf } from '@weasel-js/prefs';
import { deepEqual } from '@weasel-js/registry';
import { SHARED_TOOL_OPTIONS, toolOptionSlot, type ToolOptions, type ToolOptionValues } from './toolOptions';

/** A tool as these read it: its id and its options. */
export interface OptionedTool {
  readonly id: string;
  readonly options?: ToolOptions;
}

/** The part of a `PrefsStore` {@link prefsToolOptionValues} uses. */
export interface ToolOptionPrefsStore {
  values(): Record<string, unknown>;
  set(path: string, value: unknown): void;
  subscribe(listener: () => void): () => void;
}

/** How {@link toolOptionsPrefs} names its group, and the host's defaults for shared keys. */
export interface ToolOptionsPrefsSpec {
  name?: string;
  description?: string;
  /** A shared key's default where the host decides it: the fill a new shape takes before anyone picks one. A key
   *  left out defaults as the first tool naming it declares. */
  shared?: Readonly<Record<string, unknown>>;
}

/**
 * The prefs group `tools`' options are kept in: a group per tool holding its
 * own options, and a {@link SHARED_TOOL_OPTIONS} group holding each shared
 * key once, as the first tool naming it declares it, with the default the host
 * gives it. A tool with no options of its own has no group.
 */
export function toolOptionsPrefs(tools: Iterable<OptionedTool>, spec: ToolOptionsPrefsSpec = {}): PrefGroup {
  const children: Record<string, PrefLeaf | PrefGroup> = {};
  const shared: Record<string, PrefLeaf | PrefGroup> = {};
  for (const tool of tools) {
    const options = tool.options;
    if (!options) continue;
    const own: Record<string, PrefLeaf | PrefGroup> = {};
    for (const [key, leaf] of Object.entries(options.prefs.children)) {
      const slot = toolOptionSlot(tool.id, options, key);
      if (slot.owner === tool.id) own[key] = leaf;
      else if (!Object.hasOwn(shared, slot.key)) shared[slot.key] = leaf;
    }
    if (Object.keys(own).length > 0) children[tool.id] = { ...options.prefs, children: own };
  }
  for (const [key, value] of Object.entries(spec.shared ?? {})) {
    const leaf = shared[key];
    if (leaf && 'kind' in leaf) shared[key] = { ...leaf, default: value } as PrefLeaf;
  }
  if (Object.keys(shared).length > 0) {
    children[SHARED_TOOL_OPTIONS] = { name: 'Shared', description: 'Settings every tool naming them uses.', children: shared };
  }
  return { name: spec.name ?? 'Tools', description: spec.description ?? 'Each tool’s settings.', children };
}

const pathOf = (base: string, owner: string, key: string) => (base ? `${base}.${owner}.${key}` : `${owner}.${key}`);

function subtree(values: Record<string, unknown>, base: string): Record<string, unknown> | undefined {
  let at: unknown = values;
  for (const part of base ? base.split('.') : []) at = (at as Record<string, unknown> | undefined)?.[part];
  return at && typeof at === 'object' ? (at as Record<string, unknown>) : undefined;
}

const NONE: Readonly<Record<string, unknown>> = Object.freeze({});

/**
 * Tool option values kept in `store` under `base`, each owner's at
 * `<base>.<owner>.<key>`: the layout {@link toolOptionsPrefs} makes. The
 * store's schema decides each default, so a shared key nobody set reads the
 * default the host gave it.
 */
export function prefsToolOptionValues(store: ToolOptionPrefsStore, base: string): ToolOptionValues {
  const cache = new Map<string, { values: unknown; out: Readonly<Record<string, unknown>> }>();
  return {
    get(owner) {
      const values = store.values();
      const hit = cache.get(owner);
      if (hit && hit.values === values) return hit.out;
      const held = subtree(values, base)?.[owner];
      let out = held && typeof held === 'object' ? (held as Readonly<Record<string, unknown>>) : NONE;
      // An unchanged answer keeps its identity, so a subscriber comparing it sees no change.
      if (hit && deepEqual(hit.out, out)) out = hit.out;
      cache.set(owner, { values, out });
      return out;
    },
    set: (owner, key, value) => store.set(pathOf(base, owner, key), value),
    subscribe: (listener) => store.subscribe(() => listener()),
  };
}
