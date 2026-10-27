import { Bar } from '@weasel-js/ui/components/Bar';
import { useContextMenu } from '@weasel-js/ui/components/ContextMenu';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import { SchemaMenu } from './SchemaSurfaces';
import { switchMenuId } from './surfaceSwitch';
import { useSurfaces } from './surfaceState';
import type { SurfaceAsset } from './types';
import s from './SchemaSurfaces.module.css';

/** How a command-row asset's bar is drawn in its slot. */
export interface CommandBarLook {
  /** What names the bar to assistive tech. */
  label?: string;
  /** Draw the bar as one framed strip of segments. */
  segmented?: boolean;
  /** Set the bar off in a group of its own, ruled from its neighbors. */
  group?: boolean;
}

/**
 * A command-row asset in its slot: as a bar, drawn unlabeled like the row's other buttons; as a menu, its menu
 * button. Hidden or shown as a panel, nothing. Its context menu offers the other surfaces.
 */
export function CommandSlot({ id, ...look }: CommandBarLook & { id: string }) {
  const binding = useSurfaces().find((b) => b.asset.id === id);
  if (!binding || binding.chrome.hidden) return null;
  const { asset, surface, order } = binding;
  if (surface === 'menu') return <SchemaMenu asset={asset} order={order} />;
  if (surface !== 'bar') return null;
  return <CommandBarSurface asset={asset} look={look} />;
}

function CommandBarSurface({ asset, look }: { asset: SurfaceAsset; look: CommandBarLook }) {
  const openSwitch = useContextMenu(switchMenuId(asset.id));
  const bar = (
    <Bar
      schema={asset.schema}
      {...(look.label !== undefined ? { label: look.label } : {})}
      {...(look.segmented ? { framed: 'segmented' as const } : {})}
    />
  );
  return (
    <div className={s.contents} onContextMenu={openSwitch}>
      {look.group ? <Toolbar.Group className="wd-commandbar-group">{bar}</Toolbar.Group> : bar}
    </div>
  );
}
