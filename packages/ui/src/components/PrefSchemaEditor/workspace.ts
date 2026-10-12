import type { SchemaRoot } from './schemaEdit';

interface AssetBase {
  id: string;
  label: string;
  root: SchemaRoot;
  /** Shown and previewed, and refusing every edit. */
  readOnly?: boolean;
}

/** A dialog's schema. */
export interface SchemaAsset extends AssetBase {
  kind: 'schema';
}

/** A layout of pointers into a dialog. */
export interface LayoutAsset extends AssetBase {
  kind: 'layout';
  /** The id of the `schema` asset its pointers name settings in. */
  over: string;
}

/** One thing the editor edits: a dialog, or a layout over one. */
export type Asset = SchemaAsset | LayoutAsset;

/** Everything one editor holds: its dialogs, and the layouts that point into them. The set is the host's, and fixed. */
export interface Workspace {
  readonly assets: readonly Asset[];
}

const NO_DIALOG: SchemaRoot = { name: '', children: {} };

/**
 * The root a layout's pointers name settings in, which holds none where the workspace has no such dialog.
 * `undefined` for a dialog, whose aliases are of its own settings.
 */
export function overOf(workspace: Workspace, asset: Asset): SchemaRoot | undefined {
  return asset.kind === 'layout' ? assetOf(workspace, asset.over)?.root ?? NO_DIALOG : undefined;
}

export function assetOf(workspace: Workspace, id: string): Asset | undefined {
  return workspace.assets.find((a) => a.id === id);
}

/**
 * `current` with the roots `stepped` holds, by id: an undo step keeps the workspace as it was when the step was made,
 * and what a host has said of an asset since (its label, its lock) is not the step's to take back. An asset
 * `stepped` lacks keeps its root. `stepped` itself where it already says of every asset what `current` does.
 */
export function withRoots(current: Workspace, stepped: Workspace): Workspace {
  const said = (a: Asset, b: Asset): boolean => a.label === b.label && a.kind === b.kind && a.readOnly === b.readOnly && (a as LayoutAsset).over === (b as LayoutAsset).over;
  const assets = current.assets.map((asset) => {
    const was = assetOf(stepped, asset.id);
    if (!was || was.root === asset.root) return asset;
    return said(was, asset) ? was : { ...asset, root: was.root };
  });
  return assets.length === stepped.assets.length && assets.every((asset, i) => asset === stepped.assets[i]) ? stepped : { assets };
}

/** Whether two workspaces hold the same roots under the same ids, which is all a draft keeps of one. */
export function sameRoots(a: Workspace, b: Workspace): boolean {
  return a === b || (a.assets.length === b.assets.length && a.assets.every((asset, i) => asset.id === b.assets[i]!.id && asset.root === b.assets[i]!.root));
}
