/** Declares the `appCommands` dep the app's own actions read. `appCommandsContribution` publishes its live source. */
import '@weasel-js/core';
import type { AppCommands } from './actions';

declare module '@weasel-js/core' {
  interface DepSchema {
    appCommands?: AppCommands;
  }
}

export {};

// An augmentation that stops merging still compiles; this says the key landed.
const _merged: import('@weasel-js/core').DepName = 'appCommands';
void _merged;
