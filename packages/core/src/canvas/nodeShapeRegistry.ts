/**
 * Shape-painter registries: which painter draws a node, asked of a registry rather than of the
 * process. {@link defaultNodeShapes} holds the kit's built-ins and whatever `registerNodeShape`
 * adds, for every scene. Each scene has a registry of its own ({@link nodeShapesOf}), resolved
 * ahead of the default's, which is where a canvas installs the painters its presets bring: a
 * painter given to one scene paints nothing in another.
 */
import { createEmitter } from '@weasel-js/registry';
import { bumpNodeMemoGeneration, nodeMemoGeneration } from 'core/scene/nodeMemo';
import type { NodeShapeEntry } from './nodeShapeTypes';

/** Options for `registerNodeShape` and {@link NodeShapes.register}. */
export interface RegisterNodeShapeOptions {
  /** `'high'` puts the painter ahead of all normally-registered ones (so
   *  it can win over a kit built-in). `'normal'`, the default, appends after
   *  the built-ins that claim a node by its data, ahead of the rect fallback. */
  priority?: 'high' | 'normal';
}

/** A table of shape painters, falling back to a parent's. */
export interface NodeShapes {
  /** The registry consulted after this one's own painters, or null for the default. */
  readonly parent: NodeShapes | null;
  /** Register a painter here. Returns a disposer that removes this registration, and only it:
   *  a painter registered twice stays until both are disposed. */
  register<TData, TPose>(painter: NodeShapeEntry<TData, TPose>, opts?: RegisterNodeShapeOptions): () => void;
  /** Every painter this registry resolves, its parent's included, in evaluation order. */
  entries(): readonly NodeShapeEntry[];
  /** Distinguishes this registry's memoized lookups from another's; `0` for the default. */
  readonly serial: number;
}

/** One registration. A painter registered twice is two of these, so each disposer takes out its own. */
interface Registration { readonly entry: NodeShapeEntry }

interface Tiers { high: Registration[]; normal: Registration[] }

const tiersOf = new WeakMap<NodeShapes, Tiers>();
/** Registries other than the default holding a painter of their own; one leaves when it empties. */
const scoped = new Set<NodeShapes>();
const builtins: Registration[] = [];
const fallback: Registration[] = [];
const changes = createEmitter();
let serials = 0;
let builtInsRegistered = false;
let registerBuiltIns: (() => void) | null = null;

/** The painter set is state lookups read, and a memo keyed on the node alone cannot see it
 *  change; neither can a canvas that already painted. See `nodeMemo`. */
export function nodeShapesChanged(): void {
  bumpNodeMemoGeneration();
  changes.emit();
}

/** Hear every registration and release, in any registry, and every `refreshNodeShapes`:
 *  what a mounted canvas repaints on. */
export function subscribeNodeShapes(listener: () => void): () => void {
  return changes.subscribe(listener);
}

/** Set how the built-ins go in. They go in on first use, not at module load: a bundler may
 *  drop an import kept only for its side effect, and the registry would come up empty. */
export function setBuiltInShapes(register: () => void): void {
  registerBuiltIns = register;
}

export function ensureBuiltInShapes(): void {
  if (builtInsRegistered || !registerBuiltIns) return;
  builtInsRegistered = true;
  registerBuiltIns();
}

/** Add a built-in: `tier` `'builtin'` claims a node by its data, `'fallback'` takes what nothing else did. */
export function addBuiltInShape(entry: NodeShapeEntry, tier: 'builtin' | 'fallback'): void {
  (tier === 'builtin' ? builtins : fallback).push({ entry });
}

/** Test-only: forget every painter, the built-ins included; the next lookup registers them again. */
export function resetNodeShapesForTests(): void {
  const root = tiersOf.get(defaultNodeShapes)!;
  root.high.length = 0;
  root.normal.length = 0;
  builtins.length = 0;
  fallback.length = 0;
  builtInsRegistered = false;
}

