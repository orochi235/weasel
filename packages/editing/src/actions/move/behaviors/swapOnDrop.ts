import type { BehaviorResult, GestureContext, MoveBehavior } from '@weasel-js/core/engine';
import { documentOf, moveEachOps, nodeDescriptors, scenePoseFrame, type NodeId } from '@weasel-js/core';
import type { OngoingOverlay } from '@weasel-js/routing';
import { scratchKey, getScratch, setScratch, type ScratchKey } from '@weasel-js/routing';
import type { CursorSpec } from '@weasel-js/cursor';
import { after } from '@weasel-js/registry';
import type { Rect } from '@weasel-js/geom';
import type { MoveSession } from '../session';
import { moveSessionOf } from '../sessionOf';
import { swapOps } from '../../swap/swapOps';

/** Options for {@link swapOnDrop}. */
export interface SwapOnDropOptions {
  /** How long the pointer rests over a node before a release there swaps. Default 1000. */
  dwellMs?: number;
  /**
   * The node the dragged node `draggedId` would trade places with, for the pointer at `point` in world, or
   * `null`. Default: the node the `nodeAtPoint` dep hits, outside the dragged node, or the first of its
   * ancestors `swappable` lets trade places with it.
   */
  targetAt?(point: { x: number; y: number }, draggedId: string): string | null;
}

const SWAP_CURSOR: CursorSpec = { glyph: 'swap', fallback: 'move' };

/** The node a swap would trade with and how the preview shows it, armed. */
interface Armed {
  id: string;
  /** Its world bounds in the document: the pointer holding inside them keeps it armed. */
  bounds: Rect;
  /** It and what moves with it, slid into the dragged node's start place, each in its stored frame. */
  poses: ReadonlyMap<string, unknown>;
}

interface SwapState {
  /** The node the pointer is resting over, its dwell timer running or done. */
  over: string | null;
  armed: Armed | null;
  cancel: (() => void) | null;
}

/** How many swap behaviors have been built: each keeps its state under a key of its own, so the move's own
 *  and a binding's never share a timer. */
let built = 0;

function stateIn(ctx: GestureContext<unknown>, key: ScratchKey<SwapState>): SwapState {
  let s = getScratch(ctx.scratch, key);
  if (!s) {
    s = { over: null, armed: null, cancel: null };
    setScratch(ctx.scratch, key, s);
  }
  return s;
}

function disarm(s: SwapState): void {
  s.cancel?.();
  s.cancel = null;
  s.over = null;
  s.armed = null;
}

/** The node the dragged one is over and may trade places with, by the `nodeAtPoint` dep. */
function hitTarget(session: MoveSession, point: { x: number; y: number }, draggedId: string): string | null {
  const dep = session.nodeAtPoint;
  if (!dep) return null;
  const exclude = new Set<NodeId>([...session.ids, ...session.cascadeIds, draggedId as NodeId]);
  const seen = new Set<string>();
  for (let at: string | null = dep(point, exclude); at !== null && !seen.has(at); at = session.scene.get(at as NodeId)?.parent ?? null) {
    if (session.swaps(draggedId, at)) return at;
    seen.add(at);
  }
  return null;
}

/** `target` armed against the dragged `id`: its bounds, and where the preview slides it. */
function arm(session: MoveSession, id: string, target: string): Armed {
  const doc = documentOf(session.scene);
  const frame = scenePoseFrame(doc);
  const descriptorOf = nodeDescriptors(doc, session.projection);
  const home = descriptorOf(id as NodeId).getBounds(frame.world(id as NodeId));
  const bounds = descriptorOf(target as NodeId).getBounds(frame.world(target as NodeId));
  const ops = moveEachOps(doc, [{ ids: [target], dx: home.x - bounds.x, dy: home.y - bounds.y }], { poseDescriptor: session.projection });
  const poses = new Map(ops.filter((op) => op.name === 'transform')
    .map((op) => [(op.args as { id: string }).id, (op.args as { to: unknown }).to]));
  return { id: target, bounds, poses };
}

