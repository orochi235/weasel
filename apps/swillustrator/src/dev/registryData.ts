import type { ComponentType } from 'react';
import * as Weasel from '@orochi235/weasel';
import * as ActionIcons from '../actionIcons';
import * as KindIcons from '../kindIcons';

/** Discriminated leaf entry. One of these per row in the tree's right pane. */
export type TreeEntry =
  | ToolEntry
  | ActionEntry
  | ShapeKindEntry
  | BundleEntry
  | IconEntry
  | OpFactoryEntry
  | PublicExportEntry
  | PhaseEntry
  | GestureEntry
  | PhaseOutputEntry
  | OpKindEntry
  | HotkeyTriggerEntry
  | SlotEntry
  | RouteTargetEntry
  | ModifierSetEntry
  | GroupEntry;

/** Per-phase channel presence — `true` when the `ToolDef`'s phase declares
 *  the channel (`initial.click`, `engaged.drag`, etc.). Lets the inspector
 *  show "what gestures this tool reacts to" without rendering route signatures
 *  for every cell. */
export interface PhaseSummary {
  click: boolean;
  pointerDown: boolean;
  dblTap: boolean;
  drag: boolean;
  wheel: boolean;
  keyDown: boolean;
  keyUp: boolean;
  cursor: boolean;
  overlay: boolean;
  claimsAll: boolean;
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
   *  on the live `ToolDef`. Each entry is a compact `phase.gesture.target`
   *  string (with a trailing `:modifiers` segment when non-default), e.g.
   *  `initial.click.empty` or `initial.drag.node:shift`. */
  routes: readonly string[];
  /** Where the tool currently sits in the mounted SceneCanvas. `registry`
   *  covers the regular active/hotkey slots; `ambient` is the always-on
   *  slot (resize / rotate / wheel-zoom). */
  slot: 'registry' | 'ambient';
  /** Glyphs for the tool-switch keybinding (`ToolDef.keybinding`). Distinct
   *  from gesture shortcuts inside the tool. */
  switchShortcutParts?: readonly string[];
  /** Hotkey-slot trigger key (`space|alt|ctrl|meta|shift`) when set — the
   *  press-and-hold slot. */
  hotkey?: string;
  /** Palette presentation. `icon` is the rendered `presentation.icon` when
   *  the def supplies one (the kit accepts either `ReactNode` or a thunk;
   *  we invoke the thunk with `undefined` scratch for display). */
  presentation?: {
    label?: string;
    group?: string;
    shortcut?: string;
    icon?: import('react').ReactNode;
  };
  /** Phase declarations. `engaged` is undefined when the def has no
   *  engaged-phase routes. */
  phases: {
    initial: PhaseSummary;
    engaged?: PhaseSummary;
  };
  /** Top-level optional members present on the `ToolDef`. */
  capabilities: {
    initScratch: boolean;
    onActivate: boolean;
    onDeactivate: boolean;
    hitOverride: boolean;
  };
}

export interface ActionEntry {
  kind: 'action';
  id: string;
  label: string;
  /** Per-glyph display chips for the action's default `KeyBinding`, ready
   *  for the shared `<KeyCap>` component. `undefined` when the action has
   *  no default binding. */
  shortcutParts?: readonly string[];
  /** Display-override shortcut string from `Action.shortcut` — orthogonal
   *  to `shortcutParts` (which comes from `defaultBinding`). */
  shortcut?: string;
  /** Grouping key from `Action.group`. When unset we fall back to the
   *  id-prefix segment before the first `.` (e.g. `align.left` → `align`). */
  group?: string;
  /** Pre-rendered icon node, when `Action.icon` is set. Function-form icons
   *  are invoked with no arguments. */
  icon?: import('react').ReactNode;
  /** Snapshot of `Action.enabled()` at probe time. `undefined` when the
   *  action declares no predicate (always enabled). Stale-by-design: the
   *  inspector doesn't re-evaluate on selection changes — open a fresh
   *  view to refresh. */
  enabled?: { enabled: true } | { enabled: false; reason: string };
  hookName?: string;
}

export interface ShapeKindEntry {
  kind: 'shapeKind';
  id: string;
  label: string;
  /** Id of the tool that mints objects of this kind (`rect` → `rect`).
   *  Same value as `id` for the built-ins; carried as a separate field so
   *  the inspector can drill from kind → tool without re-encoding the
   *  assumption. */
  tool?: string;
  /** Hook the authoring tool is exported as. Resolved via `TOOL_HOOK_NAMES`. */
  hookName?: string;
}

