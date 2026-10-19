/** The rows the registry inspector's tree lists, one shape per category. */
import type { IconRef } from '@weasel-js/icons';
import type { ShortcutInput } from '@weasel-js/gestures';

/** Discriminated leaf entry. One of these per row in the tree's right pane. */
export type TreeEntry =
  | ShapeKindEntry
  | PropertiesKindEntry
  | BundleEntry
  | IconEntry
  | OpFactoryEntry
  | GestureEntry
  | PhaseOutputEntry
  | OpKindEntry
  | SlotEntry
  | MetaEntry;

/** Gesture kinds a tool binds. `true` when at least one entry in
 *  `Tool.bindings` declares that kind. */
export interface GestureChannels {
  click: boolean;
  doubleClick: boolean;
  pointerDown: boolean;
  drag: boolean;
  wheel: boolean;
  key: boolean;
  keyHeld: boolean;
  contextMenu: boolean;
  multiTouchTap: boolean;
}

/** Things a tool *declares or emits* rather than reacting to. Kept apart
 *  from gestures so the "subscribing tools" framing doesn't misrepresent
 *  them. (`claimsAll` used to live here — it was a phase-table field that
 *  told the tool-routing dispatcher to bypass affordance hit-testing, and it
 *  went with that dispatcher.) */
export interface ToolOutputs {
  cursor: boolean;
  overlay: boolean;
}

/** What a tool's input surface looks like: the gesture kinds it binds plus
 *  what it declares. Replaces the per-phase summary — a tool has one
 *  binding list now, not an initial and an engaged route table. */
export interface ToolSurface {
  gestures: GestureChannels;
  outputs: ToolOutputs;
}

/** Source location attached to a callback function at build time by the
 *  `weasel:callback-source` Vite plugin (dev only). Absolute filesystem
 *  path so the inspector can compose a vscode:// link directly. */
export interface CallbackSource {
  file: string;
  line: number;
  col: number;
}

/** A single named callback within a tool or action, with its authoring
 *  source location. `label` is a dotted path like `initial.drag.node` or
 *  `engaged.click.empty:shift` for tools, or `enabled` / `invoker.run`
 *  for actions. */
export interface CallbackRef {
  label: string;
  source: CallbackSource;
}

/** One route as the tool declared it — either an entry in a `PhaseDef` route
 *  table or a `GestureBinding`. The two differ in what handles the route:
 *  a phase-table route runs an inline `ActionFn` (no id to name), a binding
 *  dispatches to a registered `Action`. */
export interface DeclaredRoute {
  /** Formatted v3 grammar string, e.g. `[initial] click => empty +shift`. */
  route: string;
  /** Id of the `Action` this route dispatches to. Binding-sourced routes
   *  only — undefined for phase-table routes. */
  actionId?: string;
  /** Where the handler is written, when the dev `weasel:callback-source`
   *  plugin tagged it. For bindings this is the action's invoker (bindings
   *  are object literals and carry no function of their own). */
  source?: CallbackSource;
}

export interface ToolEntry {
  kind: 'tool';
  id: string;
  label: string;
  /** Hook the tool is exported as (e.g. `useRectTool`). Static map keyed on
   *  tool id — present for built-ins, undefined for custom ids. */
  hookName?: string;
  cursor?: string;
  /** Route signatures the tool exposes, derived from `buildActionRegistry`
   *  on the live `ToolDef`. Each entry is a v3 grammar string
   *  `[phase] gesture(arg) => target +mod`, e.g.
   *  `[initial] click => empty` or `[initial] drag => node +shift`. */
  routes: readonly string[];
  /** Every route the tool declares, in declaration order and *without*
   *  de-duping — the row-level view `routes` flattens. Several bindings can
   *  format to the same route string yet dispatch to different actions
   *  (select's resize / rotate / move drags all render as
   *  `[*:*] drag => predicate`, because the grammar has no notation for a
   *  predicate target), so collapsing on the string loses real routes. */
  declaredRoutes: readonly DeclaredRoute[];
  /** Where the tool currently sits in the mounted SceneCanvas. `registry`
   *  covers the regular active/hotkey slots; `ambient` is the always-on
   *  slot. */
  slot: 'registry' | 'ambient';
  /** The tool-switch keybinding (`ToolDef.keybinding`). Distinct from
   *  gesture shortcuts inside the tool. */
  switchShortcut?: ShortcutInput;
  /** Hotkey-slot trigger key (`space|alt|ctrl|meta|shift`) when set — the
   *  press-and-hold slot. */
  hotkey?: string;
  /** Palette presentation. `icon` is the rendered `presentation.icon` when
   *  the def supplies one. */
  presentation?: {
    label?: string;
    group?: string;
    shortcut?: string;
    icon?: import('react').ReactNode;
  };
  /** Which gesture kinds this tool binds, and what it declares. */
  surface: ToolSurface;
  /** Top-level optional members present on the `ToolDef`. */
  capabilities: {
    onActivate: boolean;
    onDeactivate: boolean;
  };
  /** Source-linked callbacks discovered on the live ToolDef — empty when
   *  the dev `weasel:callback-source` plugin isn't active (e.g. prod
   *  builds). Inspector renders these as "open in editor" links. */
  callbacks?: readonly CallbackRef[];
}