const inside = (r: Rect, p: { x: number; y: number }): boolean =>
  p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height;

function outline({ x, y, width, height }: Rect): OngoingOverlay {
  const points = [{ x, y }, { x: x + width, y }, { x: x + width, y: y + height }, { x, y: y + height }, { x, y }];
  return { kind: 'polyline', points, role: 'target' };
}

/**
 * A swap drop, run while `on` says so. Built by the move action for its `swapOnDrop` param, and by
 * {@link swapOnDrop} for a binding's `behaviors`.
 */
export function swapBehavior(options: SwapOnDropOptions, on: (session: MoveSession) => boolean): MoveBehavior<unknown> {
  const dwellMs = options.dwellMs ?? 1000;
  const key = scratchKey<SwapState>(`swapOnDrop.${++built}`);
  const stateOf = (ctx: GestureContext<unknown>): SwapState => stateIn(ctx, key);
  /** The one node the drag moves, which is the one it can swap, or null: a drag of several never swaps. */
  const draggedOf = (session: MoveSession): string | null =>
    (on(session) && session.ids.length === 1 ? session.ids[0]! : null);

  const targetAt = (session: MoveSession, point: { x: number; y: number }, id: string): string | null => {
    const found = options.targetAt ? options.targetAt(point, id) : hitTarget(session, point, id);
    return found !== null && found !== id && session.swaps(id, found) ? found : null;
  };

  return {
    onMove(ctx): BehaviorResult<unknown> | undefined {
      const s = stateOf(ctx);
      const session = moveSessionOf(ctx);
      const id = session ? draggedOf(session) : null;
      if (!session || id === null) {
        disarm(s);
        return undefined;
      }
      const point = { x: ctx.pointer.worldX, y: ctx.pointer.worldY };
      // Armed, the target is previewed elsewhere, so a hit-test there would miss it: its own place holds it.
      const target = s.armed && inside(s.armed.bounds, point) ? s.armed.id : targetAt(session, point, id);
      if (target !== s.over) {
        disarm(s);
        s.over = target;
        if (target !== null) {
          s.cancel = after(dwellMs, () => {
            s.cancel = null;
            s.armed = arm(session, id, target);
            ctx.refresh?.();
          });
        }
      }
      const armed = s.armed;
      if (armed === null) return undefined;
      return { poses: armed.poses, overlays: [outline(armed.bounds)], cursor: SWAP_CURSOR };
    },
    onCancel(ctx) {
      disarm(stateOf(ctx));
    },
    onEnd(ctx, end) {
      const s = stateOf(ctx);
      const armed = s.armed;
      disarm(s);
      const session = moveSessionOf(ctx);
      if (end.answered || armed === null || !session) return undefined;
      const id = draggedOf(session);
      if (id === null || !session.swaps(id, armed.id)) return undefined;
      return swapOps(session.scene, id, armed.id, {
        poseDescriptor: session.projection,
        ...(session.geometryProjection ? { geometryProjection: session.geometryProjection } : {}),
      });
    },
  };
}

/**
 * Move behavior that swaps the one dragged node with the node it is held over: resting there for `dwellMs`
 * arms the swap, which slides that node into the dragged one's start place, outlines it, and shows the swap
 * cursor, and a release while armed trades the two (`swapOps`), as one undo step. Moving off disarms it, and
 * coming back starts the wait again. A drag of several nodes never swaps, nor does an Alt-drag clone.
 *
 * The move action's `swapOnDrop: 'dwell'` param runs this with the defaults; a binding that needs another
 * `targetAt` or wait passes its own in `behaviors`.
 */
export function swapOnDrop(options: SwapOnDropOptions = {}): MoveBehavior<unknown> {
  return swapBehavior(options, () => true);
}