export interface BundleEntry {
  kind: 'bundle';
  id: 'minimal' | 'standard' | 'exhaustive';
  label: string;
  /** Tool ids the bundle enables when passed as SceneCanvas's `toolBundle`
   *  prop. The kit does not group actions into bundles — actions are
   *  wired separately by consumers. */
  tools: readonly string[];
}

export interface IconEntry {
  kind: 'icon';
  id: string;
  label: string;
  source: 'action' | 'kind';
  Component: ComponentType;
}

export interface OpFactoryEntry {
  kind: 'opFactory';
  id: string;
  label: string;
}

export interface PublicExportEntry {
  kind: 'publicExport';
  id: string;
  label: string;
}

/** Lifecycle phase a `ToolDef` can declare routes in. `initial` is the
 *  resting phase; `engaged` is entered after a phase transition (e.g.
 *  start of a drag). */
export type PhaseId = 'initial' | 'engaged';

export interface PhaseEntry {
  kind: 'phase';
  id: PhaseId;
  label: string;
}

/** Input-channel keys on `PhaseDef` — the gestures a tool *subscribes to*.
 *  Distinct from phase outputs (`cursor` / `overlay` / `claimsAll`), which
 *  the tool *declares or emits*. Drives the "Gestures" tree category. */
export const GESTURE_CHANNEL_KEYS: readonly (keyof PhaseSummary)[] = [
  'click', 'pointerDown', 'dblTap', 'drag', 'wheel',
  'keyDown', 'keyUp',
];

/** Non-gesture `PhaseDef` slots — the tool emits/declares these rather than
 *  reacting to them. Surfaced separately so the inspector framing
 *  ("subscribing tools") doesn't misrepresent them. */
export const PHASE_OUTPUT_KEYS: readonly (keyof PhaseSummary)[] = [
  'cursor', 'overlay', 'claimsAll',
];

export interface GestureEntry {
  kind: 'gesture';
  id: keyof PhaseSummary;
  label: string;
}

export interface PhaseOutputEntry {
  kind: 'phaseOutput';
  id: keyof PhaseSummary;
  label: string;
}

/** Stable name stamped onto an `Op` by its factory — the runtime
 *  discriminant the op-factory registry uses for serialize/restore. Mirrors
 *  the names registered in `src/core/ops/*.ts`. */
export const OP_KIND_NAMES: readonly string[] = [
  'insert', 'delete', 'transform', 'reparent', 'setSelection', 'setText', 'setPath',
];

export interface OpKindEntry { kind: 'opKind'; id: string; label: string }

/** Single-key trigger a `ToolDef.hotkey` can declare — mirrors the
 *  `HotkeyTrigger` union in `src/tools/types.ts`. */
export const HOTKEY_TRIGGER_KEYS: readonly string[] = ['space', 'alt', 'ctrl', 'meta', 'shift'];

export interface HotkeyTriggerEntry { kind: 'hotkeyTrigger'; id: string; label: string }

/** Mounting slot for a tool — `registry` covers active/hotkey routing,
 *  `ambient` is the always-on slot (resize / rotate / wheel-zoom). */
export const TOOL_SLOTS: readonly ToolEntry['slot'][] = ['registry', 'ambient'];

export interface SlotEntry { kind: 'slot'; id: ToolEntry['slot']; label: string }

export interface RouteTargetEntry { kind: 'routeTarget'; id: string; label: string }

export interface ModifierSetEntry { kind: 'modifierSet'; id: string; label: string }

export interface GroupEntry {
  kind: 'group';
  id: string;
  label: string;
  /** Where the group label was sourced — palette presentation groups vs
   *  action-registry groups occupy separate namespaces but share a list. */
  source: 'tool' | 'action';
}

export type TreeCategory =
  | 'tools' | 'actions' | 'shapeKinds' | 'bundles'
  | 'icons' | 'opFactories' | 'publicExports'
  | 'phases' | 'gestures' | 'phaseOutputs'
  | 'opKinds' | 'hotkeyTriggers' | 'slots' | 'routeTargets' | 'modifierSets' | 'groups';

export interface TreeCategoryNode {
  id: TreeCategory;
  label: string;
  entries: readonly TreeEntry[];
}

