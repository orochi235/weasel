import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { BooleanOpOptions, NodeId, PathOverlay, TransientPath } from '@weasel-js/core';
import { facesAlong, planShapeBuilder, type ShapeBuilderMode, type ShapeBuilderPlan } from './shapeBuilder';
import type { ImmediateParams } from '@weasel-js/routing';

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

/** What the tool reads on every gesture: how operands are taken, and what a
 *  gesture without Alt does. Alt does the other. */
export interface ShapeBuilderSettings {
  op: BooleanOpOptions;
  mode: ShapeBuilderMode;
}

const OTHER: Record<ShapeBuilderMode, ShapeBuilderMode> = { merge: 'delete', delete: 'merge' };

/** The tool's actions: showing the face under the pointer, and taking the
 *  faces a drag or a click passes through. */
export function createShapeBuilderActions(overlay: PathOverlay, settings: () => ShapeBuilderSettings): {
  actions: Action[];
  reset(): void;
} {
  const plans = createPlanCache(() => settings().op);
  const modeFor = (alt: boolean | undefined): ShapeBuilderMode => (alt ? OTHER[settings().mode] : settings().mode);
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
        const p = params as ImmediateParams | undefined;
        const plan = enoughSelected(deps) === true ? plans.get(deps) : null;
        const at = plan && p?.world ? plan.faceAt(p.world.x, p.world.y) : -1;
        if (!plan || at < 0) overlay.clear();
        else show(plan, [at], modeFor(p?.mods?.alt) === 'delete' ? 'remove' : 'chrome');
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
        const p = params as ImmediateParams | undefined;
        const plan = plans.get(deps);
        if (!plan || !p?.press) return;
        const at = plan.faceAt(p.press.x, p.press.y);
        if (at < 0) return;
        overlay.clear();
        plans.clear();
        plan.commit([at], modeFor(p.mods?.alt));
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
        const paint = () => show(plan, picked, modeFor(alt) === 'delete' ? 'remove' : 'picked');
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
            if (reason === 'commit') plan.commit(picked, modeFor(alt));
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
