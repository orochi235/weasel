import type { Contribution } from '@weasel-js/core';
import { DRAW_MENUS } from '../menus';
import { appActions, type AppCommands } from './actions';

export type { AppCommands } from './actions';

/** The app's own commands, the `appCommands` dep they read, and the app's menus, as one entry
 *  for `<SceneCanvas ambient>`. `read` returns the live state. */
export function appCommandsContribution(read: () => AppCommands): Contribution {
  return {
    id: 'draw.app',
    eligibility: { always: true },
    actions: appActions,
    deps: { appCommands: read },
    menus: DRAW_MENUS,
  };
}
