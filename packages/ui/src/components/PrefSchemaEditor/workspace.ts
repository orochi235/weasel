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

/** Whether two workspaces hold the same roots under the same ids, which is all a draft keeps of one. */
export function sameRoots(a: Workspace, b: Workspace): boolean {
  return a === b || (a.assets.length === b.assets.length && a.assets.every((asset, i) => asset.id === b.assets[i]!.id && asset.root === b.assets[i]!.root));
}
