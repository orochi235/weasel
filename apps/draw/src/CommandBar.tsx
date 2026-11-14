/** Top action bar for WeaselDraw — buttons that aren't tools, led by the menu bar on the same row.
 *
 *  Every editing command (history, clipboard, group, create outlines) is a kit action, and each run of them is a
 *  command-row surface asset (`COMMAND_ASSETS`) drawn in its slot here, from the registry `<SceneCanvas>` fills,
 *  glyphs included; each can be moved to a menu or a panel instead. Simplify, Offset and Corner shape are command-row
 *  assets too, of draw's own controls (`PATH_COMMAND_ASSETS`), and move to a panel only. Arrange, Pathfinder, and Path are surface assets, drawn in the
 *  toolbar dock below this row (`StripDock`) when they are shown as toolbars or menus. The app's own view toggles and Release compound
 *  path are actions too (`appCommands`), as are Preferences (the editor shell's), Record and Play
 *  (`recording`) and Open, Import and Save (`fileCommands`), so a button's shortcut is the
 *  binding that fires it. The Debug menu's rows are `debug.open`'s variants, one per dev page. */
import type { ReactNode } from 'react';
import { pref } from '@weasel-js/prefs';
import { Bar } from '@weasel-js/ui/components/Bar';
import { PrefsBar } from '@weasel-js/ui/components/PrefsBar';
import { DEBUG_MENU } from './dev/devRoutes';
import { CommandSlot } from './surfaces/CommandSurfaces';

export interface CommandBarProps {
  /** The app's menu bar, drawn first in the row. */
  menus?: ReactNode;
}

/** A command-row asset of one registry group's actions, drawn as the kit's `ActionBar` draws that group. */
const Run = ({ id, group }: { id: string; group: string }) => <CommandSlot id={id} label={`${group} actions`} segmented />;

const DEBUG_BAR = pref.group('', { debug: DEBUG_MENU }, { as: 'bar' });

export function CommandBar(p: CommandBarProps) {
  return (
    <Bar className="wd-commandbar" label="Actions" wrap>
      {p.menus}
      <CommandSlot id="file" group />
      <Run id="undo" group="history" />
      <Run id="clipboard" group="clipboard" />
      <Run id="edit" group="edit" />
      <Run id="structure" group="structure" />
      <Run id="view" group="view" />
      <CommandSlot id="pathCommands" group />
      <CommandSlot id="corners" group />
      <Run id="text" group="text" />
      <Run id="compound" group="compound" />
      <Bar.Spacer />
      <Run id="record" group="record" />
      <Bar.Group className="wd-commandbar-group">
        <PrefsBar schema={DEBUG_BAR} />
      </Bar.Group>
      <Run id="app" group="app" />
    </Bar>
  );
}
