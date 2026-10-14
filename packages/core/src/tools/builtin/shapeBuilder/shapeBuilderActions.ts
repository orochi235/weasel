import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { PathOverlay, TransientPath } from 'canvas/pathOverlay';
import type { NodeId } from 'core/scene/types';
import type { BooleanOpOptions } from 'interactions/actions/booleans/operands';
import { facesAlong, planShapeBuilder, type ShapeBuilderPlan } from 'interactions/actions/booleans/shapeBuilder';

type Point = { x: number; y: number };

/** Screen pixels between the points a drag is sampled at for the faces it crosses. */
const SAMPLE_PX = 2;

/** The selection's faces, recomputed only when what they are cut from changes. */
function createPlanCache(opts: () => BooleanOpOptions) {
  let key: string | null = null;
  let plan: ShapeBuilderPlan | null = null;
  return {
    get(deps: ActionDeps): ShapeBuilderPlan | null {
      const adapter = deps.booleansAdapter;
      if (!adapter) return null;
      const scale = deps.view?.get().scale;
      const o = { ...opts(), ...(scale ? { scale } : {}) };
      const sel = [...adapter.getSelection()] as NodeId[];
      const next = JSON.stringify([o, sel.map((id) => [
        id, adapter.getWorldPath(id) ?? adapter.getTextSource?.(id) ?? null, adapter.getPaint?.(id) ?? null,
      ])]);
      if (next !== key) {
        key = next;
        const planned = planShapeBuilder(adapter, o);
        plan = planned.kind === 'faces' ? planned : null;
      }
      return plan;
    },
    clear(): void {
      key = null;
      plan = null;
    },
  };
}

const enoughSelected = (deps: ActionDeps | undefined): true | ActionDisabledReason => {
  if (!deps?.booleansAdapter) return ActionDisabledReason.NotApplicable;
  return (deps.selection?.get().length ?? 0) >= 2 ? true : ActionDisabledReason.SelectionRequired;
};

/** The tool's actions: showing the face under the pointer, and taking the
 *  faces a drag or a click passes through. */
export function createShapeBuilderActions(overlay: PathOverlay, opts: () => BooleanOpOptions): {
  actions: Action[];
  reset(): void;
} {
  const plans = createPlanCache(opts);
  const show = (plan: ShapeBuilderPlan, faces: readonly number[], role: string): void => {
    overlay.set(faces.map((i): TransientPath => ({ path: plan.faces[i]!.path, role })));
  };
  const eligible = { capability: 'edits-page' } as const;
  const requires = ['booleansAdapter', 'selection', 'view'] as const;

  const hover: Action = {
    id: 'shapeBuilder.hover',
    label: 'Shape Builder — show the face under the pointer',
    eligible,
    requires,
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const p = params as { worldX?: number; worldY?: number; mods?: { alt?: boolean } } | undefined;
        const plan = enoughSelected(deps) === true ? plans.get(deps) : null;
        const at = plan && p?.worldX !== undefined && p.worldY !== undefined ? plan.faceAt(p.worldX, p.worldY) : -1;
        if (!plan || at < 0) overlay.clear();
        else show(plan, [at], p?.mods?.alt ? 'remove' : 'chrome');
      },
    },
  };

  const leave: Action = {
    id: 'shapeBuilder.leave',
    label: 'Shape Builder — clear the shown face',
    eligible,
    invoker: { timing: 'immediate', run: () => overlay.clear() },
  };

  const click: Action = {
    id: 'shapeBuilder.click',
    label: 'Shape Builder — take the face clicked',
    eligible,
    requires,
    enabled: enoughSelected,
    invoker: {
      timing: 'immediate',
      run: (deps, params) => {
        const p = params as { pressX?: number; pressY?: number; mods?: { alt?: boolean } } | undefined;
        const plan = plans.get(deps);
        if (!plan || p?.pressX === undefined || p.pressY === undefined) return;
        const at = plan.faceAt(p.pressX, p.pressY);
        if (at < 0) return;
        overlay.clear();
        plans.clear();
        plan.commit([at], p.mods?.alt ? 'delete' : 'merge');
      },
    },
  };

  const drag: Action = {
    id: 'shapeBuilder',
    label: 'Shape Builder',
    eligible,
    requires,
    enabled: enoughSelected,
    invoker: {
      timing: 'ongoing',
      start: (ctx: InvocationCtx): OngoingHandle => {
        const plan = plans.get(ctx.deps);
        if (!plan) return {};
        const scale = ctx.deps.view?.get().scale ?? { x: 1, y: 1 };
        const step = SAMPLE_PX / Math.max(1e-9, (Math.abs(scale.x) + Math.abs(scale.y)) / 2);
        let last: Point = ctx.drag?.start ?? ctx.world;
        const trail: Point[] = [last];
        const picked = facesAlong(plan, [last], step);
        let alt = ctx.modifiers.alt;
        const paint = () => show(plan, picked, alt ? 'remove' : 'picked');
        paint();
        return {
          kind: 'shapeBuilder',
          onMove: (c) => {
            const at = c.drag?.current ?? c.world;
            for (const i of facesAlong(plan, [last, at], step)) if (!picked.includes(i)) picked.push(i);
            last = at;
            trail.push(at);
            alt = c.modifiers.alt;
            paint();
          },
          onEnd: (_c, reason) => {
            overlay.clear();
            plans.clear();
            if (reason === 'commit') plan.commit(picked, alt ? 'delete' : 'merge');
          },
          overlay: () => (trail.length >= 2 ? { kind: 'polyline', points: trail } : null),
        };
      },
    },
  };

  return {
    actions: [hover, leave, click, drag],
    reset: () => {
      overlay.clear();
      plans.clear();
    },
  };
}
