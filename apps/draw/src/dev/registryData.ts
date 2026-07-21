import type { ComponentType } from 'react';
import * as Weasel from '@weasel-js/core';
import { defaultNodeRouting, defaultNodeProperties, type NodeRoutingEntry, type NodePropertiesEntry, type ToolPrefGroup } from '@weasel-js/core';
import { canonicalModifiers, parseRoute as kitParseRoute, type ParsedRoute as KitParsedRoute } from '@weasel-js/core/routing';
import * as ActionIcons from '../actionIcons';
import * as KindIcons from '../kindIcons';

/** Discriminated leaf entry. One of these per row in the tree's right pane. */
export type TreeEntry =
  | ToolEntry
  | ActionEntry
  | ShapeKindEntry
  | RoutingKindEntry
  | PropertiesKindEntry
  | BundleEntry
  | IconEntry
  | OpFactoryEntry
  | PhaseEntry
  | GestureEntry
  | PhaseOutputEntry
  | OpKindEntry
  | SlotEntry
  | RouteTargetEntry
  | RouteEntry
  | ModifierSetEntry
  | GroupEntry
  | MetaEntry;

/** Gesture channels — input events a `ToolDef`'s phase *subscribes to*.
 *  `true` when the phase declares the channel (e.g. `initial.click`). */
export interface GestureChannels {
  click: boolean;
  pointerDown: boolean;
  dblTap: boolean;
  drag: boolean;
  wheel: boolean;
  keyDown: boolean;
  keyUp: boolean;
}

/** Phase outputs — things a `ToolDef`'s phase *declares or emits* rather
 *  than reacting to. Distinct from gestures and kept partitioned to avoid
 *  the "subscribing tools" framing misrepresenting them. */
export interface PhaseOutputs {
  cursor: boolean;
  overlay: boolean;
  claimsAll: boolean;
}

/** Full summary of a single phase. Always split into the two partitions. */
export interface PhaseSummary {
  gestures: GestureChannels;
  outputs: PhaseOutputs;
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
  /** Source-linked callbacks discovered on the live ToolDef — empty when
   *  the dev `weasel:callback-source` plugin isn't active (e.g. prod
   *  builds). Inspector renders these as "open in editor" links. */
  callbacks?: readonly CallbackRef[];
}

