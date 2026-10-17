import { isPrefLeaf } from '@weasel-js/prefs';
import { scopedKey } from './assetScope';
import { childrenOf, joinPath, type SchemaNode, type SchemaRoot } from './schemaEdit';

/** The paths of every row the structure tree can fold: each branch, and each `actions` leaf, whose row holds the
 *  actions it draws. */
export function foldablePaths(root: SchemaRoot): string[] {
  const out: string[] = [];
  const walk = (node: SchemaNode, path: string | null): void => {
    for (const [key, child] of Object.entries(childrenOf(node) ?? {})) {
      const p = joinPath(path, key);
      if (childrenOf(child)) {
        out.push(p);
        walk(child, p);
      } else if (isPrefLeaf(child) && child.kind === 'actions') out.push(p);
    }
  };
  walk(root, null);
  return out;
}

/**
 * The open rows after an undo or redo from `before`: `open`, and each row the step brought back that was open
 * when its schema was last shown (`was`). A re-keyed or moved group comes back under a path `open` has let go of.
 */
export function openAfterStep(open: ReadonlySet<string>, before: SchemaRoot, was: ReadonlySet<string> | undefined): Set<string> {
  const had = new Set(foldablePaths(before));
  return new Set([...open, ...[...(was ?? [])].filter((path) => !had.has(path))]);
}

/** Where the rows a reader folded in each asset's structure tree are kept. */
export interface Folds {
  /** The rows folded in the asset `assetId`. */
  open(assetId: string): string[];
  save(assetId: string, folded: readonly string[]): void;
}

/**
 * The folds of one editor. Under a `draftKey` they are kept in this browser beside the draft, always in
 * `localStorage` wherever the draft itself is: how a tree is folded is one reader's view of it. With no key they
 * last as long as what this returns.
 */
export function foldsUnder(draftKey: string | undefined): Folds {
  if (draftKey === undefined) {
    const held = new Map<string, readonly string[]>();
    return {
      open: (assetId) => [...(held.get(scopedKey('folds', assetId)) ?? [])],
      save: (assetId, folded) => { held.set(scopedKey('folds', assetId), folded); },
    };
  }
  const key = (assetId: string): string => scopedKey(`${draftKey}:folds`, assetId);
  return {
    open(assetId) {
      try {
        const folded: unknown = JSON.parse(localStorage.getItem(key(assetId)) ?? '[]');
        return Array.isArray(folded) ? folded.filter((id): id is string => typeof id === 'string') : [];
      } catch {
        return [];
      }
    },
    save(assetId, folded) {
      try {
        if (folded.length === 0) localStorage.removeItem(key(assetId));
        else localStorage.setItem(key(assetId), JSON.stringify(folded));
      } catch {
        // A browser that refuses storage opens every row next time.
      }
    },
  };
}
