import type { ReactNode } from 'react';
import { ToolbarDock, type DockBar, type DockSpec } from '@weasel-js/ui/components/ToolbarDock';
import { usePref } from '../prefs';
import { SchemaBar, SchemaMenu } from './SchemaSurfaces';
import { SwitchMenus } from './surfaceSwitch';
import { useSurfaces } from './surfaceState';
import { isSchemaAsset } from './types';

const STRIP_DOCKS: readonly DockSpec[] = [{ id: 'strip', edge: 'top' }];

const SWITCH_MENUS: DockBar = { id: 'switch-menus', label: 'Switch menus', docks: ['strip'], render: () => <SwitchMenus /> };

/**
 * The strip's toolbars: every asset that can be a bar or a menu, each drawn as one, plus the switch menus. An asset
 * hidden or shown as a panel draws nothing but stays offered, so it keeps its place for when it comes back.
 */
export function useStripBars(): DockBar[] {
  const bars: DockBar[] = [SWITCH_MENUS];
  for (const { asset, surface, chrome, order, onReorder } of useSurfaces()) {
    if (!isSchemaAsset(asset) || !asset.surfaces.some((s) => s === 'bar' || s === 'menu')) continue;
    bars.push({
      id: asset.id,
      label: asset.label,
      docks: ['strip'],
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

/** The strip's toolbars in a dock row along the top of `children`, laid out as `ui.toolbars` holds. */
export function StripDock({ className, children }: { className?: string; children?: ReactNode }) {
  const [layout, setLayout] = usePref('ui.toolbars');
  return (
    <ToolbarDock docks={STRIP_DOCKS} bars={useStripBars()} layout={layout} onLayoutChange={setLayout} movable className={className}>
      {children}
    </ToolbarDock>
  );
}
