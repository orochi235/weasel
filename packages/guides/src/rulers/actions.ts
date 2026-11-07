import {
  commitOps, snapMods, SNAP_ROLES, viewWorldToScreen,
  type Action, type ActionDeps, type ImmediateParams, type InvocationCtx, type Op, type OngoingHandle, type Scene, type UnitScope,
} from '@weasel-js/core';
import { addGuideOp, removeGuideOp, replaceGuideOp, type GuideStore } from '../guides/ops';
import type { Guide } from '../guides/types';
import { guideAxisOf, rulerPartAt, type RulerHit, type RulerPart } from './hit';
import { documentRulerFrame, rulerFrameAt, type RulerFrame } from './reading';
import type { RulersState } from './layout';

type Point = { x: number; y: number };
type AnyScene = Scene<unknown, string, unknown>;

/** What the rulers' actions read and write. */
export interface RulersActionCtx {
  id: string;
  size: number;
  guides: GuideStore;
  root: UnitScope;
  origin?: Point;
  newGuideId: () => string;
  get(): RulersState;
  set(patch: Partial<RulersState>): void;
}

/** The frame under a world point, rebuilt only when the scene changes. */
function frameReader(ctx: RulersActionCtx): (scene: AnyScene | undefined, p: Point) => RulerFrame {
  let built: { scene: AnyScene; version: number; at: (p: Point) => RulerFrame } | null = null;
  return (scene, p) => {
    if (scene === undefined) return documentRulerFrame(ctx.root, ctx.origin);
    const version = scene.getVersion();
    if (built?.scene !== scene || built.version !== version) built = { scene, version, at: rulerFrameAt(scene, ctx.root, ctx.origin) };
    return built.at(p);
  };
}

/** The pointer's hover: moves each ruler's marker, and reads the labels in
 *  the frame under it; off the canvas, in the document's. */
export function rulersPointerAction(ctx: RulersActionCtx): Action {
  const frameAt = frameReader(ctx);
  return {
    id: `${ctx.id}.pointer`,
    label: 'Follow the pointer on the rulers',
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const p = params as (ImmediateParams & { over?: boolean }) | undefined;
        if (p?.over === false || p?.world === undefined) {
          ctx.set({ pointer: null, frame: documentRulerFrame(ctx.root, ctx.origin) });
          return;
        }
        ctx.set({ pointer: p.world, frame: frameAt(deps.scene as AnyScene | undefined, p.world) });
      },
    },
  };
}

const hitOf = (affordance: unknown): RulerHit | null =>
  (affordance as { payload?: RulerHit } | null | undefined)?.payload ?? null;

/** Commit `op` as one undo step; straight to the store on a canvas with
 *  neither a commit hook nor a scene to hold the history. */
function commit(deps: ActionDeps, op: Op): void {
  if (deps.applyOps || deps.scene) commitOps(deps, [op], op.label ?? 'Guide');
  else op.apply(undefined);
}

/** What a drag ending with the guide at `to` (`null` over a ruler) commits:
 *  a guide placed, moved, or dropped back on a ruler and removed. */
function guideEdit(store: GuideStore, moving: Guide | null, to: Guide | null): Op | null {
  if (moving === null) return to === null ? null : addGuideOp(store, to);
  if (to === null) return removeGuideOp(store, moving);
  return to.offset === moving.offset ? null : replaceGuideOp(store, moving, to);
}

/**
 * A drag off a ruler places a guide along it — across the canvas from the top
 * ruler, down it from the left; a drag on a placed guide moves it, and
 * dropping it on either ruler removes it. Either way the guide goes through a
 * `point` session of the `snap` dep, so it lands on whatever the canvas snaps
 * to, shows in the rulers' `draft` while the drag runs, and changes on release
 * as one undo step. A new guide released back over its own ruler places
 * nothing.
 */
export function rulersGuideAction(ctx: RulersActionCtx): Action {
  return {
    id: `${ctx.id}.guide`,
    label: 'Place Guide',
    modifierRoles: SNAP_ROLES,
    requires: ['view'],
    invoker: {
      timing: 'ongoing',
      // The dispatcher builds deps once, for `start`; later events carry none.
      start(start: InvocationCtx): OngoingHandle {
        const hit = hitOf(start.drag?.affordance);
        if (!hit || hit.part === 'corner') return {};
        const moving = hit.part === 'guide' ? hit.guide : null;
        const axis = hit.part === 'guide' ? hit.guide.axis : guideAxisOf(hit.part);
        const id = moving ? moving.id : ctx.newGuideId();
        // A new guide comes off its own ruler; a placed one goes back onto either.
        const onRuler = (part: RulerPart | null): boolean => (moving ? part !== null : part === hit.part);
        const deps = start.deps;
        const press = start.drag?.start ?? start.world;
        const snap = deps.snap?.begin({ gesture: 'point', press }) ?? null;
        let guide: Guide | null = moving;
        const follow = (at: InvocationCtx): void => {
          const p = at.drag?.current ?? at.world;
          const view = deps.view?.get();
          const s = view ? viewWorldToScreen(view, p) : null;
          const back = s !== null && onRuler(rulerPartAt(s.x, s.y, ctx.size));
          const landed = back ? null : snap ? snap.at(p, snapMods(at)).point : p;
          guide = landed === null ? null : { ...moving, id, axis, offset: landed[axis] };
          ctx.set({ draft: guide, pointer: p });
        };
        follow(start);
        return {
          kind: 'guide',
          cursor: () => (axis === 'y' ? 'row-resize' : 'col-resize'),
          onMove: follow,
          onEnd: (end, reason) => {
            try {
              if (reason === 'commit') follow(end);
              ctx.set({ draft: null });
              const op = reason === 'commit' ? guideEdit(ctx.guides, moving, guide) : null;
              if (op) commit(deps, op);
            } finally {
              snap?.end();
            }
          },
        };
      },
    },
  };
}
