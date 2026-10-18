import type { Action, BindingOpts, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import { ActionDisabledReason, resolveParams } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import type { Op } from 'core/ops/types';
import { selectedPathNodes, withPath, type PathNode } from './pathNodes';
import type { Node } from 'core/scene/types';
import { commitOps } from '../defaultCommitAdapter';
import { pathOperationTags } from '../pathGestureTags';

/** What one live path command does with its parameter. */
export interface LivePathEditSpec {
  id: string;
  label: string;
  icon?: Action['icon'];
  /** The param the UI drives, and its value when none is given. */
  param: string;
  initial: number;
  /** The geometry `node` takes at `value`, or null for none. `params` is
   *  every param the edit was last given, for a command that reads more than
   *  `param`. */
  edit(node: PathNode, value: number, params: Readonly<Record<string, unknown>>): PolygonPath | null;
  /** The ops committing `next`, made at `value`, for the edited nodes. */
  commit(deps: InvocationCtx['deps'], next: ReadonlyMap<string, { node: PathNode; path: PolygonPath }>, value: number): Op[];
  /** Ids to select after the commit; the selection stands when absent. */
  selectAfter?(ops: Op[]): string[];
  /** Whether the preview draws over the source, which stays in view. */
  overlaysSource?: boolean;
}

function sameParams(a: Readonly<Record<string, unknown>>, b: Readonly<Record<string, unknown>>): boolean {
  const keys = Object.keys(a);
  return keys.length === Object.keys(b).length && keys.every((k) => Object.is(a[k], b[k]));
}

/**
 * An ongoing action over the selected path nodes driven by one number — a
 * slider's tolerance or distance — and by any other params it reads. `begin`
 * with the params shows the result as a preview; each update that changes
 * one recomputes it; committing writes it as one undo
 * entry, and canceling leaves the scene untouched.
 */
export function livePathEdit(spec: LivePathEditSpec): Action & { requires: string[] } {
  return {
    id: spec.id,
    label: spec.label,
    icon: spec.icon,
    tags: pathOperationTags('command'),
    eligible: { capability: 'creates-shapes' },
    requires: ['selection', 'scene', 'applyOps'],
    invoker: {
      timing: 'ongoing',
      start(ctx: InvocationCtx, opts?: BindingOpts): OngoingHandle {
        const nodes = selectedPathNodes(ctx.deps);
        if (nodes.length === 0) return {};
        const read = (params: Record<string, unknown> | undefined): number | null => {
          const v = params?.[spec.param];
          return typeof v === 'number' && Number.isFinite(v) ? v : null;
        };
        const given = resolveParams(opts?.params);
        let params: Readonly<Record<string, unknown>> = { ...given, ...ctx.params };
        let value = read(ctx.params) ?? read(given) ?? spec.initial;
        let current = new Map<string, { node: PathNode; path: PolygonPath }>();
        const recompute = () => {
          current = new Map();
          for (const node of nodes) {
            const path = spec.edit(node, value, params);
            if (path) current.set(node.id, { node, path });
          }
        };
        recompute();
        const shapeOf = (id: string) => {
          const entry = current.get(id);
          return entry ? withPath(entry.node.node as Node<unknown, string, unknown>, entry.path) : null;
        };
        return {
          kind: spec.id,
          onMove(moveCtx: InvocationCtx): void {
            const moved = moveCtx.params;
            if (!moved) return;
            const next = read(moved) ?? value;
            const merged = { ...params, ...moved };
            if (next === value && sameParams(merged, params)) return;
            value = next;
            params = merged;
            recompute();
          },
          onEnd(endCtx: InvocationCtx, reason: 'commit' | 'cancel'): void {
            const done = current;
            current = new Map();
            if (reason === 'cancel' || done.size === 0) return;
            const ops = spec.commit(endCtx.deps, done, value);
            commitOps(endCtx.deps, ops, spec.label);
            const after = spec.selectAfter?.(ops);
            if (after) endCtx.deps.selection?.set(after as never);
          },
          previewIds: () => (current.size > 0 ? [...current.keys()] : null),
          previewPose: (id: string) => shapeOf(id)?.pose ?? null,
          previewData: (id: string) => shapeOf(id)?.data ?? null,
          ...(spec.overlaysSource ? { previewHidesSource: false } : {}),
        };
      },
    },
    enabled: (deps) => (selectedPathNodes(deps).length > 0 ? true : ActionDisabledReason.SelectionRequired),
  };
}
