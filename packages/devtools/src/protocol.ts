/**
 * `@weasel-js/devtools/protocol` — the messages a panel and a page's devtools
 * hook exchange, the transports that carry them, and the serializer for values
 * neither side authored. Installs nothing and loads neither React nor core, so
 * an extension's background and content scripts import it too.
 *
 * @packageDocumentation
 */
export { DEVTOOLS_PROTOCOL } from './page/protocol';
export { isPageMessage, isPanelMessage } from './page/messageShape';
export type {
  DevtoolsActionEntry, DevtoolsArea, DevtoolsBinding, DevtoolsDepEntry, DevtoolsHistoryOp, DevtoolsHistoryRecord,
  DevtoolsHistorySlice, DevtoolsNodeDetail, DevtoolsNodeSummary, DevtoolsOverlays, DevtoolsRegistry, DevtoolsRequest,
  DevtoolsResult, DevtoolsRootInfo, DevtoolsRootState, DevtoolsToolEntry, DevtoolsTraceSlice, PageMessage,
  PanelMessage,
} from './page/protocol';
export {
  DEVTOOLS_ENVELOPE, createInPageTransports, createWindowPageTransport, createWindowPanelTransport,
  isDevtoolsEnvelope,
} from './page/transport';
export type { DevtoolsEnvelope, DevtoolsTransport, PageTransport, PanelTransport } from './page/transport';
export { escapeKey, serialize, serializedNumber, unescapeKey } from './page/serialize';
export type { SerializeLimits, SerializedTag, SerializedValue } from './page/serialize';
