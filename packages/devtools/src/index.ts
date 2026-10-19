/**
 * @weasel-js/devtools — a panel that reads and steers every `<SceneCanvas>` on
 * a page through the devtools hook (`@weasel-js/core/devtools`). Mount
 * `DevtoolsPanel` over any transport; `connectDevtools` is the same protocol
 * client without React.
 */
export { connectDevtools, createDevtoolsClient } from './client';
export type { DevtoolsClient, DevtoolsClientState, DevtoolsRequestBody, DevtoolsResultMap } from './client';
export { followTrace } from './trace';
export type { TraceFollower, TraceRead } from './trace';
export { followHistory } from './history';
export type { HistoryFollower } from './history';
export { DevtoolsPanel } from './DevtoolsPanel';
export type { DevtoolsPanelProps } from './DevtoolsPanel';
export type { DevtoolsTabId } from './tabs';
export { createInPagePanelTransport } from './inPageTransport';
