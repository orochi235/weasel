/** Top action bar for WeaselDraw — buttons that aren't tools, led by the menu bar on the same row.
 *
 *  Every editing command (history, clipboard, group, create outlines) is a kit action, and each run of them is a
 *  command-row surface asset (`COMMAND_ASSETS`) drawn in its slot here, from the registry `<SceneCanvas>` fills,
 *  glyphs included; each can be moved to a menu or a panel instead. Arrange, Pathfinder, and Path are surface assets, drawn in the
 *  toolbar dock below this row (`StripDock`) when they are shown as toolbars or menus. The app's own view toggles, Release compound path, and
 *  Preferences are actions too (`appCommands`), as are Record and Play
 *  (`recording`) and Open, Import and Save (`fileCommands`), so a button's shortcut is the
 *  binding that fires it. The Debug menu's rows are `debug.open`'s variants, one per dev page. */
import type { ReactNode } from 'react';
import { pref } from '@weasel-js/prefs';
import { Bar } from '@weasel-js/ui/components/Bar';
import { Toolbar } from '@weasel-js/ui/components/Toolbar';
import { DEBUG_MENU } from './dev/devRoutes';
import { CommandSlot } from './surfaces/CommandSurfaces';
import { CornerShape, type CornerShapeProps } from './ui/CornerShape';
import { PathCommands } from './ui/PathCommands';

export interface CommandBarProps {
  /** The app's menu bar, drawn first in the row. */
  menus?: ReactNode;
  /** What the Corner shape controls read; without it they are left out. */
  corners?: CornerShapeProps;
}

/** A command-row asset of one registry group's actions, drawn as the kit's `ActionBar` draws that group. */
const Run = ({ id, group }: { id: string; group: string }) => <CommandSlot id={id} label={`${group} actions`} segmented />;

const DEBUG_BAR = pref.group('', { debug: DEBUG_MENU }, { as: 'bar' });

export function CommandBar(p: CommandBarProps) {
  return (
    <Toolbar className="wd-commandbar" aria-label="Actions" roving={false} wrap>
      {p.menus}
      <CommandSlot id="file" group />
      <Run id="undo" group="history" />
      <Run id="clipboard" group="clipboard" />
      <Run id="edit" group="edit" />
      <Run id="structure" group="structure" />
      <Run id="view" group="view" />
      <PathCommands />
      {p.corners && <CornerShape {...p.corners} />}
      <Run id="text" group="text" />
      <Run id="compound" group="compound" />
      <Toolbar.Spacer />
      <Run id="record" group="record" />
      <Toolbar.Group className="wd-commandbar-group">
        <Bar schema={DEBUG_BAR} />
      </Toolbar.Group>
      <Run id="app" group="app" />
    </Toolbar>
  );
}
