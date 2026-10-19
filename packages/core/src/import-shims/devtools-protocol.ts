// `@weasel-js/core/devtools-protocol` — what `@weasel-js/core/devtools` exports, without installing
// the hook on import: the protocol, the transports and their types, and the hook's own constructors.
// A panel, an extension, or anything else that must not put a hook in its own window imports this.
export { installDevtoolsHook, createDevtoolsHook } from '../devtools/hook';
export type { WeaselDevtoolsHook } from '../devtools/hook';
export { DEVTOOLS_PROTOCOL } from '../devtools/protocol';
export type {
  DevtoolsActionEntry, DevtoolsArea, DevtoolsBinding, DevtoolsDepEntry, DevtoolsHistoryOp, DevtoolsHistoryRecord,
  DevtoolsHistorySlice, DevtoolsNodeDetail, DevtoolsNodeSummary, DevtoolsOverlays, DevtoolsRegistry, DevtoolsRequest,
  DevtoolsResult, DevtoolsRootInfo, DevtoolsRootState, DevtoolsToolEntry, DevtoolsTraceSlice, PageMessage,
  PanelMessage,
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
export type { DevtoolsSchedule } from '../devtools/notices';
