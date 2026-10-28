import { useMemo, type ReactNode } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { BundlePreview } from './BundlePreview';
import { BUNDLE_KINDS, BUNDLE_LINKS, bundleParts, isAtomLeaf, memberKey, memberOf, membership } from './bundleTree';
import type { CustomKinds } from './kindSchemas';
import { GROUP_ICON, type PaletteItem } from './Palette';
import type { PartsCatalog } from './PartsList';
import { nodeAt, type LinkRule, type SchemaNode } from './schemaEdit';
import type { ShownAsset } from './workspace';

const group = (name: string, as?: PrefGroup['as']): PrefGroup => ({ name, description: '', ...(as ? { as } : {}), children: {} });

/** What a bundle tree's palette makes: a package's section, and a bundle to put in one. */
const BUNDLE_PALETTE: readonly PaletteItem[] = [
  { id: 'package', label: 'Package', icon: GROUP_ICON.section, key: 'package', make: () => group('@weasel-js/package', 'section') },
  { id: 'bundle', label: 'Bundle', icon: GROUP_ICON.fragment, key: 'bundle', make: () => group('New bundle') },
];

/** What the editor does differently while it shows a Bundles asset. */
export interface BundleView {
  /** The host's kinds, and the bundle tree's. */
  kinds: CustomKinds;
  structure: { pageless: true; palette: readonly PaletteItem[]; links: LinkRule; parts: PartsCatalog };
  /** Whether every node at `paths` is an atom, which takes no edit. */
  locked(paths: readonly string[]): boolean;
  /** What the preview shows: what a canvas loading the bundle around `lead` gets. */
  preview(lead: string | null): ReactNode;
}

/** The view of `asset` where it is a Bundles asset, `null` for any other. */
export function useBundleView(asset: ShownAsset, kinds: CustomKinds): BundleView | null {
  const presets = asset.kind === 'bundles' ? asset.presets : undefined;
  const root = asset.root;
  const partsRoot = useMemo(() => (presets ? bundleParts(presets) : undefined), [presets]);
  const held = useMemo(() => (presets ? membership(root) : undefined), [presets, root]);
  const merged = useMemo(() => ({ ...kinds, ...BUNDLE_KINDS }), [kinds]);
  return useMemo(() => {
    if (!partsRoot || !held) return null;
    const where = (leaf: SchemaNode): readonly string[] => {
      const member = memberOf(root, leaf);
      return member ? held.get(memberKey(member)) ?? [] : [];
    };
    return {
      kinds: merged,
      structure: { pageless: true, palette: BUNDLE_PALETTE, links: BUNDLE_LINKS, parts: { root: partsRoot, where } },
      locked: (paths) => paths.length > 0 && paths.every((p) => isAtomLeaf(nodeAt(root, p))),
      preview: (lead) => <BundlePreview root={root} lead={lead} />,
    };
  }, [partsRoot, held, merged, root]);
}
