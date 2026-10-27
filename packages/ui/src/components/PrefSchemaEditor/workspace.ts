import { isPrefLeaf, isPrefSection } from '@weasel-js/prefs';
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
  /** The scene node kind whose properties it holds. The list files it under Node properties, not Dialogs. */
  nodeKind?: string;
}

/** A layout of pointers into a dialog. */
export interface LayoutAsset extends AssetBase {
  kind: 'layout';
  /** The id of the `schema` asset its pointers name settings in. */
  over: string;
}

/**
 * The host's actions as the Actions pane lists them: a group of `action` prefs, each firing one by key, in the
 * groups and the order the reader sorts them into. It is no dialog and no layout, so the asset list leaves it out,
 * and a workspace's first is the one its editor uses.
 */
export interface ActionsAsset extends AssetBase {
  kind: 'actions';
}

/** An asset the editor shows in its structure tree, picked from the asset list. */
export type ShownAsset = SchemaAsset | LayoutAsset;

/** One thing the editor edits: a dialog, a layout over one, or the catalog of the host's actions. */
export type Asset = ShownAsset | ActionsAsset;

/** What the asset list files an asset under. */
export type AssetHeading = 'Dialogs' | 'Node properties' | 'Panels' | 'Toolbars' | 'Menus';

/**
 * Where the list files `asset`: a dialog, or one holding a node kind's properties; a layout drawn as a menu, or as a bar of nothing but menus, which is a
 * menu bar; a layout drawn as any other bar; or any other layout.
 */
export function headingOf(asset: ShownAsset): AssetHeading {
  if (asset.kind === 'schema') return asset.nodeKind === undefined ? 'Dialogs' : 'Node properties';
  const root = asset.root;
  if (!('as' in root)) return 'Panels';
  if (root.as === 'menu') return 'Menus';
  if (root.as !== 'bar') return 'Panels';
  if (isPrefSection(root)) return 'Toolbars';
  const kids = Object.values(root.children);
  const menus = kids.length > 0 && kids.every((kid) => !isPrefLeaf(kid) && !isPrefSection(kid) && kid.as === 'menu');
  return menus ? 'Menus' : 'Toolbars';
}

/** An asset some other editor holds, listed beside this one's to be picked. The host shows it, in whatever holds it. */
export interface ListedAsset {
  id: string;
  label: string;
  under: AssetHeading;
  readOnly?: boolean;
  /** It differs from its baseline, which only whatever holds it can say: listed as a changed asset of this editor's is. */
  changed?: boolean;
}

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

export const isShown = (asset: Asset): asset is ShownAsset => asset.kind !== 'actions';

/** The assets the asset list offers, in the workspace's order. */
export function shownAssets(workspace: Workspace): ShownAsset[] {
  return workspace.assets.filter(isShown);
}

/** The catalog of the host's actions, where the workspace holds one. */
export function catalogOf(workspace: Workspace): ActionsAsset | undefined {
  return workspace.assets.find((a): a is ActionsAsset => a.kind === 'actions');
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
