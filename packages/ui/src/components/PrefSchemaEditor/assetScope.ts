import { ONE } from './oneAsset';

// What a lone schema stores is older than assets, so the asset it is edited as goes unnamed: its selected rows are
// bare paths in an undo step, and its folds sit under the draft's key alone.

const named = (assetId: string): boolean => assetId !== ONE;

/** `path` in the asset `assetId`, as an undo step keeps a selected row. */
export const scopedPath = (assetId: string, path: string): string => (named(assetId) ? `${assetId}:${path}` : path);

/** The paths among `scoped` that are in the asset `assetId`. No key holds a `:`, so the last one ends an asset's id. */
export function pathsIn(assetId: string, scoped: readonly string[]): string[] {
  return scoped.flatMap((id) => {
    const cut = id.lastIndexOf(':');
    return (cut === -1 ? ONE : id.slice(0, cut)) === assetId ? [id.slice(cut + 1)] : [];
  });
}

/** `key` for the asset `assetId`: what the editor stores of one asset's view beside the draft. */
export const scopedKey = (key: string, assetId: string): string => (named(assetId) ? `${key}:${assetId}` : key);
