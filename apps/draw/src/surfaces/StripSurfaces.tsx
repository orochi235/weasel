import { useMemo, type ReactNode } from 'react';
import { ToolbarDock, type DockBar, type DockSpec } from '@weasel-js/ui/components/ToolbarDock';
import { usePref } from '../prefs';
import { SchemaBar, SchemaMenu } from './SchemaSurfaces';
import { SwitchMenus } from './surfaceSwitch';
import { useSurfaces, type SurfaceBinding } from './surfaceState';
import { isSchemaAsset } from './types';

const STRIP_DOCKS: readonly DockSpec[] = [{ id: 'strip', edge: 'top', className: 'wd-dock-strip' }];

/**
 * The strip's toolbars: every asset that can be a bar or a menu, each drawn as one. Each may
 * float over the workspace. An asset hidden or shown as a panel draws nothing but stays offered, so it keeps its place
 * for when it comes back.
 */
export function useStripBars(): DockBar[] {
  const bindings = useSurfaces();
  return useMemo(() => stripBars(bindings), [bindings]);
}

function stripBars(bindings: readonly SurfaceBinding[]): DockBar[] {
  const bars: DockBar[] = [];
  for (const { asset, surface, chrome, order, onReorder } of bindings) {
    if (!isSchemaAsset(asset) || !asset.surfaces.some((s) => s === 'bar' || s === 'menu')) continue;
    bars.push({
      id: asset.id,
      label: asset.label,
      docks: ['strip'],
      float: true,
      render: () => {
        if (chrome.hidden) return null;
        if (surface === 'bar') return <SchemaBar asset={asset} order={order} onReorder={onReorder} />;
        if (surface === 'menu') return <SchemaMenu asset={asset} order={order} />;
        return null;
      },
    });
  }
  return bars;
}

/**
 * The strip's toolbars in a dock row along the top of `children`, laid out as `ui.toolbars` holds, and the switch
 * actions and menus their context menus open.
 */
export function StripDock({ className, children }: { className?: string; children?: ReactNode }) {
  const [layout, setLayout] = usePref('ui.toolbars');
  return (
    <>
      <SwitchMenus />
      <ToolbarDock docks={STRIP_DOCKS} bars={useStripBars()} layout={layout} onLayoutChange={setLayout} movable className={className}>
        {children}
      </ToolbarDock>
    </>
  );
}