/** Make a registry consulted ahead of `parent`, which defaults to {@link defaultNodeShapes}. */
export function createNodeShapes(opts: { parent?: NodeShapes | null } = {}): NodeShapes {
  const parent = opts.parent === undefined ? defaultNodeShapes : opts.parent;
  const tiers: Tiers = { high: [], normal: [] };
  const registry: NodeShapes = {
    parent,
    serial: serials++,
    register(painter, o = {}) {
      ensureBuiltInShapes();
      const list = o.priority === 'high' ? tiers.high : tiers.normal;
      const registration: Registration = { entry: painter as NodeShapeEntry };
      list.push(registration);
      if (parent) scoped.add(registry);
      nodeShapesChanged();
      return () => {
        const i = list.indexOf(registration);
        if (i < 0) return;
        list.splice(i, 1);
        if (!hasOwnShapes(registry)) scoped.delete(registry);
        nodeShapesChanged();
      };
    },
    entries: () => evaluationOrder(registry).map((r) => r.entry),
  };
  tiersOf.set(registry, tiers);
  return registry;
}

/** Every painter, the kit's built-ins and `registerNodeShape`'s: what a scene with no registry of
 *  its own, a headless render or an export with no canvas resolves through. */
export const defaultNodeShapes: NodeShapes = createNodeShapes({ parent: null });

/** `shapes` and its ancestors, nearest first. */
function chainOf(shapes: NodeShapes): Tiers[] {
  const out: Tiers[] = [];
  for (let s: NodeShapes | null = shapes; s; s = s.parent) out.push(tiersOf.get(s)!);
  return out;
}

const orders = new WeakMap<NodeShapes, { generation: number; list: readonly Registration[] }>();

/** High painters nearest first, then the built-ins, then normal ones nearest first, then the fallback. */
export function evaluationOrder(shapes: NodeShapes): readonly Registration[] {
  ensureBuiltInShapes();
  // Every change bumps the memo generation, so it keys this cache too.
  const generation = nodeMemoGeneration();
  const held = orders.get(shapes);
  if (held?.generation === generation) return held.list;
  const chain = chainOf(shapes);
  const list = [...chain.flatMap((t) => t.high), ...builtins, ...chain.flatMap((t) => t.normal), ...fallback];
  orders.set(shapes, { generation, list });
  return list;
}

/** Whether `shapes` holds a painter of its own, so a lookup through it can answer other than its
 *  parent's. */
export function hasOwnShapes(shapes: NodeShapes): boolean {
  const t = tiersOf.get(shapes)!;
  return t.high.length + t.normal.length > 0;
}

/** The nearest registry from `shapes` up that holds a painter of its own, or the default: the one
 *  whose answers `shapes`'s equal, so lookups through an empty scene registry share the default's memo. */
export function effectiveShapes(shapes: NodeShapes): NodeShapes {
  let s = shapes;
  while (s.parent && !hasOwnShapes(s)) s = s.parent;
  return s;
}

/** Whether a painter some scene's own registry holds claims `node`: for a caller with no scene to
 *  ask, which must not take such a node for one drawn by the default painters. */
export function scopedShapeClaims(node: Parameters<NodeShapeEntry['matches']>[0]): boolean {
  for (const shapes of scoped) {
    const t = tiersOf.get(shapes)!;
    if ([...t.high, ...t.normal].some((r) => r.entry.matches(node))) return true;
  }
  return false;
}

const ofScene = new WeakMap<object, NodeShapes>();

/**
 * The painters `scene` paints with: its own, made on first ask, ahead of
 * {@link defaultNodeShapes}. `<SceneCanvas>` installs its presets' painters
 * here, and every lookup made for the scene — drawing, picking, bounds, chrome,
 * export — passes it.
 */
export function nodeShapesOf(scene: object): NodeShapes {
  let shapes = ofScene.get(scene);
  if (!shapes) ofScene.set(scene, (shapes = createNodeShapes()));
  return shapes;
}
