import type { Contribution } from '@weasel-js/core';
import { appActions, type AppCommands } from './actions';

export type { AppCommands } from './actions';

/** The app's own commands and the `appCommands` dep they read, as one entry
 *  for `<SceneCanvas ambient>`. `read` returns the live state. */
export function appCommandsContribution(read: () => AppCommands): Contribution {
  return {
    id: 'draw.app',
    eligibility: { always: true },
    actions: appActions,
    deps: { appCommands: read },
  };
}
