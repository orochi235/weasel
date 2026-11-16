/**
 * The behavior presets `<SceneCanvas features>` composes. A bare canvas renders
 * its scene, keeps a selection nothing sets, and undoes and redoes whatever
 * changed it; every behavior beyond that is turned on by a preset.
 *
 * A preset is a {@link FeaturePreset} object: the actions, tools, bindings,
 * chrome, and contributions one behavior brings, and the presets it includes.
 * One that holds only actions, tools, and includes is a bundle, pure grouping;
 * one with any other role is an atom, whose parts only work together. Core's
 * own are exported objects (`selectPreset`, `drawPreset`), a package ships its
 * own the same way, and an app passes the objects it imports. Nothing here
 * imports an action, so a canvas reaches only the presets it is handed.
 *
 * A preset is not one of the `packages/core/src/domains/<name>/` source
 * directories that `docs/taxonomy.md` calls a feature; the two share a word
 * and nothing else.
 */
import { setOwn } from '@weasel-js/registry';
import { toolIdsOf, type Action, type ToolEntry } from '@weasel-js/routing';
import { never } from 'domains/chrome-caps/conditions';
import type { ChromeId, VisibilityRules } from 'domains/chrome-caps/types';
import type { MoveBehavior } from 'interactions/gestures/types';
import type { UseMoveOptions } from 'interactions/gestures/moveOptions';
import type { UseRotateOptions } from 'interactions/gestures/rotateOptions';
import type { Contribution, Tool } from 'tools/overlayBinding';
import type { PathEditExtension } from 'domains/paths/pathEditExtension';
import type { SnapSource } from 'domains/snap/types';
import type { SurfaceContribution } from '../surfaceContribution';
import type { CustomLayerEntry } from '../layerSlots';
import type { NodeRoutingEntry } from 'core/scene/NodeRouting';
import type { NodePropertiesEntry } from 'core/scene/NodeProperties';
import type { InsertNodeFactories } from '../deps/insertFactories';
import type { NodeShapeEntry, RegisterNodeShapeOptions } from '../NodeShape';
import type { ContentHandlerEntry } from 'domains/ingestion/contentHandlers';
import type { ComponentType, MutableRefObject } from 'react';
import type { Scene } from 'core/scene/types';
import type { SelectionFactory } from 'core/selection/selectionContract';
import type { SelectionChrome } from '../selectionChrome';
import type { PresetBuildContext } from './presetBuild';

/** What a canvas hands each of its presets' {@link FeaturePreset.components}. */
export interface PresetComponentProps {
  /** The scene the canvas draws. */
  readonly scene: Scene<unknown, string, unknown>;
  /** The canvas element, filled once it mounts. */
  readonly canvasRef: MutableRefObject<HTMLElement | null>;
  /** Whether the canvas paints into an element the host owns (`paintInto`) rather than its own. */
  readonly paintsInto: boolean;
  /** What a preset's `build` is handed, for a component publishing what the canvas reads live. */
  readonly canvas: PresetBuildContext;
}

/** A shape painter a preset installs, with the tier it registers in. */
export interface PresetNodeShape {
  readonly painter: NodeShapeEntry<never, never>;
  readonly priority?: RegisterNodeShapeOptions['priority'];
}

