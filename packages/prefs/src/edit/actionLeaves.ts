import type { PrefAction, PrefLeaf } from '../index';
import { childrenOf, undigit, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** An action a schema can hold a pref for: the key the pref fires, and how a catalog names and files it. */
export interface SchemaAction {
  /** What an action pref's `action` holds: the action's id, or `id:variant`. */
  key: string;
  label: string;
  /** What a catalog files it under. */
  group?: string;
  /** Words a filter also finds it by: the action's tags, then its variant's. */
  tags?: readonly string[];
}

/** The pref that fires `action`: plain data, so it exports as written and survives a draft. */
export function actionLeaf(action: Pick<SchemaAction, 'key' | 'label'>): PrefLeaf {
  const leaf: PrefAction = { kind: 'action', name: action.label, description: '', default: undefined, action: action.key };
  return leaf;
}

/** A schema key for the pref that fires `key`: its words run together, since a key holds no `.` or `:`, and `_` first where it would start with a digit. */
export function actionLeafKey(key: string): string {
  const words = key.split(/[^A-Za-z0-9]+/).filter(Boolean);
  return undigit(words.map((w, i) => (i === 0 ? w : w[0]!.toUpperCase() + w.slice(1))).join('')) || 'action';
}

/** The tree paths of the action prefs in `root` that fire a key not among `keys`, nor the bare id of one. */
export function deadActionPaths(root: SchemaRoot, keys: ReadonlySet<string>, join: (parent: string | null, key: string) => string): Set<string> {
  const out = new Set<string>();
  // A bare parametric id is drawn as its variants, so a variant key makes its id live too.
  const live = new Set([...keys].flatMap((k) => (k.includes(':') ? [k, k.slice(0, k.indexOf(':'))] : [k])));
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const at = join(path, key);
      const fires = (child as { kind?: string; action?: string }).kind === 'action' ? (child as PrefAction).action : undefined;
      if (fires !== undefined && !live.has(fires)) out.add(at);
      walk(child, at);
    }
  };
  walk(root, null);
  return out;
}
