/**
 * The behavior presets `<SceneCanvas features>` composes. A bare canvas renders
 * its scene, keeps a selection nothing sets, and undoes and redoes whatever
 * changed it; every behavior beyond that is turned on by a preset.
 *
 * A preset is a {@link FeaturePreset} object: the actions, tools, bindings,
 * chrome, and contributions one behavior brings, and the presets it includes.
 * One that holds only actions, tools, and includes is a bundle, pure grouping;
 * one with any other role is an atom, whose parts only work together. Core's
 * own are named (`'select'`, `'draw'`) and live in `namedPresets.ts`; a
 * package ships its own the same way and an app passes the object. Nothing
 * here imports an action, so a canvas reaches only the presets it is handed.
 *
 * A preset is not one of the `packages/core/src/domains/<name>/` source
 * directories that `docs/taxonomy.md` calls a feature; the two share a word
 * and nothing else.
 */
import { toolIdsOf, type Action, type ToolEntry } from '@weasel-js/routing';
import { never } from 'domains/chrome-caps/conditions';
import type { ChromeId, VisibilityRules } from 'domains/chrome-caps/types';
import type { MoveBehavior } from 'interactions/gestures/types';
import type { UseMoveOptions } from 'interactions/actions/move/options';
import type { UseRotateOptions } from 'interactions/actions/rotate/options';
import type { Contribution, Tool } from 'tools/overlayBinding';
import type { PathEditExtension } from 'domains/paths/pathEditExtension';
import type { SnapSource } from 'domains/snap/types';
import type { SurfaceContribution } from '../surfaceContribution';
import type { CustomLayerEntry } from '../layerSlots';
import type { BuiltinToolId } from './props';

/** Every core preset's name `<SceneCanvas features>` accepts, each after the
 *  presets it includes. */
export const SCENE_CANVAS_FEATURES = [
  'tools:select', 'tools:view', 'tools:shape', 'tools:draw', 'tools:type', 'tools:page',
  'view', 'select', 'outline', 'pick', 'move', 'resize', 'rotate', 'transform',
  'escape', 'contextMenu', 'selectAll', 'duplicate', 'delete', 'group', 'nudge', 'style', 'clipboard', 'edit',
  'flip', 'reorder', 'align', 'distribute', 'arrange',
  'anchorKeys', 'pathfinder', 'outlines', 'pathEdit', 'pathCommands', 'paths',
  'ingest', 'draw',
] as const;

/** A core preset's name, as `<SceneCanvas features>` takes it. */
export type Feature = (typeof SCENE_CANVAS_FEATURES)[number];

/** What a preset's ambient bindings are built from: the `selectTool` options
 *  that configure them. */
export interface FeatureBindingOptions {
  move?: UseMoveOptions<unknown>;
  rotate?: UseRotateOptions<unknown>;
}

/**
 * Everything turning one preset on means. Every role is optional.
 *
 * A package's preset is the unit an app opts into: the app imports it and
 * passes it to `features`, and an app that does not never loads its code.
 */
export interface FeaturePreset {
  /** What a person calls it, where one is listed. Absent, the id. */
  readonly label?: string;
  /** Unique per canvas. `refines` names presets by it, and two different
   *  presets with one id on one canvas throw. */
  readonly id: string;
  /** The action descriptors it registers, in the order they register. They
   *  are standard actions: `<SceneCanvas actions>` overrides and mutes them,
   *  and `tune` reaches them. */
  readonly actions?: readonly Action[];
  /** Tools it mounts: a built-in by id or a set of them, or a tool of its own. */
  readonly tools?: readonly (ToolEntry<BuiltinToolId> | Tool)[];
  /** Its ambient bindings: an always-live entry routing a gesture to its
   *  actions under any tool that does not claim the gesture itself. */
  readonly ambient?: (options: FeatureBindingOptions) => Contribution;
  /** Behaviors folded into every move the presets' ambient bindings run,
   *  after the select tool's own: a snap, a readout of the drag. They reach
   *  only a move some enabled preset binds, `move` or `draw`'s. */
  readonly moveBehaviors?: readonly MoveBehavior<unknown>[];
  /** Snap sources every snap session on the canvas asks, after
   *  `<SceneCanvas snap.sources>` and the presets before it. */
  readonly snapSources?: readonly SnapSource[];
  /** Layers it adds to the render stack, by slot, as `<SceneCanvas layers>`
   *  takes them: `grid` fills the grid slot, any other key adds a layer. A
   *  slot `<SceneCanvas layers>` names, `null` included, keeps the consumer's. */
  readonly layers?: Readonly<Record<string, CustomLayerEntry>>;
  /** The selection chrome that is drawn, and can be grabbed, only while it is on. */
  readonly chrome?: readonly ChromeId[];
  /** Default chrome-caps rules for chrome of its own, under the consumer's
   *  `chromeVisibility`: a mark it draws only on request, say. */
  readonly chromeRules?: VisibilityRules;
  /** What it adds to path edit: marks, grabbable parts, what an edit keeps
   *  true. Consulted in preset order. */
  readonly pathEdit?: readonly PathEditExtension[];
  /** Entries installed beside `<SceneCanvas ambient>`, with every role they
   *  declare: deps, overlays, `attach`, views, frame hooks. A `tools` takeover
   *  brings its own ambient and leaves them out. */
  readonly contributions?: readonly SurfaceContribution[];
  /** Ids of presets whose actions, and those of every preset they include,
   *  this one's register ahead of, so that where both bind one gesture, this
   *  one's is tried first: anchor nudging ahead of node nudging. A preset named
   *  here that is not on is ignored. */
  readonly refines?: readonly string[];
  /** Presets it turns on with itself, ahead of its own place in the order. */
  readonly includes?: readonly FeaturePreset[];
}