/** What a preset's {@link FeaturePreset.build} returns: the parts it makes from the canvas it runs on. */
export interface PresetBuild {
  /**
   * Tools it offers, by id. One is mounted when a preset's `tools` names its id (alone or in a set), when
   * `<SceneCanvas defaultTools>` does, or when a `tools` patch sets it `true`; a tool offered and named by nobody
   * is not. Between presets offering one id, the later preset's wins.
   */
  readonly tools?: Readonly<Record<string, Tool>>;
  /** Entries installed as {@link FeaturePreset.contributions} are, after them. */
  readonly contributions?: readonly SurfaceContribution[];
}

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
  /** Actions it brings for tools: each registers only when a tool or binding on the canvas names it, so a tool
   *  this preset offers works whichever presets mount it, and a canvas that mounts none registers none. */
  readonly toolActions?: readonly Action[];
  /** Tools it mounts: a built-in by id or a set of them, or a tool of its own. */
  readonly tools?: readonly (ToolEntry<string> | Tool)[];
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
  /**
   * Node kinds it teaches the canvas, one trait per field, each handed to the
   * trait's owner while the preset is on. `routing` classifies nodes ahead of
   * the canvas's own `routing` (or `inferredNodeRouting`); `insertNodeFactories`
   * builds the inserts its kinds name; `shapes` paint and pick them, registered
   * in the canvas's scene's own registry (`nodeShapesOf(scene)`) for as long as
   * the canvas runs the preset, so another scene does not paint with them;
   * `properties` is what a `SelectionPanel` given the same presets edits.
   *
   * Precedence: a name the consumer's own prop gives (`routing`,
   * `insertNodeFactories`, `SelectionPanel`'s `properties`) keeps the
   * consumer's. Between presets, the same value under one name is one entry,
   * and a different value throws. See `nodeTraitsOf`.
   */
  readonly routing?: readonly NodeRoutingEntry[];
  readonly insertNodeFactories?: InsertNodeFactories;
  /** Insert kinds its `insert` dep builds with no factory: a tool inserting only kinds no factory and no
   *  preset builds is left off the canvas. */
  readonly insertKinds?: readonly string[];
  readonly shapes?: readonly (NodeShapeEntry<never, never> | PresetNodeShape)[];
  readonly properties?: readonly NodePropertiesEntry[];
  /** Entries installed beside `<SceneCanvas ambient>`, with every role they
   *  declare: deps, overlays, `attach`, views, frame hooks. A `tools` takeover
   *  brings its own ambient and leaves them out. */
  readonly contributions?: readonly SurfaceContribution[];
  /** Components the canvas renders inside itself while the preset is on, after its own deps and before its
   *  children: for a part that needs React and the mounted canvas, such as an editing overlay. A dep one
   *  publishes sits over the canvas's own and under any its children publish. */
  readonly components?: readonly ComponentType<PresetComponentProps>[];
  /** Content handlers ingestion tries after the canvas's own `ingestion.handlers` and the kit's. */
  readonly contentHandlers?: readonly ContentHandlerEntry[];
  /**
   * The parts it makes from the canvas it runs on: tools it offers by id, and contributions. Not a hook: the
   * canvas calls it once per canvas and preset, and again only when `toolOptions` changes; everything else the
   * context gives is read live through it.
   */
  readonly build?: (ctx: PresetBuildContext) => PresetBuild;
  /**
   * What builds the canvas's own selection: the api its tools and actions write through, over the scene's
   * selection store. One per canvas; two presets with different factories throw. With none the canvas keeps a
   * selection no input writes, and `<SceneCanvas selection>` replaces whichever it would build.
   */
  readonly selection?: SelectionFactory;
  /** What draws the canvas's selection chrome, the `selectionOverlay` slot, and says where a press grabs it. One
   *  per canvas; two presets with different ones throw. With none the slot paints nothing and no handle is grabbed. */
  readonly selectionChrome?: SelectionChrome;
  /** Ids of presets whose actions, and those of every preset they include,
   *  this one's register ahead of, so that where both bind one gesture, this
   *  one's is tried first: anchor nudging ahead of node nudging. A preset named
   *  here that is not on is ignored. */
  readonly refines?: readonly string[];
  /** Presets it turns on with itself, ahead of its own place in the order. */
  readonly includes?: readonly FeaturePreset[];
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
  /** Their components, each once, in order. */
  readonly components: readonly ComponentType<PresetComponentProps>[];
  /** Their tool actions, each once, in order. */
  readonly toolActions: readonly Action[];
  /** The insert kinds they build with no factory. */
  readonly insertKinds: ReadonlySet<string>;
  /** Their content handlers, in order. */
  readonly contentHandlers: readonly ContentHandlerEntry[];
  /** Their `build`s, in order, each once. */
  readonly builds: readonly NonNullable<FeaturePreset['build']>[];
  /** The one selection factory they give, if any. */
  readonly selection: SelectionFactory | undefined;
  /** The one selection chrome they give, if any. */
  readonly selectionChrome: SelectionChrome | undefined;
  /** Whether a preset with this id is on. */
  has(id: string): boolean;
}