export interface ActionEntry {
  kind: 'action';
  id: string;
  label: string;
  /** Per-glyph display chips for the action's default `KeyBinding`, ready
   *  for the shared `<Keycaps>` component. `undefined` when the action has
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

export interface RoutingKindEntry {
  kind: 'routingKind';
  trait: 'routing';
  id: string;          // the kind name
  label: string;       // = name (NodeRoutingEntry v1 has no separate display label)
  /** Provenance of this entry. `'default'` = present in `defaultNodeRouting`
   *  with the same `matches` reference. `'override'` = name present in
   *  defaults but `matches` differs (consumer replaced it). `'consumer'`
   *  = name not in defaults. */
  source: 'default' | 'consumer' | 'override';
  /** Cross-link to the matching `ShapeKindEntry` when one exists (same
   *  name). Set for built-in shapes; absent for non-shape node kinds. */
  shapeKindId?: string;
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
 *  Strictly typed against `GestureChannels` so phase outputs can't sneak in. */
export const GESTURE_CHANNEL_KEYS: readonly (keyof GestureChannels)[] = [
  'click', 'pointerDown', 'dblTap', 'drag', 'wheel',
  'keyDown', 'keyUp',
];

/** Catalog entries for the inspector. Includes both legacy
 *  `GestureChannels` keys (used by phase-grammar tools) and the modern
 *  `GestureSpec.kind` values (used by action `defaultBinding`s). Listing
 *  both lets the inspector surface every binding source on a single
 *  catalog page. */
export const GESTURE_CATALOG_KEYS: readonly string[] = [
  // Legacy phase channels:
  'click', 'pointerDown', 'dblTap', 'drag', 'wheel',
  'keyDown', 'keyUp',
  // Modern action-spec kinds the legacy list doesn't cover:
  'doubleClick', 'key', 'key-held', 'multiTouch', 'multiTouchTap', 'pointerdown',
];

/** Non-gesture `PhaseDef` slots — the tool emits/declares these rather than
 *  reacting to them. Strictly typed against `PhaseOutputs`. */
export const PHASE_OUTPUT_KEYS: readonly (keyof PhaseOutputs)[] = [
  'cursor', 'overlay', 'claimsAll',
];

export interface GestureEntry {
  kind: 'gesture';
  /** Either a legacy `GestureChannels` key (phase grammar) or a modern
   *  `GestureSpec.kind` value (action grammar). Strictly typed via a
   *  union of both vocabularies so the inspector can surface every
   *  binding source on the catalog page. */
  id: string;
  label: string;
}

export interface PhaseOutputEntry {
  kind: 'phaseOutput';
  id: keyof PhaseOutputs;
  label: string;
}

/** Stable name stamped onto an `Op` by its factory — the runtime
 *  discriminant the op-factory registry uses for serialize/restore. Mirrors
 *  the names registered in `src/core/ops/*.ts`. */
export const OP_KIND_NAMES: readonly string[] = [
  'insert', 'delete', 'transform', 'reparent', 'setSelection', 'setText', 'setPath',
];

export interface OpKindEntry { kind: 'opKind'; id: string; label: string }


/** Mounting slot for a tool — `registry` covers active/hotkey routing,
 *  `ambient` is the always-on slot (resize / rotate / wheel-zoom). */
export const TOOL_SLOTS: readonly ToolEntry['slot'][] = ['registry', 'ambient'];

export interface SlotEntry { kind: 'slot'; id: ToolEntry['slot']; label: string }

export interface RouteTargetEntry { kind: 'routeTarget'; id: string; label: string }

export interface RouteEntry { kind: 'route'; id: string; label: string }

export interface ModifierSetEntry { kind: 'modifierSet'; id: string; label: string }

export interface GroupEntry {
  kind: 'group';
  id: string;
  label: string;
  /** Where the group label was sourced — palette presentation groups vs
   *  action-registry groups occupy separate namespaces but share a list. */
  source: 'tool' | 'action';
}

export interface MetaEntry { kind: 'meta'; id: 'tokens' | 'sceneNode'; label: string }

export function collectMeta(): readonly MetaEntry[] {
  return [
    { kind: 'meta', id: 'tokens', label: 'Tokens' },
    { kind: 'meta', id: 'sceneNode', label: 'SceneNode' },
  ];
}

export type TreeCategory =
  | 'tools' | 'actions' | 'shape' | 'routing' | 'properties' | 'bundles'
  | 'icons' | 'ops'
  | 'phases' | 'gestures' | 'phaseOutputs'
  | 'slots' | 'routes' | 'routeTargets' | 'modifierSets' | 'groups'
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
 *  op factories), noisy (tools, actions), or nonsensical. */
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
    case 'gesture': {
      // Count both phase-grammar subscribers (legacy channels on tool
      // PhaseDefs) AND action bindings (modern dispatcher) so the sidebar
      // reflects every source of bindings.
      const legacyAliases: Readonly<Record<string, readonly string[]>> = {
        click: ['click'], pointerDown: ['pointerDown'], dblTap: ['dblTap'],
        drag: ['drag'], wheel: ['wheel'], keyDown: ['keyDown'], keyUp: ['keyUp'],
        doubleClick: ['dblTap'], key: ['keyDown', 'keyUp'], pointerdown: ['pointerDown'],
      };
      const specAliases: Readonly<Record<string, readonly string[]>> = {
        click: ['click'], pointerDown: ['pointerdown'], dblTap: ['doubleClick'],
        drag: ['drag'], wheel: ['wheel'], keyDown: ['key', 'key-held'], keyUp: [],
        doubleClick: ['doubleClick'], key: ['key'], 'key-held': ['key-held'],
        multiTouch: ['multiTouch'], multiTouchTap: ['multiTouchTap'], pointerdown: ['pointerdown'],
      };
      const channels = legacyAliases[entry.id] ?? [];
      const specKinds = new Set(specAliases[entry.id] ?? []);
      const toolCount = tools.filter((t) => {
        const init = t.phases.initial.gestures as unknown as Record<string, unknown>;
        const eng = (t.phases.engaged?.gestures ?? {}) as unknown as Record<string, unknown>;
        return channels.some((c) => init[c] || eng[c]);
      }).length;
      let actionCount = 0;
      for (const a of actions) {
        const raw = (a as { defaultBinding?: unknown }).defaultBinding;
        if (!raw) continue;
        const entries: unknown[] = Array.isArray(raw) ? raw : [raw];
        for (const e of entries) {
          const obj = e as { spec?: { kind?: string }; kind?: string };
          const k = (obj.spec ?? obj).kind;
          if (typeof k === 'string' && specKinds.has(k)) actionCount += 1;
        }
      }
      return toolCount + actionCount;
    }
    case 'phaseOutput':
      return tools.filter((t) =>
        t.phases.initial.outputs[entry.id] || t.phases.engaged?.outputs[entry.id]
      ).length;
    case 'slot':
      return tools.filter((t) => t.slot === entry.id).length;
    case 'route':
      return tools.filter((t) => t.routes.includes(entry.id)).length;
    case 'routeTarget':
      return tools.filter((t) => t.routes.some((r) => parseRoute(r).target === entry.id)).length;
    case 'modifierSet':
      return tools.filter((t) => t.routes.some((r) => {
        const canonical = canonicalModifiers(parseRoute(r).modifiers) || 'default';
        return canonical === entry.id;
      })).length;
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
  return GESTURE_CATALOG_KEYS.map((id) => ({ kind: 'gesture', id, label: id }));
}

