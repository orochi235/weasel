import type { BindingOpts, DragSample, InvocationCtx } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { SNAP_ANGLE_STEP, snapMods } from 'features/snap/roles';
import { spanSnap, type SpanSnap } from 'features/snap/spanSnap';
import { pointerStateOf } from '../pointerState';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';
import { gestureReaders, type GestureReaders } from '../../gestures/shared/screenTolerance';
import type { GestureContext, InsertBehavior, InsertPoint } from '../../gestures/types';
import type { InsertDep, TextEditDep } from '../depSchema';
import { insertParent } from './parent';
import { insertKind } from './shape';

/** The key an insert's single gesture point rides under in the behaviors'
 *  `draggedIds` / `origin` / `current` — insert has no node id yet. */
export const GESTURE_KEY = 'gesture';

/** What an insert captured at press. Nothing here changes during the drag.
 *  The deps are captured because the dispatcher builds the deps bag once, on
 *  `start`: every later pump event carries `deps: {}`. */
export interface InsertSession {
  readonly dep: InsertDep;
  /** For the text kind's drop-into-the-caret step. */
  readonly textEdit: TextEditDep | undefined;
  /** Snaps the drag's start and current point, so the live preview and the
   *  committed geometry agree. Freehand pencil samples are deliberately NOT
   *  snapped — a grid-quantized freehand trail is a staircase, not a stroke. */
  readonly snap: SpanSnap;
  /** The active binding's opts — re-resolved on every read so thunked
   *  params see the latest tool state (e.g. polygon `sides` after ArrowUp). */
  readonly opts: BindingOpts | undefined;
  /** What was selected before the draw cleared it, to put back on cancel. */
  readonly priorSelection: readonly NodeId[];
  /** Behaviors from `opts.behaviors`; empty when none were bound. */
  readonly behaviors: readonly InsertBehavior<unknown>[];
  /** Reused gesture context handed to behaviors. Its `origin` holds the
   *  start point under {@link GESTURE_KEY}, after `onStart` shaped it. */
  readonly gestureCtx: GestureContext<unknown>;
  /** For committing a behavior's `Op[]`. */
  readonly scene: Scene<unknown, string, unknown> | undefined;
  /** The container the node lands in; null for the top of the tree. */
  readonly parent: NodeId | null;
  readonly applyOps: ((ops: Op[], label: string) => void) | undefined;
  readonly selection: SelectionApi | undefined;
}

/** What the latest pump event left. Replaced, not mutated, by the next. */
export interface InsertFrame {
  /** The raw (unsnapped) pointer in world space. */
  readonly pointer: InsertPoint;
  /** Pointer trail accumulated by the dispatcher in world space; pencil-kind
   *  commits read it. */
  readonly points: ReadonlyArray<DragSample> | null;
  /** Alt inverts the binding's nominal `originMode` (corner ⇄ center), so
   *  pressing or releasing it mid-drag flips the preview and the commit
   *  without the dispatcher re-routing to another binding. */
  readonly altHeld: boolean;
  /** The endpoints after the snap session and the behaviors. */
  readonly shaped: { start: InsertPoint; current: InsertPoint };
}

/** Capture an insert at press. Null with no `insert` dep. Clears the
 *  selection and runs each behavior's `onStart`. */
export function beginInsert(
  ctx: InvocationCtx,
  opts: BindingOpts | undefined,
): { session: InsertSession; readers: GestureReaders; frame: InsertFrame } | null {
  const dep = ctx.deps.insert;
  if (!dep) return null;

  // Starting a draw retires any prior selection — the lingering halo
  // around an unrelated node while the user is drawing a new shape is
  // just visual noise, and it primes the UX bug where a drag that
  // continues over the selected node would otherwise drive the move
  // action via fall-through. The clear is unconditional: the user has
  // committed to "I'm making a new thing" by engaging a creation tool.
  const selection = ctx.deps.selection;
  const priorSelection = selection ? [...selection.get()] : [];
  if (selection && priorSelection.length > 0) {
    selection.clear();
  }

  const parent = insertParent(ctx.deps.scene, ctx.deps.insertInto?.get(), ctx.deps.canDropInto);
  const constrain = () => (insertKind(resolveParams(opts?.params)) === 'line' ? { step: SNAP_ANGLE_STEP } : undefined);
  const snap = spanSnap(ctx.deps.snap, constrain, parent === null ? {} : { parent });
  const behaviors = (opts?.behaviors ?? []) as InsertBehavior<unknown>[];
  const readers = gestureReaders(ctx.deps);
  const origin = snap.start({ x: ctx.world.x, y: ctx.world.y }, snapMods(ctx)).point;
  const gestureCtx: GestureContext<unknown> = {
    draggedIds: [GESTURE_KEY],
    origin: new Map<string, unknown>([[GESTURE_KEY, origin]]),
    current: new Map<string, unknown>([[GESTURE_KEY, origin]]),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: pointerStateOf(ctx.world, ctx),
    view: readers.view(),
    plane: readers.plane(),
    kitSettings: readers.kitSettings,
    // No node exists to adapt until commit; insert behaviors read points.
    adapter: undefined as unknown as GestureContext<unknown>['adapter'],
    scratch: {},
  };
  for (const b of behaviors) b.onStart?.(gestureCtx);
  // A snap target in range outranks a behavior's own snapping.
  if (snap.startHeld()) gestureCtx.origin.set(GESTURE_KEY, origin);
  const startPoint = gestureCtx.origin.get(GESTURE_KEY) as InsertPoint;
  snap.anchor(startPoint);

  const session: InsertSession = {
    dep,
    textEdit: ctx.deps.textEdit,
    snap,
    opts,
    priorSelection,
    behaviors,
    gestureCtx,
    scene: ctx.deps.scene,
    parent,
    applyOps: ctx.deps.applyOps,
    selection,
  };
  const frame: InsertFrame = {
    pointer: { x: ctx.world.x, y: ctx.world.y },
    points: ctx.drag?.points ?? null,
    altHeld: ctx.modifiers.alt,
    shaped: { start: startPoint, current: startPoint },
  };
  return { session, readers, frame };
}
