import type { NodeOrigins } from './nodeOrigins';
import { diffSchemas, type SchemaChange } from './schemaExport';
import { assetOf, shownAssets, type AssetSet } from './assetSet';

/** One asset's differences from its baseline. */
export interface AssetChanges {
  id: string;
  changes: SchemaChange[];
}

/** What changed from `base` to `assetSet`, asset by asset in the asset set's order, leaving out those that did not.
 *  A node `origins` followed from the baseline is paired with where it sat there. */
export function assetSetChanges(base: AssetSet, assetSet: AssetSet, origins?: NodeOrigins): AssetChanges[] {
  return assetSet.assets.flatMap((asset) => {
    const was = assetOf(base, asset.id);
    const changes = was && was.root !== asset.root ? diffSchemas(was.root, asset.root, origins?.of(asset.id)) : [];
    return changes.length === 0 ? [] : [{ id: asset.id, changes }];
  });
}

/** The asset to show after a step from `before` to `after`: the dialog where one changed, since its layouts only followed. None where only the catalog of actions did, which is in view whatever is shown. */
export function changedAsset(before: AssetSet, after: AssetSet): string | undefined {
  const changed = shownAssets(after).filter((asset) => assetOf(before, asset.id)?.root !== asset.root);
  return (changed.find((a) => a.kind === 'schema') ?? changed[0])?.id;
}
