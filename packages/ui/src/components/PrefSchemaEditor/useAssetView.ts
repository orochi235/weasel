import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { pathsIn, scopedPath } from './assetScope';
import { foldsUnder, openAfterStep } from './folds';
import { branchPaths, type SchemaRoot } from './schemaEdit';
import { useEditorSelection, type EditorSelection } from './useEditorSelection';
import { assetOf, isShown, shownAssets, type ShownAsset, type Workspace } from './workspace';
import { changedAsset } from './workspaceChanges';

const NONE: readonly string[] = [];

/** Which of a workspace's assets the editor shows, and the reader's view of it: the rows selected and the rows open. */
export interface AssetView {
  asset: ShownAsset;
  expanded: ReadonlySet<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  selection: EditorSelection;
  /** Show the asset `id`, with nothing selected. */
  show(id: string): void;
  /** The selection as an undo step records it: `paths` of the asset shown, and what was selected in each other
   *  asset when it was last shown, so a step can restore the selection of whichever asset it changes. */
  recorded(paths: readonly string[]): string[];
  /** Take the selection a step of the history restores, for {@link AssetView.stepped} to apply. */
  restore(recorded: readonly string[]): void;
  /** After a step of the history from `before` to `after`: show the asset it changed, with the rows it restored. */
  stepped(before: Workspace, after: Workspace): void;
}

/**
 * The view of `workspace`, starting on the asset `startOn` names, or on its first. `opened` is the draft the editor mounts on, when it found
 * one, and `draftKey` the name each asset's folded rows are kept beside; with none they are kept while the editor is up.
 */
export function useAssetView(workspace: Workspace, opened: Workspace | undefined, draftKey: string | undefined, startOn?: string): AssetView {
  const shown = (id: string): ShownAsset | undefined => {
    const found = assetOf(workspace, id);
    return found && isShown(found) ? found : undefined;
  };
  const [assetId, setAssetId] = useState((startOn !== undefined && shown(startOn)?.id) || shownAssets(workspace)[0]!.id);
  const asset = shown(assetId) ?? shownAssets(workspace)[0]!;
  const schema = asset.root;
  // Every row starts open but the ones the reader folded last time.
  const folds = useMemo(() => foldsUnder(draftKey), [draftKey]);
  const startOpen = (id: string, root: SchemaRoot): Set<string> => {
    const folded = new Set(folds.open(id));
    return new Set(branchPaths(root).filter((path) => !folded.has(path)));
  };
  const [expanded, setExpanded] = useState(() => startOpen(asset.id, (opened && assetOf(opened, asset.id)?.root) ?? schema));
  useEffect(() => {
    folds.save(asset.id, branchPaths(schema).filter((id) => !expanded.has(id)));
  }, [folds, asset.id, schema, expanded]);
  // The rows open under each schema shown, for a step back to one to open what it brings back.
  const openAt = useRef(new WeakMap<SchemaRoot, ReadonlySet<string>>());
  useEffect(() => { openAt.current.set(schema, expanded); }, [schema, expanded]);
  const selection = useEditorSelection(schema, setExpanded);
  const restored = useRef<readonly string[] | null>(null);
  const selectedIn = useRef(new Map<string, readonly string[]>());
  const showing = (to: ShownAsset, paths: readonly string[]) => {
    selectedIn.current.set(asset.id, selection.paths);
    setAssetId(to.id);
    setExpanded(startOpen(to.id, to.root));
    selection.set(paths);
  };
  return {
    asset,
    expanded,
    setExpanded,
    selection,
    show(id) {
      const to = shown(id);
      if (to && to.id !== asset.id) showing(to, NONE);
    },
    recorded: (paths) => [...new Map(selectedIn.current).set(asset.id, paths)]
      .flatMap(([id, held]) => held.map((path) => scopedPath(id, path))),
    restore(recorded) { restored.current = recorded; },
    stepped(before, after) {
      const kept = restored.current;
      restored.current = null;
      const changed = assetOf(after, changedAsset(before, after) ?? asset.id);
      const to = changed && isShown(changed) ? changed : asset;
      // A step keeps every asset's selection from when it was made or left; the one it lands on takes its own.
      const paths = kept ? pathsIn(to.id, kept) : NONE;
      if (to.id !== asset.id) {
        showing(to, paths);
        return;
      }
      const was = assetOf(before, to.id)?.root ?? to.root;
      setExpanded((open) => openAfterStep(open, was, openAt.current.get(to.root)));
      if (kept) selection.set(paths);
    },
  };
}
