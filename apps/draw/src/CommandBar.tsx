/** Top action bar for WeaselDraw — buttons that aren't tools, led by the menu bar on the same row.
 *
 *  Every editing command (history, clipboard, group, create outlines) is a kit action, rendered by
 *  the kit's `<ActionBar group=…/>` from the registry `<SceneCanvas>` fills,
 *  glyphs included. Arrange, Pathfinder, and Path are surface assets, drawn in the
 *  toolbar dock below this row (`StripDock`) when they are shown as toolbars or menus. The app's own view toggles, Release compound path, and
 *  Preferences are actions too (`appCommands`), as are Record and Play
 *  (`recording`) and Open, Import and Save (`fileCommands`), so a button's shortcut is the
 *  binding that fires it. The Debug menu's rows are `debug.open`'s variants, one per dev page. */
import type { ReactNode } from 'react';
import { pref } from '@weasel-js/prefs';
import { ActionBar as KitActionBar } from '@weasel-js/ui/components/ActionBar';
import { Bar } from '@weasel-js/ui/components/Bar';
import { DEBUG_MENU } from './dev/devRoutes';
import { FILE_ACTIONS } from './fileCommands';
import { CornerShape, type CornerShapeProps } from './ui/CornerShape';
import { PathCommands } from './ui/PathCommands';

export interface CommandBarProps {
  /** The app's menu bar, drawn first in the row. */
  menus?: ReactNode;
  /** What the Corner shape controls read; without it they are left out. */
  corners?: CornerShapeProps;
}

const FILE_BAR = pref.group('', {
  open: pref.action(FILE_ACTIONS.open, { description: 'Open SVG…' }),
  import: pref.action(FILE_ACTIONS.import, { description: 'Add an SVG to this document…' }),
  save: pref.action(FILE_ACTIONS.save, { description: 'Save as SVG' }),
}, { as: 'bar' });

const KIT_GROUPS = ['history', 'clipboard', 'edit', 'structure'] as const;

const DEBUG_BAR = pref.group('', { debug: DEBUG_MENU }, { as: 'bar' });

export function CommandBar(p: CommandBarProps) {
  return (
    <div className="wd-commandbar" role="toolbar" aria-label="Actions">
      {p.menus}
      <div className="wd-commandbar-group">
        <Bar schema={FILE_BAR} />
      </div>
      {KIT_GROUPS.map((group) => <KitActionBar key={group} group={group} />)}
      <KitActionBar group="view" />
      <PathCommands />
      {p.corners && <CornerShape {...p.corners} />}
      <KitActionBar group="text" />
      <KitActionBar group="compound" />
      <div className="wd-commandbar-spacer" />
      <KitActionBar group="record" />
      <div className="wd-commandbar-group">
        <Bar schema={DEBUG_BAR} />
      </div>
      <KitActionBar group="app" />
    </div>
  );
}
