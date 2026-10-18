/**
 * The messages a devtools panel and a page running weasel exchange. Plain
 * data only, so the same messages cross a direct call or `window.postMessage`.
 */
import type { DebugFeature } from '../debug/types';
import type { SerializedValue } from './serialize';

/** Bumped on any change a panel built against the previous number would misread. */
export const DEVTOOLS_PROTOCOL = 1;

/** The areas of a root a `changed` notice reports. */
export type DevtoolsArea = 'scene' | 'selection' | 'view' | 'tool' | 'trace';

/** One mounted `<SceneCanvas>`. */
export interface DevtoolsRootInfo {
  id: string;
  /** The canvas's `aria-label`, else its DOM id, else its root id. */
  label: string;
  dimension: '2d' | '3d';
}

/** Debug overlay features a panel turns on or off over the canvas's own `debug` prop. */
export type DevtoolsOverlays = Partial<Record<DebugFeature, boolean>>;

/** A request a panel sends about one root. */
export type DevtoolsRequest = { protocol: number; requestId: number; rootId: string } & (
  | { type: 'get-children'; nodeId?: string }
  | { type: 'get-node'; nodeId: string }
  | { type: 'get-state' }
  /** Coord records come back only when `coordCursor` is given. */
  | { type: 'get-trace'; cursor: number; coordCursor?: number }
  | { type: 'get-frame' }
  | { type: 'select'; ids: string[] }
  | { type: 'highlight'; ids: string[] }
  | { type: 'set-tool'; toolId: string | null }
  | { type: 'set-overlays'; overlays: DevtoolsOverlays }
);

export type PanelMessage =
  | { type: 'yo'; protocol: number }
  /** The panel is closing: drop its overlays and highlight, and stop tracing for it. */
  | { type: 'bye'; protocol: number }
  | DevtoolsRequest;

export type PageMessage =
  | { type: 'sup'; protocol: number; kitVersion: string; roots: DevtoolsRootInfo[] }
  | { type: 'root-added'; protocol: number; root: DevtoolsRootInfo }
  | { type: 'root-removed'; protocol: number; rootId: string }
  /** Each changed area with its new version. At most one per root per frame. */
  | { type: 'changed'; protocol: number; rootId: string; areas: Partial<Record<DevtoolsArea, number>> }
  | { type: 'result'; protocol: number; requestId: number; result: DevtoolsResult }
  /** `requestId` is null for a message that was not a request. */
  | { type: 'error'; protocol: number; requestId: number | null; message: string };

/** One child row of the scene tree. `nodeId` absent asks for the top level. */
export interface DevtoolsNodeSummary {
  id: string;
  kind: 'leaf' | 'container';
  layer: string;
  childCount: number;
  hidden: boolean;
  locked: boolean;
  pickable: boolean;
}

export interface DevtoolsNodeDetail extends DevtoolsNodeSummary {
  parent: string | null;
  pose: SerializedValue;
  data: SerializedValue;
}

export interface DevtoolsRootState {
  selection: string[];
  view: SerializedValue;
  activeTool: string | null;
  tools: string[];
  /** The debug overlay features in effect: the canvas's own, with the panel's over them. */
  overlays: DevtoolsOverlays;
  /** Probes registered through the test hook, by name. */
  probes: Record<string, SerializedValue>;
}

export interface DevtoolsTraceSlice {
  entries: SerializedValue[];
  cursor: number;
  /** What a press at the pointer would do, or null when the pointer is off the canvas. */
  live: SerializedValue;
  coords?: { entries: SerializedValue[]; cursor: number };
}

export type DevtoolsResult =
  | DevtoolsNodeSummary[]
  | DevtoolsNodeDetail
  | DevtoolsRootState
  | DevtoolsTraceSlice
  | SerializedValue
  | null;