// ── Static collectors ──────────────────────────────────────────────────────

function isLikelyComponent(value: unknown): boolean {
  return typeof value === 'function'
    || (typeof value === 'object' && value !== null && '$$typeof' in value);
}

export function collectIcons(): readonly IconEntry[] {
  const out: IconEntry[] = [];
  for (const [id, Component] of Object.entries(ActionIcons)) {
    if (!isLikelyComponent(Component)) continue;
    out.push({ kind: 'icon', id, label: id, source: 'action', Component: Component as ComponentType });
  }
  for (const [id, Component] of Object.entries(KindIcons)) {
    if (!isLikelyComponent(Component)) continue;
    out.push({ kind: 'icon', id, label: id, source: 'kind', Component: Component as ComponentType });
  }
  return out;
}

/** Display labels for each `ToolBundle` id. The kit ships `BUNDLE_TOOLS`
 *  (tool-id contents) but not human-readable labels — those are
 *  presentation, owned by the inspector. */
const BUNDLE_LABELS: Record<BundleEntry['id'], string> = {
  minimal: 'Minimal',
  standard: 'Standard',
  exhaustive: 'Exhaustive',
};

export function collectBundles(): readonly BundleEntry[] {
  return (Object.keys(Weasel.BUNDLE_TOOLS) as BundleEntry['id'][]).map((id) => ({
    kind: 'bundle',
    id,
    label: BUNDLE_LABELS[id] ?? id,
    tools: Weasel.BUNDLE_TOOLS[id],
  }));
}

const OP_FACTORY_NAMES: readonly string[] = [
  'createInsertOp', 'createDeleteOp', 'createTransformOp',
  'createReparentOp', 'createSetSelectionOp', 'createSetTextOp', 'createSetPathOp',
];

export function collectOpFactories(): readonly OpFactoryEntry[] {
  return OP_FACTORY_NAMES
    .filter((name) => typeof (Weasel as Record<string, unknown>)[name] === 'function')
    .map((id) => ({ kind: 'opFactory', id, label: id }));
}

export function collectPublicExports(): readonly PublicExportEntry[] {
  const out: PublicExportEntry[] = [];
  for (const [id, value] of Object.entries(Weasel)) {
    if (value === undefined || value === null) continue;
    if (id === 'default') continue;
    out.push({ kind: 'publicExport', id, label: id });
  }
  return out;
}

/** Tool id → hook name as exported from the kit barrel. Static rather than
 *  reflected: the `ToolDef` carries no hook-name metadata. Kept in lock-step
 *  with the kit's `useXTool` exports. */
export const TOOL_HOOK_NAMES: Readonly<Record<string, string>> = {
  select: 'useSelectTool',
  hand: 'useHandTool',
  resize: 'useResizeTool',
  rotate: 'useRotateTool',
  rect: 'useRectTool',
  ellipse: 'useEllipseTool',
  line: 'useLineTool',
  polygon: 'usePolygonTool',
  star: 'useStarTool',
  pencil: 'usePencilTool',
  lasso: 'useLassoTool',
  text: 'useTextTool',
  clone: 'useCloneTool',
  eyedropper: 'useEyedropperTool',
  // 'wheel-zoom' dissolved in Phase 8.5; handled by viewport.zoom descriptor.
};

/** Shape-kind ids the inspector mirrors from the kit. Sourced from
 *  `Weasel.KIT_SHAPE_KINDS` so adding a new builtin shape tool to the kit
 *  surfaces here automatically (parity-checked by
 *  `src/index.barrel.test.ts`). */
const SHAPE_KIND_IDS: readonly string[] = Weasel.KIT_SHAPE_KINDS;

const PHASE_IDS: readonly PhaseId[] = ['initial', 'engaged'];

export function collectPhases(): readonly PhaseEntry[] {
  return PHASE_IDS.map((id) => ({ kind: 'phase', id, label: id }));
}

/** Tree-leaf badge count: how many other entries reference this one. Used
 *  by `RegistryTree` to render `(n)` next to leaves where the count is
 *  meaningful (e.g. gestures → number of tools binding the channel).
 *  Returns `undefined` for kinds where a count would be 1:1 (icons,
 *  op factories, public exports), noisy (tools, actions), or nonsensical. */