/** What `<SceneCanvas features>` takes: a core preset's name or any preset. */
export type FeatureEntry = Feature | FeaturePreset;

/** The names a canvas resolves, each to its preset. */
export type NamedPresets = Readonly<Record<string, FeaturePreset>>;

/** Where a canvas finds presets beyond the objects it is handed: the names it
 *  resolves, if any, and the actions it registers once a tool binds them. */
export interface PresetSource {
  readonly named: NamedPresets | null;
  /** Actions every canvas registers whatever its presets: undo and redo, since anything that changes
   *  the scene — a preset's action, a tool, the host — leaves history to step through. */
  readonly baseline?: readonly Action[];
  /** Actions registered only when a tool or contribution binds them. */
  readonly pool: readonly Action[];
}

/** The presets a canvas runs with, in the order their actions register. */
export interface EnabledPresets {
  readonly presets: readonly FeaturePreset[];
  /** Their path-edit extensions, in order. */
  readonly pathEdit: readonly PathEditExtension[];
  /** Their snap sources, in order. */
  readonly snapSources: readonly SnapSource[];
  /** Their layers by slot; a later preset's wins a slot both name. */
  readonly layers: Readonly<Record<string, CustomLayerEntry>>;
  /** Whether a preset with this id is on. */
  has(id: string): boolean;
}

/**
 * The presets a canvas runs with: names expanded, `includes` pulled in, each
 * preset once, and every one placed ahead of the presets it `refines` and what those include. Ties
 * keep the order given. Where names resolve, a `viewport` config turns on the
 * `view` preset, since that prop only configures what `view` turns on.
 *
 * `selectRotates: false` is `selectTool.rotate === false`: every preset keeps
 * its actions, but loses its ambient `rotate` bindings and the rotation handle
 * from its chrome, which hides the handle unless a consumer rule shows it.
 */
export function resolveFeatures(
  features: readonly FeatureEntry[] | undefined,
  named: NamedPresets | null,
  opts: { viewport?: boolean; selectRotates?: boolean } = {},
): EnabledPresets {
  const listed: FeaturePreset[] = [];
  const byId = new Map<string, FeaturePreset>();
  const add = (p: FeaturePreset): void => {
    const held = byId.get(p.id);
    if (held === p) return;
    if (held) throw new Error(`[SceneCanvas] two different presets have the id "${p.id}"`);
    byId.set(p.id, p);
    for (const inner of p.includes ?? []) add(inner);
    listed.push(p);
  };
  for (const f of features ?? []) {
    if (typeof f !== 'string') add(f);
    else if (!named) throw new Error(`[SceneCanvas] this canvas resolves no preset names; pass the preset for "${f}"`);
    else if (!Object.hasOwn(named, f)) throw new Error(`[SceneCanvas] no preset is named "${f}"`);
    else add(named[f]!);
  }
  if (opts.viewport && named?.view) add(named.view);

  // Each preset's id and the ids of every preset that includes it, at any depth: what a refinement of it can name.
  const parents = new Map<string, string[]>();
  for (const p of listed) for (const inner of p.includes ?? []) parents.set(inner.id, [...(parents.get(inner.id) ?? []), p.id]);
  const namesFor = (id: string, out = new Set<string>()): Set<string> => {
    if (out.has(id)) return out;
    out.add(id);
    for (const up of parents.get(id) ?? []) namesFor(up, out);
    return out;
  };
  const ordered: FeaturePreset[] = [];
  const placed = new Set<string>();
  const place = (p: FeaturePreset): void => {
    if (placed.has(p.id)) return;
    placed.add(p.id);
    const names = namesFor(p.id);
    for (const r of listed) if (r.refines?.some((id) => names.has(id))) place(r);
    ordered.push(p);
  };
  for (const p of listed) place(p);
  const presets = opts.selectRotates === false ? ordered.map(withoutSelectRotate) : ordered;
  return {
    presets,
    pathEdit: presets.flatMap((p) => p.pathEdit ?? []),
    snapSources: presets.flatMap((p) => p.snapSources ?? []),
    layers: Object.assign({}, ...presets.map((p) => p.layers ?? {})) as Record<string, CustomLayerEntry>,
    has: (id) => byId.has(id),
  };
}

