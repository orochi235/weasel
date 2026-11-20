import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason, BETWEEN_GESTURES } from '@weasel-js/routing';
import { warnOutlines, type NodeId, type NodeOutline, type NodeOutlineError, type NoticesDep, type OperandsDep } from '@weasel-js/core';
import { applyCreateOutlines, type CreateOutlinesAdapter, type CreateOutlinesResult } from './createOutlines';
import { icon } from '../icons.gen';

/** What an outline conversion answers when an outline could not be built. */
type OutlinesFailure = { kind: 'failed'; error: NodeOutlineError };

/**
 * Run `apply` over `ids`, waiting first for any outline whose geometry has not
 * landed (`NodeOutlineError.pending`): a text face is parsed on first use, so
 * the first conversion in a session would otherwise fail. The retry converts
 * `ids`, whatever is selected by then, less any node deleted meanwhile. Warns
 * the user through `notices` (under `tag` on the console without it) when they
 * still cannot be converted, a face that failed to load included.
 */
export async function withOutlines<R extends { kind: string } | OutlinesFailure>(
  adapter: CreateOutlinesAdapter,
  ids: readonly NodeId[],
  apply: (ids: readonly NodeId[]) => R,
  tag: string,
  notices?: NoticesDep,
): Promise<R> {
  const failure = (r: R): NodeOutlineError | null => (r.kind === 'failed' ? (r as OutlinesFailure).error : null);
  let result = apply(ids);
  if (failure(result)?.pending) {
    const outlines = ids
      .map((id) => adapter.getOutline(id))
      .filter((o): o is NodeOutline => o !== undefined);
    await Promise.allSettled(outlines.map((o) => o.load()));
    result = apply(ids.filter((id) => adapter.getNode(id) != null));
  }
  const error = failure(result);
  if (error) warnOutlines(notices, tag, error);
  return result;
}

/**
 * Hand what a conversion left back to `operands`, where they are not the
 * selection the conversion already updated: each converted id that is gone
 * gives way to the conversion's results.
 */
export function handBackOperands(
  operands: OperandsDep | undefined, adapter: CreateOutlinesAdapter, result: { kind: string; resultIds?: readonly string[] },
): void {
  if (!operands || result.kind !== 'applied' || !result.resultIds) return;
  const now = operands.get();
  const kept = now.filter((id) => adapter.getNode(id) != null);
  if (kept.length === now.length) return;
  operands.set([...kept, ...(result.resultIds as NodeId[]).filter((id) => !kept.includes(id))]);
}

/** {@link applyCreateOutlines} through {@link withOutlines}. */
export function runCreateOutlines(
  adapter: CreateOutlinesAdapter, notices?: NoticesDep, ids: readonly NodeId[] = adapter.getSelection() as readonly NodeId[],
): Promise<CreateOutlinesResult> {
  return withOutlines(adapter, [...ids], (at) => applyCreateOutlines(adapter, at), 'createOutlines', notices);
}

/**
 * Static descriptor for Create Outlines: replace the operands that have
 * an outline (text's glyphs) with path nodes carrying it. Reads the
 * `createOutlinesAdapter` dep, published with `useCreateOutlinesAdapter`.
 */
export const createOutlinesAction: Action = {
  id: 'createOutlines',
  label: 'Create Outlines',
  icon: icon('core:createOutlines'),
  group: 'text',
  // Mod+Enter, since Mod+Shift+O is Chrome's bookmark manager.
  defaultBinding: [{ spec: { kind: 'key', key: 'Enter', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'createOutlines.key' } }],
  eligible: { capability: 'creates-shapes' },
  requires: ['operands', 'createOutlinesAdapter', 'notices'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const adapter = deps.createOutlinesAdapter;
      if (!adapter) return;
      void runCreateOutlines(adapter, deps.notices, deps.operands?.get()).then((r) => handBackOperands(deps.operands, adapter, r));
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const ids = deps?.operands?.get() ?? [];
    if (ids.length === 0) return ActionDisabledReason.SelectionRequired;
    const adapter = deps?.createOutlinesAdapter;
    return adapter && ids.some((id) => adapter.getOutline(id) !== undefined)
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
