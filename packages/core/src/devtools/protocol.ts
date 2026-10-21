/**
 * The messages a devtools panel and a page running weasel exchange. Plain
 * data only, so the same messages cross a direct call or `window.postMessage`.
 */
import type { DebugFeature } from '../debug/types';
import type { SerializedValue } from './serialize';

/** Bumped on any change a panel built against the previous number would misread. */
export const DEVTOOLS_PROTOCOL = 1;

/** The areas of a root a `changed` notice reports. */
export type DevtoolsArea = 'scene' | 'selection' | 'view' | 'tool' | 'trace' | 'registry' | 'history';

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
  | { type: 'get-registry' }
  /** The stack's entry labels come back only when `checkpoints` is true. */
  | { type: 'get-history'; cursor: number; checkpoints?: boolean }
  | { type: 'select'; ids: string[] }
  | { type: 'highlight'; ids: string[] }
  | { type: 'set-tool'; toolId: string | null }
  | { type: 'set-overlays'; overlays: DevtoolsOverlays }
);

/** Every message a panel sends the page. */
export type PanelMessage =
  | { type: 'yo'; protocol: number }
  /** The panel is closing: drop its overlays and highlight, and stop tracing for it. */
  | { type: 'bye'; protocol: number }
  | DevtoolsRequest;

/** Every message the page sends a panel. */
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

/** A node as `get-node` returns it: its row in the tree, plus its parent, pose and data. */
export interface DevtoolsNodeDetail extends DevtoolsNodeSummary {
  parent: string | null;
  pose: SerializedValue;
  data: SerializedValue;
}

/** What `get-state` returns about a root. */
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

/** What `get-trace` returns: the records after the cursor, and the cursor to send next. */
export interface DevtoolsTraceSlice {
  entries: SerializedValue[];
  cursor: number;
  /** What a press at the pointer would do, or null when the pointer is off the canvas. */
  live: SerializedValue;
  coords?: { entries: SerializedValue[]; cursor: number };
}

/** One gesture-to-action binding, as a tool, an always-on entry or an action declares it. */
export interface DevtoolsBinding {
  actionId: string;
  /** The `GestureSpec` as written. */
  spec: SerializedValue;
  /** The spec in the route grammar, one string per route it expands to. */
  routes: string[];
  /** The binding's `BindingOpts`: params, roles, views. */
  opts: SerializedValue;
}

/** A tool or other contribution the canvas's dispatcher assembles bindings from. */
export interface DevtoolsToolEntry {
  id: string;
  /** A switchable tool, an always-on entry, or one a `features` preset brought. */
  slot: 'tool' | 'ambient' | 'contribution';
  label: string;
  /** The icon's qualified name. */
  icon: string | null;
  group: string | null;
  shortcut: string | null;
  /** The key that holds it engaged while pressed. */
  hotkey: string | null;
  hidden: boolean;
  cursor: SerializedValue;
  eligibility: SerializedValue;
  bindings: DevtoolsBinding[];
  /** Ids of the actions it brings with it. */
  actions: string[];
  /** Names of the deps it registers. */
  deps: string[];
  hasOverlay: boolean;
}

/** A registered action. `enabled` and `active` are asked when the registry is read. */
export interface DevtoolsActionEntry {
  id: string;
  label: string;
  icon: string | null;
  group: string | null;
  tags: string[];
  shortcut: string | null;
  /** Which binding scope its own bindings ride. */
  scope: 'hotkey' | 'ambient';
  invoker: 'immediate' | 'ongoing' | null;
  requires: string[];
  variants: { key: string; label: string; icon: string | null; params: SerializedValue }[];
  /** `true`, or the reason it is disabled. */
  enabled: true | string;
  /** Null for an action with no pressed state. */
  active: boolean | null;
  hasPreview: boolean;
  /** The eligibility rule, or null for always eligible. */
  eligible: SerializedValue;
  bindings: DevtoolsBinding[];
}

/** A dep name the canvas's registry answers. */
export interface DevtoolsDepEntry {
  name: string;
  /** How many scopes above the canvas's own its live source sits: 0 for the canvas's. */
  depth: number;
  /** How many sources are stacked under the name there, the live one included. */
  stacked: number;
}

/** What `get-registry` returns: what one canvas has registered. */
export interface DevtoolsRegistry {
  tools: DevtoolsToolEntry[];
  actions: DevtoolsActionEntry[];
  deps: DevtoolsDepEntry[];
  /** The node routing kinds a binding's `kind:` target can name, in classify order. */
  routingKinds: string[];
}

/** One op of a recorded history step. */
export interface DevtoolsHistoryOp {
  /** The op's registered name, `'kit:setPose'` and the like; `'?'` for an op with none. */
  kind: string;
  /** The node ids its args address. */
  targets: string[];
  summary: SerializedValue;
}

/** One change to a scene's history: an edit recorded, merged, undone, redone or jumped across. */
export interface DevtoolsHistoryRecord {
  ts: number;
  step: 'push' | 'coalesce' | 'undo' | 'redo' | 'goto' | 'branch' | 'prune' | 'clear' | 'restore';
  /** The entries the step pushed, merged into or walked across, in the order it touched them. */
  entries: { id: number; label: string; opCount: number; ops: DevtoolsHistoryOp[] }[];
  /** Where the history stood after the step: entries applied, and entries in all. */
  position: { index: number; total: number };
}

/** What `get-history` returns: the steps after the cursor, the cursor to send next, and where the history stands. */
export interface DevtoolsHistorySlice {
  entries: DevtoolsHistoryRecord[];
  cursor: number;
  position: { index: number; total: number; canUndo: boolean; canRedo: boolean };
  /** Every entry on the stacks, oldest applied first, then the redoable ones. */
  checkpoints?: { id: string; label: string }[];
}

/** The body of a `result` reply; which one depends on the request it answers. */
export type DevtoolsResult =
  | DevtoolsNodeSummary[]
  | DevtoolsNodeDetail
  | DevtoolsRootState
  | DevtoolsTraceSlice
  | DevtoolsRegistry
  | DevtoolsHistorySlice
  | SerializedValue
  | null;
