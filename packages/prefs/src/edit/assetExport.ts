import { bundlesDocument } from './bundleExport';
import { printSchema, type OriginOf } from './schemaExport';
import type { PrefTypes } from './types';
import { assetOf, type Asset, type Workspace } from './workspace';

/** What an asset exports: a TypeScript literal of its root, or for a Bundles asset its `weasel-bundles/1` JSON. */
export interface AssetExport {
  text: string;
  language: 'tsx' | 'json';
}

/** What `asset` exports, measured from its baseline in `base`, whose nodes `originOf` follows. */
export function exportOf(asset: Asset, base: Workspace, originOf?: OriginOf, types?: PrefTypes): AssetExport {
  if (asset.kind !== 'bundles') return { text: printSchema(asset.root, types), language: 'tsx' };
  const was = assetOf(base, asset.id);
  const from = was?.kind === 'bundles' ? was : asset;
  return { text: JSON.stringify(bundlesDocument(from.presets, from.root, asset.root, originOf), null, 2), language: 'json' };
}
