import * as Weasel from '@weasel-js/core';
import { defaultNodeRouting, defaultNodeProperties, type NodeRoutingEntry, type NodePropertiesEntry } from '@weasel-js/core';
import { canonicalModifiers, parseRoute as kitParseRoute, type ParsedRoute as KitParsedRoute } from '@weasel-js/core/routing';
import { type PrefObject, prefSectionLeaves } from '@weasel-js/prefs';
import { ICON_GROUPS, icon } from '../icons.gen';
import {
  type ActionEntry,
  type BundleEntry,
  GESTURE_CATALOG_KEYS,
  type GestureEntry,
  type GroupEntry,
  type IconEntry,
  type MetaEntry,
  type ModifierSetEntry,
  type OpFactoryEntry,
  type OpKindEntry,
  PHASE_OUTPUT_KEYS,
  type PhaseOutputEntry,
  type PropertiesKindEntry,
  type RouteEntry,
  type RouteTargetEntry,
  type RoutingKindEntry,
  type ShapeKindEntry,
  type SlotEntry,
  TOOL_SLOTS,
  type ToolEntry,
  type TreeEntry,
} from './registryEntries';

/** `GestureSpec.kind` -> `GestureChannels` key, for the two that differ
 *  (the channel names avoid the hyphen). */
const GESTURE_KEY_FOR: Readonly<Record<string, string>> = {
  'key-held': 'keyHeld',
  multiTouch: 'multiTouch',
};

export function collectMeta(): readonly MetaEntry[] {
  return [
    { kind: 'meta', id: 'tokens', label: 'Tokens' },
    { kind: 'meta', id: 'sceneNode', label: 'SceneNode' },
  ];
}

// ── Static collectors ──────────────────────────────────────────────────────

/** The glyphs the registered actions carry — what an `<ActionBar>` actually
 *  draws — once each, under their qualified names. */
function collectActionIcons(actions: readonly ActionEntry[]): IconEntry[] {
  const byGlyph = new Map<string, IconEntry & { actions: string[] }>();
  for (const item of actions.flatMap((a) => a.items ?? [])) {
    const ref = item.icon;
    if (ref === undefined) continue;
    const existing = byGlyph.get(ref);
    if (existing) existing.actions.push(item.key);
    else byGlyph.set(ref, { kind: 'icon', id: ref, label: ref, source: 'action', actions: [item.key], ref });
  }
  return [...byGlyph.values()];
}

export function collectIcons(actions: readonly ActionEntry[]): readonly IconEntry[] {
  const out: IconEntry[] = collectActionIcons(actions);
  for (const name of ICON_GROUPS.flatMap((g) => g.names)) {
    const ref = icon(name);
    out.push({ kind: 'icon', id: ref, label: ref, source: 'app', ref });
  }
  return out;
}

/** What each bundle passes as `defaultTools` beside `features={['draw']}`,
 *  which brings select and hand itself. */
export const BUNDLE_DEFAULT_TOOLS: Record<BundleEntry['id'], readonly Weasel.BuiltinToolId[]> = {
  minimal: [],
  // No `pencil`: freehand is a specialist instrument, not part of the
  // everyday shape-drawing set. It stays in `exhaustive`, which means
  // everything.
  standard: ['rect', 'ellipse', 'line'],
  exhaustive: Weasel.BUILTIN_TOOL_IDS,
};

const BUNDLE_LABELS: Record<BundleEntry['id'], string> = {
  minimal: 'Minimal',
  standard: 'Standard',
  exhaustive: 'Exhaustive',
};

export function collectBundles(): readonly BundleEntry[] {
  return (Object.keys(BUNDLE_DEFAULT_TOOLS) as BundleEntry['id'][]).map((id) => ({
    kind: 'bundle',
    id,
    label: BUNDLE_LABELS[id] ?? id,
    tools: [...new Set<string>(['select', 'hand', ...BUNDLE_DEFAULT_TOOLS[id]])],
  }));
}

/** The `createXOp` barrel export behind each registered op kind. The kit
 *  names every factory after its op kind, so the registry drives this list;
 *  the `typeof` guard turns a break in that convention into a missing row
 *  rather than a crash, and `registryData.test.ts` fails when it breaks. */
export function collectOpFactories(): readonly OpFactoryEntry[] {
  return Weasel.registeredOpNames()
    .map((name) => `create${name[0]!.toUpperCase()}${name.slice(1)}Op`)
    .filter((name) => typeof (Weasel as unknown as Record<string, unknown>)[name] === 'function')
    .map((id) => ({ kind: 'opFactory', id, label: id }));
}

/** Shape-kind ids the inspector mirrors from the kit. Sourced from
 *  `Weasel.KIT_SHAPE_KINDS` so adding a new builtin shape tool to the kit
 *  surfaces here automatically (parity-checked by
 *  `src/index.barrel.test.ts`). */
const SHAPE_KIND_IDS: readonly string[] = Weasel.KIT_SHAPE_KINDS;

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
    case 'gesture': {
      // Tool bindings and action `defaultBinding`s both route through the
      // same gesture kinds now, so counting is one pass over each.
      const kind = entry.id;
      const toolCount = tools.filter(
        (t) => (t.surface.gestures as unknown as Record<string, unknown>)[GESTURE_KEY_FOR[kind] ?? kind],
      ).length;
      let actionCount = 0;
      for (const a of actions) {
        const raw = (a as { defaultBinding?: unknown }).defaultBinding;
        if (!raw) continue;
        const entries: unknown[] = Array.isArray(raw) ? raw : [raw];
        for (const e of entries) {
          const obj = e as { spec?: { kind?: string }; kind?: string };
          if ((obj.spec ?? obj).kind === kind) actionCount += 1;
        }
      }
      return toolCount + actionCount;
    }
    case 'phaseOutput':
      return tools.filter((t) => t.surface.outputs[entry.id]).length;
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

/** Op kinds the kit can serialize and rebuild — the stable `name` each op
 *  factory stamps onto its `Op`. Read from the live factory registry so a
 *  newly-registered op appears here without a second list to update. */
export function collectOpKinds(): readonly OpKindEntry[] {
  return Weasel.registeredOpNames().map((id) => ({ kind: 'opKind', id, label: id }));
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
  // An object leaf's fields are what the kind exposes; the leaf itself is
  // the container.
  const leafPaths = (schema: NodePropertiesEntry['schema']): string[] =>
    prefSectionLeaves(schema.members).flatMap(([path, leaf]) =>
      leaf.kind === 'object'
        ? prefSectionLeaves((leaf as PrefObject).children).map(([key]) => `${path}.${key}`)
        : [path],
    );
  return source.map((e) => ({
    kind: 'propertiesKind',
    trait: 'properties',
    id: e.name,
    label: e.name,
    leafPaths: leafPaths(e.schema),
  }));
}
