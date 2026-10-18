import { useMemo } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { dissolve, filed, NO_CATALOG } from './actionCatalog';
import { pathsIn, scopedPath } from './assetScope';
import type { EditorAction } from './editorActions';
import { addNode, childrenOf, joinPath, keyOf, moveNodes, nodeAt, parentPath, uniqueKey, type SchemaRoot, type SchemaTarget } from './schemaEdit';
import { useEditorSelection } from './useEditorSelection';
import { catalogOf, type Workspace } from './workspace';
import { editAsset, NO_MOVES } from './workspaceEdit';

const unfolded = (): void => {};

/** The host's actions as the Actions pane lists them, and what the pane does to the list. */
export interface ActionCatalog {
  actions: readonly EditorAction[];
  /** The workspace's catalog with every action it does not hold yet filed into it, or one made of the actions
   *  alone where the workspace holds none. */
  root: PrefGroup;
  /** The workspace holds a catalog that takes edits. Without one the list is the registry's, and nothing sorts it. */
  editable: boolean;
  /** The rows selected, by tree path, the newest last. */
  selected: readonly string[];
  /** Take what the pane's tree reports as selected. */
  pick(ids: Iterable<string>): void;
  clear(): void;
  /** The rows selected as an undo step records them, beside the shown asset's: none where the catalog is no asset. */
  recorded(): string[];
  /** Select the rows a step of the history restores, of what {@link ActionCatalog.recorded} gave. */
  restore(recorded: readonly string[]): void;
  /** Set `next` in place of `root`, as one step back; steps that share a `coalesceKey` close together are one. */
  commit(next: SchemaRoot, coalesceKey?: string): void;
  move(paths: readonly string[], target: SchemaTarget): void;
  /** Add an empty group after the newest selected row, or at the end, and select it. */
  addGroup(): void;
  /** Take the selected rows out, as far as `dissolve` does. */
  remove(): void;
}

/**
 * The catalog of `actions` in `workspace`; `null` with no way to know which actions exist. `current` is the
 * workspace as of the event in hand, `write` commits an edited one, and `onPick` is told when a row is picked.
 */
export function useActionCatalog({ workspace, current, actions, write, onPick }: {
  workspace: Workspace;
  current(): Workspace;
  actions: readonly EditorAction[] | null;
  write(next: Workspace, coalesceKey?: string): void;
  onPick(): void;
}): ActionCatalog | null {
  const asset = catalogOf(workspace);
  const held = (asset?.root as PrefGroup | undefined) ?? NO_CATALOG;
  const root = useMemo(() => filed(held, actions ?? []), [held, actions]);
  const selection = useEditorSelection(root, unfolded);
  if (actions === null) return null;
  const editable = asset !== undefined && asset.readOnly !== true;
  const commit = (next: SchemaRoot, coalesceKey?: string): void => {
    if (!asset || next === root) return;
    const edited = editAsset(current(), asset.id, next, NO_MOVES);
    if (edited !== current()) write(edited, coalesceKey === undefined ? undefined : `${asset.id}:${coalesceKey}`);
  };
  return {
    actions,
    root,
    editable,
    selected: selection.paths,
    pick(ids) {
      selection.pick(ids);
      onPick();
    },
    clear: () => selection.set([]),
    recorded: () => (asset ? selection.paths.map((path) => scopedPath(asset.id, path)) : []),
    restore(recorded) {
      if (asset) selection.set(pathsIn(asset.id, recorded));
    },
    commit,
    move(paths, target) {
      const moved = moveNodes(root, paths, target);
      commit(moved.root);
      selection.rebase(moved.from.map((from, i) => [from, moved.paths[i]!] as const));
    },
    addGroup() {
      const lead = selection.lead !== null && nodeAt(root, selection.lead) ? selection.lead : null;
      const parent = lead === null ? null : parentPath(lead);
      const kids = childrenOf(nodeAt(root, parent) ?? root) ?? {};
      const key = uniqueKey(kids, 'group');
      commit(addNode(root, parent, key, { name: 'New group', description: '', children: {} }, lead === null ? undefined : Object.keys(kids).indexOf(keyOf(lead)) + 1));
      selection.set([joinPath(parent, key)]);
      onPick();
    },
    remove: () => commit(dissolve(root, selection.paths, new Set(actions.map((a) => a.key)))),
  };
}