export function collectOpKinds(): readonly OpKindEntry[] {
  return OP_KIND_NAMES.map((id) => ({ kind: 'opKind', id, label: id }));
}

export function collectSlots(): readonly SlotEntry[] {
  return TOOL_SLOTS.map((id) => ({ kind: 'slot', id, label: id }));
}

/** Re-exported from the kit's v2 route grammar.
 *  See `src/tools/routing/routeGrammar.ts`. */
export type ParsedRoute = KitParsedRoute;
export const parseRoute = kitParseRoute;

export function collectRoutes(tools: readonly ToolEntry[]): readonly RouteEntry[] {
  const seen = new Set<string>();
  for (const t of tools) for (const r of t.routes) seen.add(r);
  return [...seen].sort().map((id) => ({ kind: 'route', id, label: id }));
}

export function collectRouteTargets(tools: readonly ToolEntry[]): readonly RouteTargetEntry[] {
  const seen = new Set<string>();
  for (const t of tools) {
    for (const r of t.routes) {
      const target = parseRoute(r).target;
      if (target !== undefined) seen.add(target);
    }
  }
  return [...seen].sort().map((id) => ({ kind: 'routeTarget', id, label: id }));
}

export function collectModifierSets(tools: readonly ToolEntry[]): readonly ModifierSetEntry[] {
  const seen = new Set<string>();
  for (const t of tools) for (const r of t.routes) {
    const canonical = canonicalModifiers(parseRoute(r).modifiers) || 'default';
    seen.add(canonical);
  }
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

export function collectShapeTrait(
  tools: readonly ToolEntry[] = [],
): readonly ShapeKindEntry[] {
  const hookByToolId = new Map<string, string>();
  for (const t of tools) if (t.hookName) hookByToolId.set(t.id, t.hookName);
  return SHAPE_KIND_IDS.map((id) => ({
    kind: 'shapeKind',
    trait: 'shape',
    id,
    label: id,
    tool: id,
    hookName: hookByToolId.get(id),
  }));
}

export function collectRoutingTrait(
  live?: readonly NodeRoutingEntry[],
): readonly RoutingKindEntry[] {
  const shapeKindSet = new Set<string>(SHAPE_KIND_IDS);

  // If no live registry was supplied, every default entry is 'default'.
  if (!live) {
    return defaultNodeRouting.map((k) => ({
      kind: 'routingKind',
      trait: 'routing',
      id: k.name,
      label: k.name,
      source: 'default',
      ...(shapeKindSet.has(k.name) ? { shapeKindId: k.name } : {}),
    }));
  }

  // With a live registry, classify each entry by source.
  const out: RoutingKindEntry[] = [];
  const liveByName = new Map<string, NodeRoutingEntry>();
  for (const k of live) liveByName.set(k.name, k);

  // Defaults first, in their declared order.
  for (const def of defaultNodeRouting) {
    const liveEntry = liveByName.get(def.name);
    let source: RoutingKindEntry['source'];
    if (!liveEntry) source = 'default';                       // not registered live but still part of defaults; surface as 'default'
    else if (liveEntry.matches === def.matches) source = 'default';
    else source = 'override';
    out.push({
      kind: 'routingKind',
      trait: 'routing',
      id: def.name,
      label: def.name,
      source,
      ...(shapeKindSet.has(def.name) ? { shapeKindId: def.name } : {}),
    });
  }

  // Consumer-only kinds at the end.
  const defaultNames = new Set(defaultNodeRouting.map((k) => k.name));
  for (const liveK of live) {
    if (defaultNames.has(liveK.name)) continue;
    out.push({
      kind: 'routingKind',
      trait: 'routing',
      id: liveK.name,
      label: liveK.name,
      source: 'consumer',
      ...(shapeKindSet.has(liveK.name) ? { shapeKindId: liveK.name } : {}),
    });
  }

  return out;
}

export function collectPropertiesTrait(
  live?: readonly NodePropertiesEntry[],
): readonly PropertiesKindEntry[] {
  const source = live ?? defaultNodeProperties;
  const flattenPaths = (group: ToolPrefGroup): string[] =>
    Object.entries(group.children).flatMap(([key, child]) =>
      'kind' in child ? [key] : flattenPaths(child),
    );
  return source.map((e) => ({
    kind: 'propertiesKind',
    trait: 'properties',
    id: e.name,
    label: e.name,
    leafPaths: flattenPaths(e.schema),
  }));
}
