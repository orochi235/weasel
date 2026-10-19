// `@weasel-js/core/devtools` — importing it publishes the devtools hook on
// `window.__weaselDevtools__`. A dev build does that by itself; a production
// build does it only for an app that imports this. Its exports are
// `@weasel-js/core/devtools-protocol`'s, which installs nothing.
import { installDevtoolsHook } from '../devtools/hook';

installDevtoolsHook();

export * from './devtools-protocol';
