import { branchPaths, type SchemaRoot } from './schemaEdit';

/**
 * The open rows after an undo or redo from `before`: `open`, and each row the step brought back that was open
 * when its schema was last shown (`was`). A re-keyed or moved group comes back under a path `open` has let go of.
 */
export function openAfterStep(open: ReadonlySet<string>, before: SchemaRoot, was: ReadonlySet<string> | undefined): Set<string> {
  const had = new Set(branchPaths(before));
  return new Set([...open, ...[...(was ?? [])].filter((path) => !had.has(path))]);
}

const foldsKey = (draftKey: string): string => `${draftKey}:folds`;

/**
 * The rows of the structure tree a reader has folded, kept in this browser beside the draft under `draftKey`.
 * Always `localStorage`, wherever the draft itself is kept: how a tree is folded is one reader's view of it.
 */
export function openFolds(draftKey: string): string[] {
  try {
    const folded: unknown = JSON.parse(localStorage.getItem(foldsKey(draftKey)) ?? '[]');
    return Array.isArray(folded) ? folded.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

export function saveFolds(draftKey: string, folded: readonly string[]): void {
  try {
    if (folded.length === 0) localStorage.removeItem(foldsKey(draftKey));
    else localStorage.setItem(foldsKey(draftKey), JSON.stringify(folded));
  } catch {
    // A browser that refuses storage opens every row next time.
  }
}
