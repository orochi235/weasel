import type { Action } from '@weasel-js/routing';
import type { DragSample, InvocationCtx, OngoingHandle, BindingOpts, OngoingOverlay } from '@weasel-js/routing';
import { resolveParams } from '@weasel-js/routing';
import { shapeKindInfo } from 'core/shapeKinds';
import type { KitInsertShape } from 'core/shapeKinds';
import { SNAP_ROLES } from 'domains/snap/roles';
import { runBehaviorSettled } from '../gestureLifecycle';
import { inPlane, insertLayer } from '../planeInput';
import { copiesWithin } from 'canvas/copiesAbove';
import { scenePaintedPoseOf } from 'canvas/derivedPath';
import { cancelInsert, commitInsert } from './commit';
import { carryStart, nextFrame } from './frame';
import type { InsertLiveGesture } from './live';
import { insertParams } from './params';
import { beginInsert } from './session';
import { insertKind, insertShape } from './shape';

/** How far, in CSS pixels, a drag travels before it draws a shape: past the wobble of a click, so a
 *  press that drifts a few pixels draws nothing rather than a shape a few pixels wide. */
export const INSERT_DRAG_THRESHOLD_PX = 8;

/**
 * Drag-to-insert. The node `kind` is read from `opts.params.kind`.
 *
 * The drag's start and current point snap through the `snap` dep's `point`
 * sessions (never freehand pencil samples). While `snap.constrain` (Shift) is
 * held, a line's end stays on the 15° line through the snapped start nearest
 * the pointer, and lands where that line meets a target. Behaviors from the
 * binding's `opts.behaviors` (`InsertBehavior[]`) run over the two points
 * after that; on release the first answer wins (`null` aborts, `Op[]` commits
 * in place of the insert).
 *
 * The new node has no scene id until commit, so the live preview is the
 * `overlay()` surface with `kind: 'insertPreview'`. A consumer-defined kind
 * the kit cannot draw skips the preview and still commits on release.
 *
 * A polygon's or a star's insert is the last operation once it commits, so a
 * panel can change its sides, or its points and inner radius, by replaying the
 * drag (`insertParams`); a drag that behaviors answered does not replay.
 */
export const insertAction: Action & { requires: string[] } = inPlane({
  id: 'insert',
  label: 'Insert',
  group: 'insert',
  eligible: { capability: 'creates-shapes' },
  modifierRoles: SNAP_ROLES,
  requires: ['insert', 'insertLive', 'insertInto', 'canDropInto', 'selection', 'snap', 'textEdit', 'scene', 'applyOps', 'view', 'kitSettings'],
  params: insertParams,
  invoker: {
    timing: 'ongoing',
    dragThresholdPx: INSERT_DRAG_THRESHOLD_PX,
    start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
      const begun = beginInsert(ctx, opts);
      if (!begun) return {};
      const { session, readers } = begun;
      let frame = begun.frame;
      const gesture: InsertLiveGesture = { open: true, userRotation: 0, repositioning: false };
      let trail: readonly DragSample[] | null = null;
      const live = ctx.deps.insertLive;
      if (live) live.gesture = gesture;
      // Where the shape will land decides the copies it will be drawn in.
      const scene = ctx.deps.scene;
      const copies = scene ? copiesWithin(scene, session.parent, scenePaintedPoseOf(scene)) : [];

      return {
        kind: 'insert',
        onMove(moveCtx: InvocationCtx): void {
          if (gesture.repositioning) carryStart(session, frame.pointer, moveCtx.world, moveCtx);
          frame = nextFrame(session, readers, frame, moveCtx);
        },
        overlay(): OngoingOverlay | null {
          if (!gesture.open) return null;
          // Resolve params on every overlay() so thunked params (polygon
          // sides ticking via ArrowUp mid-drag) reflect in the live preview.
          const resolved = resolveParams(session.opts?.params);
          if (!shapeKindInfo(insertKind(resolved))?.insertPreview) return null;
          const { bounds, extras, start } = insertShape(resolved, frame, frame.points, gesture.userRotation);
          return {
            kind: 'insertPreview',
            shape: extras.kind as KitInsertShape,
            bounds,
            extras,
            // Anchor dot at the click point: radial shapes have no vertex
            // there, and in center mode it marks the growth axis.
            anchorPoint: { x: start.x, y: start.y },
            ...(copies.length > 0 ? { copies } : {}),
          };
        },
        onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
          gesture.open = false;
          if (live?.gesture === gesture) live.gesture = null;
          let committed = false;
          try {
            if (reason === 'cancel') cancelInsert(session);
            else {
              trail = endCtx.drag?.points ?? frame.points;
              committed = commitInsert(session, frame, trail, gesture.userRotation);
            }
          } finally {
            session.snap.close();
            runBehaviorSettled(session.behaviors, session.gestureCtx, committed);
          }
        },
        // A behavior's answer is its own to make once, so only a plain insert replays.
        ...(session.behaviors.length === 0 ? {
          replay(params: Record<string, unknown>): void {
            commitInsert({ ...session, opts: { ...session.opts, params } }, frame, trail, gesture.userRotation);
          },
        } : {}),
      };
    },
  },
  /** Insert needs no selection; anything but `true` blocks dispatcher-routed inserts. */
  enabled: () => true as const,
}, insertLayer);
