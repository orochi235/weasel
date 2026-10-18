import type { ActionDeps, BindingOpts, InvocationCtx } from '@weasel-js/routing';
import type { Op } from 'core/ops/types';
import type { NodeId, Scene } from 'core/scene/types';
import { gestureReaders, type GestureReaders } from '../../gestures/shared/screenTolerance';
import type { CloneBehavior, CloneBehaviorResult, GestureContext, GroupTransform } from '../../gestures/types';
import { defaultCommitAdapter } from '../defaultCommitAdapter';
import { sceneGestureFrames } from '../gestureFrames';
import { reduceBehaviorEnd } from '../gestureLifecycle';
import { pointerStateOf } from '../pointerState';
import { translatePoseViaDescriptor, type PoseDescriptor } from '../resize/geometry';

type Delta = { dx: number; dy: number };

/** A clone drag's behaviors and the context they are told. */
export interface CloneBehaviors {
  readonly list: readonly CloneBehavior<unknown>[];
  readonly gctx: GestureContext<unknown>;
  /** The drag's delta as the behaviors reshape it, each seeing the one before. */
  shape(moveCtx: InvocationCtx, raw: Delta): Delta;
  /** What the behaviors answer for the commit; see `reduceBehaviorEnd`. */
  end(delta: Delta): Op[] | null | undefined;
}

/**
 * Start the binding's behaviors over the poses the copies are measured from:
 * `origins`, in world, keyed by the original's id.
 */
export function startCloneBehaviors(
  ctx: InvocationCtx,
  opts: BindingOpts | undefined,
  scene: Scene<unknown, string, unknown>,
  roots: readonly NodeId[],
  origins: ReadonlyMap<NodeId, unknown>,
  descriptorOf: (id: NodeId) => PoseDescriptor<unknown>,
): CloneBehaviors {
  const list = (opts?.behaviors ?? []) as CloneBehavior<unknown>[];
  const readers: GestureReaders = gestureReaders(ctx.deps as Pick<ActionDeps, 'view' | 'kitSettings'>);
  const origin = new Map<string, unknown>(origins as ReadonlyMap<string, unknown>);
  const gctx: GestureContext<unknown> = {
    draggedIds: roots as unknown as string[],
    origin,
    current: new Map(origin),
    snap: null,
    modifiers: { ...ctx.modifiers },
    pointer: pointerStateOf(ctx.world, ctx),
    view: readers.view(),
    plane: readers.plane(),
    kitSettings: readers.kitSettings,
    frames: sceneGestureFrames(scene, ctx.deps),
    adapter: defaultCommitAdapter(scene, ctx.deps.selection?.adapterMethods) as unknown as GestureContext<unknown>['adapter'],
    scratch: {},
  };
  const place = ({ dx, dy }: Delta): void => {
    for (const [id, pose] of origins) {
      gctx.current.set(id as string, translatePoseViaDescriptor(pose, dx, dy, descriptorOf(id)));
    }
  };
  for (const b of list) b.onStart?.(gctx);
  return {
    list,
    gctx,
    shape(moveCtx, raw) {
      if (list.length === 0) return raw;
      gctx.modifiers = { ...moveCtx.modifiers };
      gctx.pointer = pointerStateOf(moveCtx.world, moveCtx);
      gctx.view = readers.view();
      gctx.plane = readers.plane();
      place(raw);
      let transform: GroupTransform = { kind: 'translate', ...raw };
      for (const b of list) {
        const r: CloneBehaviorResult<unknown> | void = b.onMove?.(gctx, transform);
        if (!r) continue;
        if (r.transform?.kind === 'translate') transform = r.transform;
        if (r.snap !== undefined) gctx.snap = r.snap;
      }
      return transform.kind === 'translate' ? { dx: transform.dx, dy: transform.dy } : raw;
    },
    end(delta) {
      place(delta);
      return reduceBehaviorEnd(list, gctx);
    },
  };
}