export function countForEntry(
  entry: TreeEntry,
  tools: readonly ToolEntry[],
  actions: readonly ActionEntry[],
): number | undefined {
  switch (entry.kind) {
    case 'bundle':
      return entry.tools.length;
    case 'phase':
      return entry.id === 'initial'
        ? tools.length
        : tools.filter((t) => t.phases.engaged !== undefined).length;
    case 'gesture':
    case 'phaseOutput':
      return tools.filter((t) => t.phases.initial[entry.id] || t.phases.engaged?.[entry.id]).length;
    case 'hotkeyTrigger':
      return tools.filter((t) => t.hotkey === entry.id).length;
    case 'slot':
      return tools.filter((t) => t.slot === entry.id).length;
    case 'routeTarget':
      return tools.filter((t) => t.routes.some((r) => parseRoute(r).target === entry.id)).length;
    case 'modifierSet':
      return tools.filter((t) => t.routes.some((r) => parseRoute(r).modifiers === entry.id)).length;
    case 'group':
      return entry.source === 'tool'
        ? tools.filter((t) => t.presentation?.group === entry.label).length
        : actions.filter((a) => a.group === entry.label).length;
    default:
      return undefined;
  }
}

export function collectPhaseOutputs(): readonly PhaseOutputEntry[] {
  return PHASE_OUTPUT_KEYS.map((id) => ({ kind: 'phaseOutput', id, label: id }));
}

export function collectGestures(): readonly GestureEntry[] {
  return GESTURE_CHANNEL_KEYS.map((id) => ({ kind: 'gesture', id, label: id }));
}

export function collectOpKinds(): readonly OpKindEntry[] {
  return OP_KIND_NAMES.map((id) => ({ kind: 'opKind', id, label: id }));
}

export function collectHotkeyTriggers(): readonly HotkeyTriggerEntry[] {
  return HOTKEY_TRIGGER_KEYS.map((id) => ({ kind: 'hotkeyTrigger', id, label: id }));
}

export function collectSlots(): readonly SlotEntry[] {
  return TOOL_SLOTS.map((id) => ({ kind: 'slot', id, label: id }));
}

/** A parsed route signature. Reverses the `${phase}.${gesture}.${target}[:mods]`
 *  encoding the probe emits, so the inspector can re-group routes along the
 *  target / modifier-set axes without re-walking ToolDefs. */
export interface ParsedRoute {
  phase: string;
  gesture: string;
  target: string;
  modifiers: string;
}

export function parseRoute(route: string): ParsedRoute {
  const [body, mods] = route.split(':');
  const dot1 = body.indexOf('.');
  const dot2 = body.indexOf('.', dot1 + 1);
  return {
    phase: body.slice(0, dot1),
    gesture: body.slice(dot1 + 1, dot2),
    target: body.slice(dot2 + 1),
    modifiers: mods ?? 'default',
  };
}

export function collectRouteTargets(tools: readonly ToolEntry[]): readonly RouteTargetEntry[] {
  const seen = new Set<string>();
  for (const t of tools) for (const r of t.routes) seen.add(parseRoute(r).target);
  return [...seen].sort().map((id) => ({ kind: 'routeTarget', id, label: id }));
}

export function collectModifierSets(tools: readonly ToolEntry[]): readonly ModifierSetEntry[] {
  const seen = new Set<string>();
  for (const t of tools) for (const r of t.routes) seen.add(parseRoute(r).modifiers);
  return [...seen].sort().map((id) => ({ kind: 'modifierSet', id, label: id }));
}

export function collectGroups(
  tools: readonly ToolEntry[],
  actions: readonly ActionEntry[],
): readonly GroupEntry[] {
  const out: GroupEntry[] = [];
  const toolGroups = new Set<string>();
  for (const t of tools) if (t.presentation?.group) toolGroups.add(t.presentation.group);
  for (const g of [...toolGroups].sort()) out.push({ kind: 'group', id: `tool:${g}`, label: g, source: 'tool' });
  const actionGroups = new Set<string>();
  for (const a of actions) if (a.group) actionGroups.add(a.group);
  for (const g of [...actionGroups].sort()) out.push({ kind: 'group', id: `action:${g}`, label: g, source: 'action' });
  return out;
}

export function collectShapeKinds(): readonly ShapeKindEntry[] {
  return SHAPE_KIND_IDS.map((id) => ({
    kind: 'shapeKind',
    id,
    label: id,
    tool: id,
    hookName: TOOL_HOOK_NAMES[id],
  }));
}
