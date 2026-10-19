/** Top action bar for WeaselDraw — buttons that aren't tools, led by the menu bar on the same row.
 *
 *  Every editing command (history, clipboard, group, create outlines) is a kit action, rendered by
 *  the kit's `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills,
 *  glyphs included. Arrange, Pathfinder, and Path are surface assets, drawn in the
 *  `surfaces` slot when they are shown as toolbars or menus. The app's own view toggles, Release compound path, and
 *  Preferences are actions too (`appCommands`), as are Record and Play
 *  (`recording`) and New, Open, Import and Save (`fileCommands`), so a button's shortcut is the
 *  binding that fires it. */
import type { ReactNode } from 'react';
import { pref } from '@weasel-js/prefs';
import { ActionBar as KitActionBar } from '@weasel-js/ui/components/ActionBar';
import { Bar } from '@weasel-js/ui/components/Bar';
import { MenuButton } from '@weasel-js/ui/components/MenuButton';
import { DEV_ROUTES } from './dev/devRoutes';
import { FILE_ACTIONS, FILE_NEW_MENU } from './fileCommands';
import { CornerShape, type CornerShapeProps } from './ui/CornerShape';
import { PathCommands } from './ui/PathCommands';

export interface CommandBarProps {
  /** The app's menu bar, drawn first in the row. */
  menus?: ReactNode;
  /** What the Corner shape controls read; without it they are left out. */
  corners?: CornerShapeProps;
  /** The surface assets drawn in the strip, after the view toggles. */
  surfaces?: ReactNode;
}

const FILE_BAR = pref.group('', {
  new: FILE_NEW_MENU,
  open: pref.action(FILE_ACTIONS.open, { description: 'Open SVG…' }),
  import: pref.action(FILE_ACTIONS.import, { description: 'Add an SVG to this document…' }),
  save: pref.action(FILE_ACTIONS.save, { description: 'Save as SVG' }),
}, { as: 'bar' });

const KIT_GROUPS = ['history', 'clipboard', 'edit', 'structure'] as const;

/** The in-repo dev surfaces; each opens in a new tab. */
const DEBUG_ROUTES = DEV_ROUTES.map((r) => ({ value: r.href, label: r.label }));

function openDebugRoute(hash: string) {
  window.open(`${window.location.pathname}${window.location.search}${hash}`, '_blank', 'noopener');
}

export function CommandBar(p: CommandBarProps) {
  return (
    <div className="wd-commandbar" role="toolbar" aria-label="Actions">
      {p.menus}
      <div className="wd-commandbar-group">
        <Bar schema={FILE_BAR} />
      </div>
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} />)}
      <KitActionBar group="view" />
      {p.surfaces}
      <PathCommands />
      {p.corners && <CornerShape {...p.corners} />}
      <KitActionBar group="text" />
      <KitActionBar group="compound" />
      <div className="wd-commandbar-spacer" />
      <KitActionBar group="record" />
      <div className="wd-commandbar-group">
        <MenuButton label="Debug" tooltip="Debug surfaces" items={DEBUG_ROUTES} onAction={openDebugRoute} />
      </div>
      <KitActionBar group="app" />
    </div>
  );
}
