import { useMemo } from 'react';
import type { PrefGroup } from '@weasel-js/prefs';
import { Bar, BarMenu } from '@weasel-js/ui/components/Bar';
import { useContextMenu } from '@weasel-js/ui/components/ContextMenu';
import { resolveIcon } from '@weasel-js/ui/components/Icon';
import { PrefsForm } from '@weasel-js/ui/components/Prefs';
import { SidebarPanel } from '@weasel-js/ui/components/SidebarPanel';
import { switchMenuId, switchSchema, SurfaceSwitchButton } from './surfaceSwitch';
import type { PanelChrome, SchemaAsset, SchemaBinding } from './types';
import s from './SchemaSurfaces.module.css';

const ignore = (): void => {};

const UNBOUND: SchemaBinding = {};
const useUnbound = (): SchemaBinding => UNBOUND;

/** What `asset`'s leaves are bound to, from its own binding hook. Each surface asks, so moving an asset between
 *  surfaces keeps what it shows. */
function useAssetBinding(asset: SchemaAsset): SchemaBinding {
  const useBinding = asset.useBinding ?? useUnbound;
  return useBinding();
}

/** Where the menu surface puts its switch among the asset's own children: a key no asset uses. */
const SWITCH_KEY = '$surface';

/** Dotted-path values as the nested tree a form reads. */
function nest(values: Readonly<Record<string, unknown>> | undefined): Record<string, unknown> {
  const root: Record<string, unknown> = {};
  for (const [path, value] of Object.entries(values ?? {})) {
    const keys = path.split('.');
    let at = root;
    for (const key of keys.slice(0, -1)) at = (at[key] ??= {}) as Record<string, unknown>;
    at[keys.at(-1)!] = value;
  }
  return root;
}

/** A schema asset drawn as a right-sidebar panel, its header offering the other surfaces. */
export function SchemaPanel({ asset, chrome }: { asset: SchemaAsset; chrome: PanelChrome }) {
  const { values, onChange } = useAssetBinding(asset);
  const tree = useMemo(() => nest(values), [values]);
  return (
    <SidebarPanel
      title={asset.label}
      collapsed={chrome.collapsed}
      onToggleCollapse={chrome.onToggleCollapse}
      onHide={chrome.onHide}
      actions={<SurfaceSwitchButton asset={asset} current="panel" />}
    >
      <PrefsForm schema={asset.schema} layout="list" values={tree} onChange={onChange ?? ignore} />
    </SidebarPanel>
  );
}

/** A schema asset drawn as a labeled bar in the command strip; its context menu offers the other surfaces. */
export function SchemaBar({ asset }: { asset: SchemaAsset }) {
  const { values, onChange } = useAssetBinding(asset);
  const openSwitch = useContextMenu(switchMenuId(asset.id));
  return (
    <div className={s.slot} onContextMenu={openSwitch}>
      <Bar schema={asset.schema} label={asset.label} values={values} onChange={onChange} framed="segmented" />
    </div>
  );
}

/** A schema asset drawn as a menu button in the command strip, the other surfaces offered at the menu's end and
 *  from the button's context menu. */
export function SchemaMenu({ asset }: { asset: SchemaAsset }) {
  const { values, onChange } = useAssetBinding(asset);
  const openSwitch = useContextMenu(switchMenuId(asset.id));
  const schema = useMemo(
    (): PrefGroup => ({
      ...asset.schema,
      children: { ...asset.schema.children, [SWITCH_KEY]: switchSchema(asset, 'menu') },
    }),
    [asset],
  );
  return (
    <div className={s.slot} onContextMenu={openSwitch}>
      <BarMenu label={asset.label} icon={resolveIcon(asset.schema.icon)} schema={schema} values={(path) => values?.[path]} {...(onChange ? { onChange } : {})} />
    </div>
  );
}
