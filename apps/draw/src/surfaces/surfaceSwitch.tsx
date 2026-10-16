import { useMemo } from 'react';
import { useMenus, type MenuDef } from '@weasel-js/core';
import type { PrefAction, PrefGroup } from '@weasel-js/prefs';
import { MenuButton } from '@weasel-js/ui';
import { usePref } from '../prefs';
import { SURFACE_ASSETS } from './assets';
import { surfaceOf, useSetSurface } from './surfaceState';
import { isSchemaAsset, type SchemaAsset, type SurfaceKind } from './types';

const SHOW_AS: Record<SurfaceKind, string> = {
  bar: 'Show as toolbar',
  panel: 'Show as panel',
  menu: 'Show as menu',
};

const NAME: Record<SurfaceKind, string> = { bar: 'Toolbar', panel: 'Panel', menu: 'Menu' };

/** The surfaces `asset` can move to from `current`, each with what offers it. */
export function switchChoices(asset: SchemaAsset, current: SurfaceKind): { surface: SurfaceKind; label: string }[] {
  return asset.surfaces.filter((s) => s !== current).map((surface) => ({ surface, label: SHOW_AS[surface] }));
}

/** The switch as a schema of action leaves, one per surface `asset` can move to: what a menu draws. */
export function switchSchema(
  asset: SchemaAsset,
  current: SurfaceKind,
  setSurface: (id: string, surface: SurfaceKind) => void,
): PrefGroup {
  const children: Record<string, PrefAction> = {};
  for (const { surface, label } of switchChoices(asset, current)) {
    children[surface] = { kind: 'action', name: label, description: '', default: undefined, run: () => setSurface(asset.id, surface) };
  }
  return { name: '', children };
}

/** The id of the context menu that switches `id`'s surface. */
export const switchMenuId = (id: string): string => `draw.surface.${id}`;

/** Declare every schema asset's switch menu, opened from a context menu on its bar or menu button. */
export function useSwitchMenus(): void {
  const [value] = usePref('ui.surfaces');
  const setSurface = useSetSurface();
  const defs = useMemo(
    (): MenuDef[] => SURFACE_ASSETS.filter(isSchemaAsset).map((asset) => ({
      id: switchMenuId(asset.id),
      schema: switchSchema(asset, surfaceOf(asset, value[asset.id]), setSurface),
    })),
    [value, setSurface],
  );
  useMenus(defs);
}

/** A panel header's switch: the surface it is on, opening the others. */
export function SurfaceSwitchButton({ asset, current }: { asset: SchemaAsset; current: SurfaceKind }) {
  const setSurface = useSetSurface();
  const choices = switchChoices(asset, current);
  if (choices.length === 0) return null;
  return (
    <MenuButton<SurfaceKind>
      bare
      current
      label={NAME[current]}
      aria-label={`Show ${asset.label} as`}
      items={choices.map(({ surface, label }) => ({ value: surface, label }))}
      onAction={(surface) => setSurface(asset.id, surface)}
    />
  );
}