const ROTATION_HANDLE: ChromeId = 'selection.rotation-handle';

/** `p` without its ambient `rotate` bindings or the rotation handle. */
function withoutSelectRotate(p: FeaturePreset): FeaturePreset {
  const { ambient, chrome } = p;
  if (!ambient && !chrome?.includes(ROTATION_HANDLE)) return p;
  return {
    ...p,
    ...(ambient ? {
      ambient: (o: FeatureBindingOptions): Contribution => {
        const c = ambient(o);
        return c.bindings ? { ...c, bindings: c.bindings.filter((b) => b.actionId !== 'rotate') } : c;
      },
    } : {}),
    ...(chrome ? { chrome: chrome.filter((id) => id !== ROTATION_HANDLE) } : {}),
  };
}

/** The actions the given presets register, in registration order. */
export function presetActions(enabled: EnabledPresets): Action[] {
  return enabled.presets.flatMap((p) => p.actions ?? []);
}

/** Whether a preset's `tools` entry names built-ins, by id or set, rather than being a tool of its own. */
export const namesBuiltins = (t: ToolEntry<BuiltinToolId> | Tool): t is ToolEntry<BuiltinToolId> =>
  typeof t === 'string' || 'members' in t;

/** The ids of the tools `preset` mounts itself: built-ins with their sets opened, then tools of its own. */
export const presetToolIds = (preset: FeaturePreset): string[] => {
  const tools = preset.tools ?? [];
  return [...toolIdsOf(tools.filter(namesBuiltins)), ...tools.filter((t): t is Tool => !namesBuiltins(t)).map((t) => t.id)];
};

/** The built-in tool ids the given presets mount. */
export function presetBuiltinTools(enabled: EnabledPresets): Set<BuiltinToolId> {
  const ids = new Set<BuiltinToolId>();
  for (const p of enabled.presets) {
    for (const id of toolIdsOf((p.tools ?? []).filter(namesBuiltins))) ids.add(id);
  }
  return ids;
}

/** The tools of their own the given presets mount, by id. */
export function presetOwnTools(enabled: EnabledPresets): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const p of enabled.presets) for (const t of p.tools ?? []) if (!namesBuiltins(t)) out[t.id] = t;
  return out;
}

/** The given presets' ambient entries and contributions, in the order they are
 *  matched. Their `moveBehaviors` follow the ones `options.move` brings. */
export function presetAmbient(enabled: EnabledPresets, options: FeatureBindingOptions): Contribution[] {
  const extra = enabled.presets.flatMap((p) => p.moveBehaviors ?? []);
  const move = extra.length === 0
    ? options.move
    : { ...options.move, behaviors: [...(options.move?.behaviors ?? []), ...extra] };
  const opts = { ...options, move };
  return enabled.presets.flatMap((p) => (p.ambient ? [p.ambient(opts)] : []));
}

/** The given presets' contributions, in preset order. */
export function presetContributions(enabled: EnabledPresets): SurfaceContribution[] {
  return enabled.presets.flatMap((p) => p.contributions ?? []);
}

/** The enabled presets' own `chromeRules`, then rules hiding each chrome id
 *  in `owned` that no enabled preset turns on. `never` also takes a handle out
 *  of hit-testing, so a hidden one cannot be grabbed. */
export function presetChromeRules(enabled: EnabledPresets, owned: readonly ChromeId[]): VisibilityRules {
  const on = new Set(enabled.presets.flatMap((p) => p.chrome ?? []));
  const rules: VisibilityRules = Object.assign({}, ...enabled.presets.map((p) => p.chromeRules ?? {}));
  for (const id of owned) if (!on.has(id)) rules[id] = never;
  return rules;
}
