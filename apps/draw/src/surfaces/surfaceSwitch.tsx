import { useMemo } from 'react';
import { useAction, useMenus, type Action, type MenuDef } from '@weasel-js/core';
import { pref, type PrefAction, type PrefGroup } from '@weasel-js/prefs';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { usePref } from '../prefs';
import { SURFACE_ASSETS } from './assets';
import { surfaceOf, useSetSurface } from './surfaceState';
import type { SurfaceAsset, SurfaceKind } from './types';

const SHOW_AS: Record<SurfaceKind, string> = {
  bar: 'Show as toolbar',
  panel: 'Show as panel',
  menu: 'Show as menu',
};

const NAME: Record<SurfaceKind, string> = { bar: 'Toolbar', panel: 'Panel', menu: 'Menu' };

/** The surfaces `asset` can move to from `current`, each with what offers it. */
export function switchChoices(asset: SurfaceAsset, current: SurfaceKind): { surface: SurfaceKind; label: string }[] {
  return asset.surfaces.filter((s) => s !== current).map((surface) => ({ surface, label: SHOW_AS[surface] }));
}

/** The id of the action that moves `id` to another surface: one variant per surface it allows. */
export const switchActionId = (id: string): string => `draw.surface.${id}`;

/** The action that moves `asset` between its surfaces, a variant per surface. */
function switchAction(asset: SurfaceAsset, setSurface: (id: string, surface: SurfaceKind) => void): Action {
  return {
    id: switchActionId(asset.id),
    label: asset.label,
    variants: asset.surfaces.map((surface) => ({ key: surface, label: SHOW_AS[surface], params: { surface } })),
    invoker: {
      timing: 'immediate',
      run: (_deps, params) => {
        const surface = params?.surface as SurfaceKind | undefined;
        if (surface) setSurface(asset.id, surface);
      },
    },
  };
}

/** The switch as a schema of action leaves, one per surface `asset` can move to: what a menu draws. */
export function switchSchema(asset: SurfaceAsset, current: SurfaceKind): PrefGroup {
  const children: Record<string, PrefAction> = {};
  for (const { surface } of switchChoices(asset, current)) {
    children[surface] = pref.action(`${switchActionId(asset.id)}:${surface}`);
  }
  return { name: '', children };
}

/** The id of the context menu that switches `id`'s surface. */
export const switchMenuId = (id: string): string => `draw.surfaceMenu.${id}`;

function SwitchAction({ action }: { action: Action }) {
  useAction(action);
  return null;
}

/** The assets that can move: those allowing more than one surface. */
const SWITCHABLE = SURFACE_ASSETS.filter((a) => a.surfaces.length > 1);

/** Register every movable asset's switch action, and declare its switch menu, opened from a
 *  context menu on its bar or menu button. */
export function SwitchMenus() {
  const [value] = usePref('ui.surfaces');
  const setSurface = useSetSurface();
  const actions = useMemo(() => SWITCHABLE.map((asset) => switchAction(asset, setSurface)), [setSurface]);
  const defs = useMemo(
    (): MenuDef[] => SWITCHABLE.map((asset) => ({
      id: switchMenuId(asset.id),
      menu: switchSchema(asset, surfaceOf(asset, value[asset.id])),
    })),
    [value],
  );
  useMenus(defs);
  return <>{actions.map((a) => <SwitchAction key={a.id} action={a} />)}</>;
}

/** A panel header's switch: the surface it is on, opening the others. */
export function SurfaceSwitchButton({ asset, current }: { asset: SurfaceAsset; current: SurfaceKind }) {
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
