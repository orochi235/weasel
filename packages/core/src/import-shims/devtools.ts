// `@weasel-js/core/devtools` — importing it publishes the devtools hook on
// `window.__weaselDevtools__`. A dev build does that by itself; a production
// build does it only for an app that imports this. It also carries what a
// panel needs to talk to the hook: the protocol, the transports and their types.
import { installDevtoolsHook } from '../devtools/hook';

installDevtoolsHook();

export { installDevtoolsHook, createDevtoolsHook } from '../devtools/hook';
export type { WeaselDevtoolsHook } from '../devtools/hook';
export { DEVTOOLS_PROTOCOL } from '../devtools/protocol';
export type {
  DevtoolsArea, DevtoolsNodeDetail, DevtoolsNodeSummary, DevtoolsOverlays, DevtoolsRequest,
  DevtoolsResult, DevtoolsRootInfo, DevtoolsRootState, DevtoolsTraceSlice, PageMessage, PanelMessage,
} from '../devtools/protocol';
export {
  DEVTOOLS_ENVELOPE, createInPageTransports, createWindowPageTransport, createWindowPanelTransport,
  isDevtoolsEnvelope,
} from '../devtools/transport';
export type { DevtoolsEnvelope, DevtoolsTransport, PageTransport, PanelTransport } from '../devtools/transport';
export { serialize } from '../devtools/serialize';
export type { SerializeLimits, SerializedValue } from '../devtools/serialize';
export { createDevtoolsRoot } from '../devtools/root';
export type { DevtoolsRoot, DevtoolsRootSource } from '../devtools/root';
export type { DevtoolsSchedule } from '../devtools/session';
