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

/** One thing the editor edits. */
export type Asset = SchemaAsset | LayoutAsset;

export interface Workspace {
  readonly assets: readonly Asset[];
}

export function assetOf(workspace: Workspace, id: string): Asset | undefined {
  return workspace.assets.find((a) => a.id === id);
}
