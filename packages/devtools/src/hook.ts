/**
 * `@weasel-js/devtools/hook` — the page's side of devtools: the `devtools`
 * contribution that registers each canvas taking it with the hook on
 * `window.__weaselDevtools__`, installing the hook first, and the hook's and
 * roots' own constructors. A page a panel or the extension should see mounts
 * the contribution; one that does not pays nothing for devtools.
 *
 * @packageDocumentation
 */
export { attachDevtools, devtools } from './page/attach';
export { createDevtoolsHook, installDevtoolsHook } from './page/hook';
export type { WeaselDevtoolsHook } from './page/hook';
export { createDevtoolsRoot } from './page/root';
export type { DevtoolsRoot, DevtoolsRootSource } from './page/root';
export type { DevtoolsSchedule } from './page/notices';
