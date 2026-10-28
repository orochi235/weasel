import * as Weasel from '@weasel-js/core';
import { defaultNodeProperties, type NodePropertiesEntry } from '@weasel-js/core';
import { parseRoute as kitParseRoute, type ParsedRoute as KitParsedRoute } from '@weasel-js/core/routing';
import { type PrefObject, prefSectionLeaves } from '@weasel-js/prefs';
import { ICON_GROUPS, icon } from '../icons.gen';
import {
  type ActionEntry,
  type BundleEntry,
  GESTURE_CATALOG_KEYS,
  type GestureEntry,
  type IconEntry,
  type MetaEntry,
  type OpFactoryEntry,
  type OpKindEntry,
  PHASE_OUTPUT_KEYS,
  type PhaseOutputEntry,
  type PropertiesKindEntry,
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

/** Core's named presets, in the order `SCENE_CANVAS_FEATURES` lists them, each with the tools its includes mount. */
export function collectBundles(): readonly BundleEntry[] {
  const described = Weasel.describePresets({ '@weasel-js/core': Object.values(Weasel.FEATURE_PRESETS) });
  const byId = new Map(described.map((d) => [d.id, d]));
  const toolsOf = (id: string): string[] => {
    const d = byId.get(id)!;
    return [...new Set([...d.includes.flatMap(toolsOf), ...d.tools])];
  };
  return Weasel.SCENE_CANVAS_FEATURES.map((id) => {
    const d = byId.get(id)!;
    return { kind: 'bundle', id, label: d.label, atom: d.atom, tools: toolsOf(id), includes: d.includes };
  });
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
 *  by the inspector to render `(n)` next to leaves where the count is
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
