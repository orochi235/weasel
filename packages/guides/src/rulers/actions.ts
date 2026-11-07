import {
  commitOps, snapMods, SNAP_ROLES, viewWorldToScreen,
  type Action, type ActionDeps, type ImmediateParams, type InvocationCtx, type OngoingHandle, type Scene, type UnitScope,
} from '@weasel-js/core';
import { addGuideOp, type GuideStore } from '../guides/ops';
import type { Guide } from '../guides/types';
import { guideAxisOf, rulerPartAt, type RulerHit } from './hit';
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

/** Commit `guide` as one undo step; straight to the store on a canvas with
 *  neither a commit hook nor a scene to hold the history. */
function commitGuide(deps: ActionDeps, guides: GuideStore, guide: Guide): void {
  const op = addGuideOp(guides, guide);
  if (deps.applyOps || deps.scene) commitOps(deps, [op], 'Add Guide');
  else op.apply(undefined);
}

/**
 * A drag off a ruler: places a guide along it — across the canvas from the
 * top ruler, down it from the left — through a `point` session of the `snap`
 * dep, so it lands on whatever the canvas snaps to. The guide shows in the
 * rulers' `draft` while the drag runs, and is added on release as one undo
 * step. Released back over its ruler, it places nothing.
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
        const part = hit.part;
        const axis = guideAxisOf(part);
        const deps = start.deps;
        const press = start.drag?.start ?? start.world;
        const snap = deps.snap?.begin({ gesture: 'point', press }) ?? null;
        const id = ctx.newGuideId();
        let guide: Guide | null = null;
        const follow = (at: InvocationCtx): void => {
          const p = at.drag?.current ?? at.world;
          const view = deps.view?.get();
          const s = view ? viewWorldToScreen(view, p) : null;
          const back = s !== null && rulerPartAt(s.x, s.y, ctx.size) === part;
          const landed = back ? null : snap ? snap.at(p, snapMods(at)).point : p;
          guide = landed === null ? null : { id, axis, offset: landed[axis] };
          ctx.set({ draft: guide, pointer: p });
        };
        follow(start);
        return {
          kind: 'guide',
          cursor: () => (part === 'top' ? 'row-resize' : 'col-resize'),
          onMove: follow,
          onEnd: (end, reason) => {
            try {
              if (reason === 'commit') follow(end);
              ctx.set({ draft: null });
              if (reason === 'commit' && guide !== null) commitGuide(deps, ctx.guides, guide);
            } finally {
              snap?.end();
            }
          },
        };
      },
    },
  };
}
