import type { SchemaRoot } from './schemaEdit';

/** One thing the editor edits: a dialog's schema, or a layout of pointers into one. */
export interface Asset {
  id: string;
  label: string;
  kind: 'schema' | 'layout';
  root: SchemaRoot;
  /** A layout's: the id of the `schema` asset its pointers name settings in. */
  over?: string;
  /** Shown and previewed, and refusing every edit. */
  readOnly?: boolean;
}

export interface Workspace {
  readonly assets: readonly Asset[];
}

export function assetOf(workspace: Workspace, id: string): Asset | undefined {
  return workspace.assets.find((a) => a.id === id);
}

/** The schema a layout's pointers name settings in; `undefined` for a dialog, or a layout over nothing held. */
export function overOf(workspace: Workspace, layout: Asset): SchemaRoot | undefined {
  const over = layout.over === undefined ? undefined : assetOf(workspace, layout.over);
  return over?.kind === 'schema' ? over.root : undefined;
}
