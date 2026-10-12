/**
 * WeaselDraw's own commands (the grid and snap toggles, Release compound
 * path, Preferences, the command palette) as actions the gesture dispatcher routes and the command
 * bar draws from the registry. Each reads the live `appCommands` dep.
 */

// Side-effect import: augments DepSchema with `appCommands`.
import './depSchemaAugmentation';

import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/core';
import { GridIcon, SearchIcon, SnapIcon } from '@weasel-js/ui';
import { ReleaseCompoundIcon, SettingsIcon } from '../actionIcons';

/** What the app's own commands read and do. */
export interface AppCommands {
  gridVisible: boolean;
  toggleGrid(): void;
  snapToGrid: boolean;
  toggleSnap(): void;
  /** Whether any selected path has more than one subpath. */
  canReleaseCompound: boolean;
  releaseCompound(): void;
  openPrefs(): void;
  openPalette(): void;
}

const read = (deps?: ActionDeps): AppCommands | undefined => deps?.appCommands;

type AppAction = Action & { requires: ['appCommands'] };

export const toggleGridAction: AppAction = {
  id: 'view.grid',
  label: 'Show grid',
  icon: () => <GridIcon />,
  group: 'view',
  // `code` too: with Shift held the key reads as the symbol above the 3.
  defaultBinding: { kind: 'key', key: '3', code: 'Digit3', mods: { shift: true } },
  requires: ['appCommands'],
  active: (deps) => read(deps)?.gridVisible === true,
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.toggleGrid() },
};

export const toggleSnapAction: AppAction = {
  id: 'view.snap',
  label: 'Snap to grid',
  icon: () => <SnapIcon />,
  group: 'view',
  requires: ['appCommands'],
  active: (deps) => read(deps)?.snapToGrid === true,
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.toggleSnap() },
};

export const releaseCompoundAction: AppAction = {
  id: 'path.releaseCompound',
  label: 'Release compound path',
  icon: () => <ReleaseCompoundIcon />,
  group: 'compound',
  defaultBinding: { kind: 'key', key: '|', mods: { shift: true } },
  requires: ['appCommands'],
  enabled: (deps) => read(deps)?.canReleaseCompound === true || ActionDisabledReason.NotApplicable,
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const commands = read(deps);
      if (commands?.canReleaseCompound) commands.releaseCompound();
    },
  },
};

export const preferencesAction: AppAction = {
  id: 'app.preferences',
  label: 'Preferences',
  icon: () => <SettingsIcon />,
  group: 'app',
  defaultBinding: { kind: 'key', key: ',', mods: { mod: true } },
  requires: ['appCommands'],
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.openPrefs() },
};

export const commandsAction: AppAction = {
  id: 'app.commands',
  label: 'Commands',
  icon: () => <SearchIcon />,
  group: 'app',
  defaultBinding: { kind: 'key', key: 'k', mods: { mod: true } },
  requires: ['appCommands'],
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.openPalette() },
};

export const appActions: Action[] = [
  toggleGridAction,
  toggleSnapAction,
  releaseCompoundAction,
  preferencesAction,
  commandsAction,
];