export interface ActionEntry {
  kind: 'action';
  id: string;
  label: string;
  /** The first key binding in the action's `defaultBinding`. `undefined`
   *  when it binds no key. */
  bindingShortcut?: ShortcutInput;
  /** Display-override shortcut string from `Action.shortcut` — orthogonal
   *  to `bindingShortcut` (which comes from `defaultBinding`). */
  shortcut?: string;
  /** Grouping key from `Action.group`. When unset we fall back to the
   *  id-prefix segment before the first `.` (e.g. `align.left` → `align`). */
  group?: string;
  /** Pre-rendered icon node, when `Action.icon` is set. */
  icon?: import('react').ReactNode;
  /** One entry per `ActionItem` (a variant each, or the action alone), with
   *  its icon's name — what an `<ActionBar>` draws for this action. */
  items?: readonly { key: string; label: string; icon?: IconRef }[];
  /** Snapshot of `Action.enabled()` at probe time. `undefined` when the
   *  action declares no predicate (always enabled). Stale-by-design: the
   *  inspector doesn't re-evaluate on selection changes — open a fresh
   *  view to refresh. */
  enabled?: { enabled: true } | { enabled: false; reason: string };
  hookName?: string;
  /** Source-linked callbacks discovered on the live Action. See
   *  `ToolEntry.callbacks` for plugin/source caveats. */
  callbacks?: readonly CallbackRef[];
  /** Raw `Action.defaultBinding` snapshot — intentionally typed as `unknown`
   *  so callers must narrow before use. Retained for future inspector
   *  consumers (action-detail Powerline strips, etc.). */
  defaultBinding?: unknown;
}

export interface ShapeKindEntry {
  kind: 'shapeKind';
  /** Which trait this entry belongs to. Always `'shape'` for ShapeKindEntry —
   *  the field exists so the inspector can group entries by trait
   *  regardless of `kind`. */
  trait: 'shape';
  id: string;
  label: string;
  /** Id of the tool that mints objects of this kind (`rect` → `rect`).
   *  Same value as `id` for the built-ins; carried as a separate field so
   *  the inspector can drill from kind → tool without re-encoding the
   *  assumption. */
  tool?: string;
  /** Hook the authoring tool is exported as. Read off the live tool's
   *  `hookName` field (set by each builtin hook on its `defineTool` spec). */
  hookName?: string;
}

/** One properties-trait kind. `leafPaths` lists the schema's dotted node
 *  paths so the detail pane can show what the kind exposes. */
export interface PropertiesKindEntry {
  kind: 'propertiesKind';
  trait: 'properties';
  id: string;
  label: string;
  leafPaths: readonly string[];
}

export interface BundleEntry {
  kind: 'bundle';
  id: 'minimal' | 'standard' | 'exhaustive';
  label: string;
  /** Tool ids the bundle registers: `features={['draw']}` brings select and
   *  hand, and `defaultTools` the rest. The kit names no bundles of its own;
   *  these are the inspector's. */
  tools: readonly string[];
}

export interface IconEntry {
  kind: 'icon';
  id: string;
  label: string;
  /** `action`: a glyph a kit action ships as its `icon`. `app`: one of
   *  WeaselDraw's own controls. */
  source: 'action' | 'app';
  /** For `action` glyphs, the `ActionItem.key` of every entry that draws it. */
  actions?: readonly string[];
  ref: IconRef;
}

export interface OpFactoryEntry {
  kind: 'opFactory';
  id: string;
  label: string;
}

/** Lifecycle phase a `ToolDef` can declare routes in. `initial` is the
 *  resting phase; `engaged` is entered after a phase transition (e.g.
 *  start of a drag). */

/** Gesture kinds a tool can bind. Strictly typed against
 *  `GestureChannels` so tool outputs can't sneak in. */
export const GESTURE_CHANNEL_KEYS: readonly (keyof GestureChannels)[] = [
  'click', 'doubleClick', 'pointerDown', 'drag', 'wheel',
  'key', 'keyHeld', 'contextMenu', 'multiTouchTap',
];

/** Catalog entries for the inspector: one page per gesture kind, listing
 *  every tool binding and action `defaultBinding` that routes through it.
 *  There used to be two vocabularies here — phase-table channel names and
 *  `GestureSpec.kind` values — and the catalog listed both because a route
 *  could live in either. One grammar, one list. */
export const GESTURE_CATALOG_KEYS: readonly string[] = [
  'click', 'doubleClick', 'pointerDown', 'drag', 'wheel', 'pinch',
  'key', 'key-held', 'contextMenu', 'multiTouch', 'multiTouchTap',
];

/** Non-gesture declarations — the tool emits these rather than reacting to
 *  them. Strictly typed against `ToolOutputs`. */
export const PHASE_OUTPUT_KEYS: readonly (keyof ToolOutputs)[] = [
  'cursor', 'overlay',
];

export interface GestureEntry {
  kind: 'gesture';
  /** A `GestureSpec.kind` value. */
  id: string;
  label: string;
}

export interface PhaseOutputEntry {
  kind: 'phaseOutput';
  id: keyof ToolOutputs;
  label: string;
}

export interface OpKindEntry { kind: 'opKind'; id: string; label: string }


/** Mounting slot for a tool — `registry` covers active/hotkey routing,
 *  `ambient` is the always-on slot. */
export const TOOL_SLOTS: readonly ToolEntry['slot'][] = ['registry', 'ambient'];

export interface SlotEntry { kind: 'slot'; id: ToolEntry['slot']; label: string }

export interface MetaEntry { kind: 'meta'; id: 'tokens' | 'sceneNode'; label: string }

export type TreeCategory =
  | 'shape' | 'properties' | 'bundles'
  | 'icons' | 'ops'
  | 'phases' | 'gestures' | 'phaseOutputs'
  | 'slots'
  | 'meta';

export interface TreeCategoryNode {
  id: TreeCategory;
  label: string;
  /** Optional grouping. Categories with the same `group.id` render under a
   *  shared parent heading in the tree (e.g. shape + routing both under
   *  Facets). Categories with no `group` render at the top level. */
  group?: {
    id: string;
    label: string;
  };
  entries: readonly TreeEntry[];
}
