import { diffSchemas, type SchemaChange } from './schemaExport';
import { assetOf, type Workspace } from './workspace';

/** One asset's differences from its baseline. */
export interface AssetChanges {
  id: string;
  changes: SchemaChange[];
}

/** What changed from `base` to `workspace`, asset by asset in the workspace's order, leaving out those that did not. */
export function workspaceChanges(base: Workspace, workspace: Workspace): AssetChanges[] {
  return workspace.assets.flatMap((asset) => {
    const was = assetOf(base, asset.id);
    const changes = was && was.root !== asset.root ? diffSchemas(was.root, asset.root) : [];
    return changes.length === 0 ? [] : [{ id: asset.id, changes }];
  });
}

/** The asset to show after a step from `before` to `after`: the dialog where one changed, since its layouts only followed. */
export function changedAsset(before: Workspace, after: Workspace): string | undefined {
  const changed = after.assets.filter((asset) => assetOf(before, asset.id)?.root !== asset.root);
  return (changed.find((a) => a.kind === 'schema') ?? changed[0])?.id;
}
