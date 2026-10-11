import { useEffect, useMemo, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { pathsIn, scopedPath } from './assetScope';
import { foldsUnder, openAfterStep } from './folds';
import { branchPaths, type SchemaRoot } from './schemaEdit';
import { useEditorSelection, type EditorSelection } from './useEditorSelection';
import { assetOf, type Asset, type Workspace } from './workspace';
import { changedAsset } from './workspaceChanges';

const NONE: readonly string[] = [];

/** Which of a workspace's assets the editor shows, and the reader's view of it: the rows selected and the rows open. */
export interface AssetView {
  asset: Asset;
  expanded: ReadonlySet<string>;
  setExpanded: Dispatch<SetStateAction<Set<string>>>;
  selection: EditorSelection;
  /** Show the asset `id`, with nothing selected. */
  show(id: string): void;
  /** `paths` of the asset shown, as an undo step records the selection. */
  recorded(paths: readonly string[]): string[];
  /** Take the selection a step of the history restores, for {@link AssetView.stepped} to apply. */
  restore(recorded: readonly string[]): void;
  /** After a step of the history from `before` to `after`: show the asset it changed, with the rows it restored. */
  stepped(before: Workspace, after: Workspace): void;
}

/**
 * The view of `workspace`, starting on its first asset. `opened` is the draft the editor mounts on, when it found
 * one, and `draftKey` the name each asset's folded rows are kept beside; with none they are kept while the editor is up.
 */
export function useAssetView(workspace: Workspace, opened: Workspace | undefined, draftKey: string | undefined): AssetView {
  const [assetId, setAssetId] = useState(workspace.assets[0]!.id);
  const asset = assetOf(workspace, assetId) ?? workspace.assets[0]!;
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
  const showing = (to: Asset, paths: readonly string[]) => {
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
      const to = assetOf(workspace, id);
      if (to && to.id !== asset.id) showing(to, NONE);
    },
    recorded: (paths) => paths.map((path) => scopedPath(asset.id, path)),
    restore(recorded) { restored.current = recorded; },
    stepped(before, after) {
      const kept = restored.current;
      restored.current = null;
      const to = assetOf(after, changedAsset(before, after) ?? asset.id) ?? asset;
      // A step keeps the rows selected in whichever asset was shown when it was made or left, which need not be this one.
      const paths = kept ? pathsIn(to.id, kept) : NONE;
      if (to.id !== asset.id) {
        showing(to, paths);
        return;
      }
      const was = assetOf(before, to.id)?.root ?? to.root;
      setExpanded((open) => openAfterStep(open, was, openAt.current.get(to.root)));
      // Nothing kept is the root selected, in any asset.
      if (kept && (paths.length > 0 || kept.length === 0)) selection.set(paths);
    },
  };
}
