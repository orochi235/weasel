/** The edits the asset editor makes to the asset it shows, and how each one leaves the selection and the open rows. */
import type { Dispatch, SetStateAction } from 'react';
import {
  aliasNodes, assetOf, type AssetSet, copyNodes, editAsset, joinPath, type LinkRule, moveInAsset, NO_MOVES,
  parentPath, rebasePaths, removeInAsset, renameInAsset, type SchemaRoot, type SchemaTarget,
} from '@weasel-js/prefs/edit';
import { setDefaults, type DefaultEdit } from './defaults';
import { heirAfter } from './heirAfter';
import type { EditorSelection } from './useEditorSelection';

/** What an edit reads as it runs: the asset set, the shown asset's root, and the paths selected in it. */
export interface AssetEditTarget {
  assetSet: AssetSet;
  schema: SchemaRoot;
  paths: readonly string[];
}

/** Where an edit's result is shown: the rows it selects and the branches it opens. */
export interface EditFollow {
  selection: Pick<EditorSelection, 'set' | 'rebase'>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  /** Whether a drop leaves the selection where it was. */
  keepsSelection(): boolean;
  select(paths: readonly string[]): void;
  /** Select `paths`, opening the branches above them. */
  reveal(paths: readonly string[]): void;
}

/** The coalesce key of an edit to the attributes of the nodes at `paths`. */
export const attrKeyOf = (paths: readonly string[]): string => `attr:${[...paths].sort().join(',')}`;

/**
 * The edits to asset `assetId`, each written as one step with `write`. `expanded` is the rows open now, and `links`
 * what an alias drop sets down.
 */
export function createAssetEdits(
  assetId: string,
  current: () => AssetEditTarget,
  write: (next: AssetSet, coalesceKey?: string) => void,
  links: LinkRule,
  expanded: ReadonlySet<string>,
  follow: EditFollow,
) {
  const { selection, setExpanded, keepsSelection, select, reveal } = follow;
  // A key names its asset, so the same path edited in two of them close together is two steps.
  const coalesce = (key?: string) => (key === undefined ? undefined : `${assetId}:${key}`);
  /** Whether there was anything to commit: an asset that takes no edit gives the asset set back. */
  const commit = (next: SchemaRoot, coalesceKey?: string): boolean => {
    const ws = current().assetSet;
    const edited = editAsset(ws, assetId, next, NO_MOVES);
    if (edited === ws) return false;
    write(edited, coalesce(coalesceKey));
    return true;
  };
  // `restore` is the selection to go back to where the drop keeps it: a drag begun in the preview selected its row on the press.
  const moveTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    const ws = current().assetSet;
    const moved = moveInAsset(ws, assetId, paths, target);
    // Dropped where it already was: nothing to step back from.
    if (moved.assetSet === ws) return;
    write(moved.assetSet);
    const moves = moved.from.map((f, i) => [f, moved.paths[i]!] as const);
    setExpanded((e) => rebasePaths(e, moves));
    // A selection left where it was still has to follow its nodes to their new paths.
    if (keepsSelection()) {
      if (restore !== undefined) selection.set(restore);
      selection.rebase(moves);
    }
    else reveal(moved.paths);
  };
  const copyTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    const copied = copyNodes(current().schema, paths, target);
    if (!commit(copied.root)) return;
    if (keepsSelection() && restore !== undefined) selection.set(restore);
    reveal(copied.paths);
  };
  const aliasTo = (paths: readonly string[], target: SchemaTarget, restore?: readonly string[]) => {
    // `aliasNodes` reads tree paths as setting paths, which a layout's are not.
    if (assetOf(current().assetSet, assetId)?.kind === 'layout') { copyTo(paths, target, restore); return; }
    const made = aliasNodes(current().schema, paths, target, links);
    if (!commit(made.root)) return;
    if (keepsSelection() && restore !== undefined) selection.set(restore);
    reveal(made.paths);
  };
  // One value dragged through a control is one step back.
  const setDefaultsFrom = (edits: readonly DefaultEdit[]) =>
    commit(setDefaults(current().schema, edits), `default:${edits.map(([path]) => path.join('.')).join(',')}`);
  const remove = () => {
    const { paths, assetSet: ws, schema } = current();
    if (paths.length === 0) return;
    const heir = heirAfter(schema, expanded, paths);
    const next = removeInAsset(ws, assetId, paths);
    if (next === ws) return;
    write(next);
    select(heir === null ? [] : [heir]);
  };
  const rename = (path: string, key: string) => {
    const ws = current().assetSet;
    const next = renameInAsset(ws, assetId, path, key);
    if (next === ws) return;
    write(next, coalesce(attrKeyOf(current().paths)));
    const to = joinPath(parentPath(path), key);
    setExpanded((e) => rebasePaths(e, [[path, to]]));
    selection.rebase([[path, to]]);
  };
  return { commit, moveTo, copyTo, aliasTo, setDefaultsFrom, remove, rename };
}
