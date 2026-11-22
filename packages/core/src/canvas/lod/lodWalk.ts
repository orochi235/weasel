/** The rung choice a scene walk makes for each node it visits. */
import { boundsOfPath } from '@weasel-js/geom';
import type { View } from 'core/viewport/view';
import { isPathLike, isRectPose } from 'core/geometry/autoPoseDescriptor';
import { findNodeShape } from '../NodeShape';
import { defaultNodeShapes, effectiveShapes, evaluationOrder, type NodeShapes } from '../nodeShapeRegistry';
import { pixelScaleAt } from '../pixelScale';
import { DEFAULT_HYSTERESIS, rungIndexAt, type Ladder, type LodHysteresis, type NodeLod, type Rung } from './ladder';
import type { LodPick, LodState } from './lodState';

/** What a walk asks of level of detail for each node it visits. */
export interface LodWalk<TNode, TPose> {
  /** The rung `node` shows at `pose` under `view`, or null for a node with one rung. */
  pick(node: TNode, pose: TPose, view: View): LodPick | null;
  /** The walk is over: what it chose becomes the view's last frame. */
  end(): void;
}

/** A view's level-of-detail settings. */
export interface LodOptions {
  /** Every group with no ladder of its own draws nothing below 2 device pixels, its box below this
   *  many, and its children from here up. Off when absent. */
  collapseBelowPx?: number;
}

/** A ladder flattened for the walk: parallel arrays, and one pick object per rung. */
interface Resolved {
  from: number[];
  picks: LodPick[];
  sizeOf: Ladder['sizeOf'] | undefined;
  h: LodHysteresis;
}

type LadderNode = { id: string; kind?: string; lod?: NodeLod; pose?: unknown };

const BUILT_IN: Record<string, Rung> = {
  full: { id: 'full', fromPx: 0 },
  box: { id: 'box', fromPx: 0, children: 'skip' },
  none: { id: 'none', fromPx: 0, children: 'skip' },
};

function resolve(rungs: readonly Rung[], sizeOf: Ladder['sizeOf'], h: LodHysteresis | undefined): Resolved {
  const sorted = [...rungs].sort((a, b) => a.fromPx - b.fromPx);
  return {
    from: sorted.map((r, i) => (i === 0 ? 0 : r.fromPx)),
    picks: sorted.map((r) => ({ rung: r.id, skip: r.children === 'skip' })),
    sizeOf,
    h: h ?? DEFAULT_HYSTERESIS,
  };
}

const byLadder = new WeakMap<Ladder, Resolved>();
const byNodeLod = new WeakMap<NodeLod, WeakMap<object, Resolved>>();
const byCollapse = new Map<number, Resolved>();
const NO_LADDER = {};

function ladderRungs(ladder: Ladder): Resolved {
  let r = byLadder.get(ladder);
  if (r === undefined) byLadder.set(ladder, r = resolve(ladder.rungs as readonly Rung[], ladder.sizeOf as Ladder['sizeOf'], ladder.hysteresis));
  return r;
}

/** `lod`'s thresholds over the rungs `ladder` and the built-ins name; a name neither knows draws `full`. */
function nodeLodRungs(lod: NodeLod, ladder: Ladder | undefined): Resolved {
  let held = byNodeLod.get(lod);
  if (held === undefined) byNodeLod.set(lod, held = new WeakMap());
  const key = ladder ?? NO_LADDER;
  let r = held.get(key);
  if (r === undefined) {
    const rungs = lod.map(({ as, fromPx }) => {
      const own = ladder?.rungs.find((x) => x.id === as) as Rung | undefined;
      const known = own ?? BUILT_IN[as];
      return { ...(known ?? BUILT_IN.full!), id: known ? as : 'full', fromPx };
    });
    held.set(key, r = resolve(rungs, ladder?.sizeOf as Ladder['sizeOf'], ladder?.hysteresis));
  }
  return r;
}

function collapseRungs(px: number): Resolved {
  let r = byCollapse.get(px);
  if (r === undefined) {
    byCollapse.set(px, r = resolve([
      BUILT_IN.none!, { ...BUILT_IN.box!, fromPx: Math.min(2, px) }, { ...BUILT_IN.full!, fromPx: px },
    ], undefined, undefined));
  }
  return r;
}

/** The longest side of `pose`'s box in world units, or `Infinity` for a pose with none. */
export function poseSizeOf(pose: unknown): number {
  if (isRectPose(pose)) return Math.max(Math.abs(pose.width), Math.abs(pose.height));
  if (isPathLike(pose)) {
    const b = boundsOfPath(pose);
    return Math.max(b.width, b.height);
  }
  return Infinity;
}

const ladderIn = new WeakMap<readonly unknown[], boolean>();

/** Whether any painter `shapes` resolves declares a ladder, memoized on its evaluation order. */
function anyLadderIn(shapes: NodeShapes = defaultNodeShapes): boolean {
  const order = evaluationOrder(effectiveShapes(shapes));
  let has = ladderIn.get(order);
  if (has === undefined) ladderIn.set(order, has = order.some((r) => r.entry.ladder !== undefined));
  return has;
}

/**
 * The rung choice for one walk of a view drawn at `dpr` device pixels per CSS pixel, through
 * `shapes`. With `state` it reads the rung each node showed in the view's last walk under `key` for
 * hysteresis and records this walk's; without it, each node takes the rung its size reaches, which
 * is what a render with no previous frame (an export, a tile bake) wants. Undefined when no node can
 * have more than one rung and none declares its own.
 */
export function createLodWalk<TNode extends LadderNode, TPose>(args: {
  shapes?: NodeShapes;
  dpr: number;
  state?: LodState;
  key?: string;
  options?: LodOptions;
}): LodWalk<TNode, TPose> {
  const { shapes, dpr, state, options } = args;
  const collapse = options?.collapseBelowPx;
  const ladders = anyLadderIn(shapes);
  const rec = state?.begin(args.key ?? 'scene');
  let lastView: View | undefined;
  let pxPerUnit = 0;
  return {
    pick(node, pose, view) {
      const own = node.lod;
      const group = node.kind === 'group';
      if (own === undefined && !ladders && !(collapse !== undefined && group)) return null;
      const ladder = ladders && !group ? findNodeShape(node as never, shapes)?.ladder as Ladder | undefined : undefined;
      const r = own !== undefined ? nodeLodRungs(own, ladder)
        : ladder !== undefined ? ladderRungs(ladder)
        : collapse !== undefined && group ? collapseRungs(collapse) : null;
      if (r === null || r.picks.length < 2) return null;
      if (view !== lastView) { lastView = view; pxPerUnit = pixelScaleAt(view, dpr); }
      const world = r.sizeOf ? r.sizeOf(node as never, pose) : poseSizeOf(pose);
      const before = rec?.prev(node.id);
      const prev = before === undefined ? -1 : r.picks.findIndex((p) => p.rung === before.rung);
      const i = Number.isNaN(world) ? r.picks.length - 1 : rungIndexAt(r.from, world * pxPerUnit, prev, r.h);
      const pick = r.picks[i]!;
      rec?.record(node.id, pick);
      return pick;
    },
    end() { rec?.end(); },
  };
}
