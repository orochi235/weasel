/**
 * WeaselDraw's own commands (the grid, snap, symmetry, and path direction toggles, showing and hiding each
 * toolbar, palette, and panel, Release compound
 * path, Preferences, the command palette) as actions the gesture dispatcher routes and the command
 * bar draws from the registry. Each reads the live `appCommands` dep.
 */

// Side-effect import: augments DepSchema with `appCommands`.
import './depSchemaAugmentation';

import { ActionDisabledReason, type Action, type ActionDeps } from '@weasel-js/core';
import { icon } from '../icons.gen';
import { CHROME_ITEMS, chromeActionId } from '../surfaces/chrome';

/** What the app's own commands read and do. */
export interface AppCommands {
  gridVisible: boolean;
  toggleGrid(): void;
  snapToGrid: boolean;
  toggleSnap(): void;
  /** Whether path edit draws the edited path's direction arrows. */
  pathDirection: boolean;
  togglePathDirection(): void;
  /** Whether live symmetry is on. */
  symmetryOn: boolean;
  toggleSymmetry(): void;
  /** Whether toolbar, palette, or panel `id` is hidden. */
  chromeHidden(id: string): boolean;
  toggleChrome(id: string): void;
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
  icon: icon('ui:grid'),
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
  icon: icon('ui:snap'),
  group: 'view',
  requires: ['appCommands'],
  active: (deps) => read(deps)?.snapToGrid === true,
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.toggleSnap() },
};

export const togglePathDirectionAction: AppAction = {
  id: 'view.pathDirection',
  label: 'Show path direction',
  icon: icon('pathDirection'),
  group: 'view',
  requires: ['appCommands'],
  active: (deps) => read(deps)?.pathDirection === true,
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.togglePathDirection() },
};

export const toggleSymmetryAction: AppAction = {
  id: 'view.symmetry',
  label: 'Symmetry',
  icon: icon('symmetry'),
  group: 'view',
  requires: ['appCommands'],
  active: (deps) => read(deps)?.symmetryOn === true,
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.toggleSymmetry() },
};

/** One action per toolbar, palette, and panel the View menu shows and hides, checked while it shows. In their own
 *  group, so no action bar draws them. */
export const chromeActions: AppAction[] = CHROME_ITEMS.map(({ id, label }) => ({
  id: chromeActionId(id),
  label,
  group: 'chrome',
  requires: ['appCommands'],
  active: (deps) => {
    const commands = read(deps);
    return commands !== undefined && !commands.chromeHidden(id);
  },
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.toggleChrome(id) },
}));

export const releaseCompoundAction: AppAction = {
  id: 'path.releaseCompound',
  label: 'Release compound path',
  icon: icon('releaseCompound'),
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
  icon: icon('settings'),
  group: 'app',
  defaultBinding: { kind: 'key', key: ',', mods: { mod: true } },
  requires: ['appCommands'],
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.openPrefs() },
};

export const commandsAction: AppAction = {
  id: 'app.commands',
  label: 'Commands',
  icon: icon('ui:search'),
  group: 'app',
  defaultBinding: { kind: 'key', key: 'k', mods: { mod: true } },
  requires: ['appCommands'],
  invoker: { timing: 'immediate', run: (deps) => read(deps)?.openPalette() },
};

export const appActions: Action[] = [
  toggleGridAction,
  toggleSnapAction,
  togglePathDirectionAction,
  toggleSymmetryAction,
  ...chromeActions,
  releaseCompoundAction,
  preferencesAction,
  commandsAction,
];