/**
 * The presets a canvas runs with: `includes` pulled in, each preset once, and
 * every one placed ahead of the presets it `refines` and what those include.
 * Ties keep the order given. Nothing is implied: a `viewport` config without
 * `viewPreset` turns no navigation on.
 *
 * `selectRotates: false` is `selectTool.rotate === false`: every preset keeps
 * its actions, but loses its ambient `rotate` bindings and the rotation handle
 * from its chrome, which hides the handle unless a consumer rule shows it.
 */
export function resolveFeatures(
  features: readonly FeaturePreset[] | undefined,
  opts: { selectRotates?: boolean } = {},
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
    if (typeof f === 'string') {
      throw new Error(`[SceneCanvas] features takes preset objects, not names; pass the preset for "${f as string}" or namedFeatures("${f as string}") from @weasel-js/editing`);
    }
    add(f);
  }

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
    components: [...new Set(presets.flatMap((p) => p.components ?? []))],
    toolActions: [...new Set(presets.flatMap((p) => p.toolActions ?? []))],
    insertKinds: new Set(presets.flatMap((p) => p.insertKinds ?? [])),
    contentHandlers: presets.flatMap((p) => p.contentHandlers ?? []),
    builds: [...new Set(presets.flatMap((p) => (p.build ? [p.build] : [])))],
    selection: oneOf(presets, 'selection', 'build the canvas\'s selection'),
    selectionChrome: oneOf(presets, 'selectionChrome', 'draw the selection chrome'),
    has: (id) => byId.has(id),
  };
}

/** The one value `presets` give for `role`, or undefined; two presets giving different ones throw. */
function oneOf<K extends 'selection' | 'selectionChrome'>(
  presets: readonly FeaturePreset[], role: K, what: string,
): FeaturePreset[K] | undefined {
  let found: { id: string; value: NonNullable<FeaturePreset[K]> } | undefined;
  for (const p of presets) {
    const value = p[role];
    if (!value || found?.value === value) continue;
    if (found) throw new Error(`[SceneCanvas] presets "${found.id}" and "${p.id}" both ${what}`);
    found = { id: p.id, value };
  }
  return found?.value;
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
export const namesBuiltins = (t: ToolEntry<string> | Tool): t is ToolEntry<string> =>
  typeof t === 'string' || 'members' in t;

/** The ids of the tools `preset` mounts itself: built-ins with their sets opened, then tools of its own. */
export const presetToolIds = (preset: FeaturePreset): string[] => {
  const tools = preset.tools ?? [];
  return [...toolIdsOf(tools.filter(namesBuiltins)), ...tools.filter((t): t is Tool => !namesBuiltins(t)).map((t) => t.id)];
};

/** The offered tool ids the given presets mount, by id or set. */
export function presetBuiltinTools(enabled: EnabledPresets): Set<string> {
  const ids = new Set<string>();
  for (const p of enabled.presets) {
    for (const id of toolIdsOf((p.tools ?? []).filter(namesBuiltins))) ids.add(id);
  }
  return ids;
}

/** The tools of their own the given presets mount, by id. */
export function presetOwnTools(enabled: EnabledPresets): Record<string, Tool> {
  const out: Record<string, Tool> = {};
  for (const p of enabled.presets) for (const t of p.tools ?? []) if (!namesBuiltins(t)) setOwn(out, t.id, t);
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
