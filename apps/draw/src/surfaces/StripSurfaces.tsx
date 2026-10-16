import { SchemaBar, SchemaMenu } from './SchemaSurfaces';
import { SwitchMenus } from './surfaceSwitch';
import { useSurfaces } from './surfaceState';
import { isSchemaAsset } from './types';

/** The command strip's surface assets: each one on a bar or a menu, in list order. */
export function StripSurfaces() {
  return (
    <>
      <SwitchMenus />
      {useSurfaces().map(({ asset, surface, chrome }) => {
        if (!isSchemaAsset(asset) || chrome.hidden) return null;
        if (surface === 'bar') return <SchemaBar key={asset.id} asset={asset} />;
        if (surface === 'menu') return <SchemaMenu key={asset.id} asset={asset} />;
        return null;
      })}
    </>
  );
}
