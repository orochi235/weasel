import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason, BETWEEN_GESTURES } from '@weasel-js/routing';
import { warnOutlines, type NodeId, type NodeOutline, type NodeOutlineError, type NoticesDep } from '@weasel-js/core';
import { applyCreateOutlines, type CreateOutlinesAdapter, type CreateOutlinesResult } from './createOutlines';
import { icon } from '../icons.gen';

/** What an outline conversion answers when an outline could not be built. */
type OutlinesFailure = { kind: 'failed'; error: NodeOutlineError };

/**
 * Run `apply`, an outline conversion of the adapter's selection, waiting first
 * for any outline whose geometry has not landed (`NodeOutlineError.pending`) —
 * a text face is parsed on first use, so the first conversion in a session
 * would otherwise fail. The retry converts what was selected when it was asked, whatever is
 * selected by then, and a node deleted meanwhile is left out. Warns the user
 * through `notices` (under `tag` on the console without it) when the selection
 * still cannot be converted.
 */
export async function withOutlines<R extends { kind: string } | OutlinesFailure>(
  adapter: CreateOutlinesAdapter,
  apply: (adapter: CreateOutlinesAdapter) => R,
  tag: string,
  notices?: NoticesDep,
): Promise<R> {
  const failure = (r: R): NodeOutlineError | null => (r.kind === 'failed' ? (r as OutlinesFailure).error : null);
  const asked = [...adapter.getSelection()] as NodeId[];
  let result = apply(adapter);
  if (failure(result)?.pending) {
    const outlines = asked
      .map((id) => adapter.getOutline(id))
      .filter((o): o is NodeOutline => o !== undefined);
    await Promise.all(outlines.map((o) => o.load()));
    const held: CreateOutlinesAdapter = Object.create(adapter, { getSelection: { value: () => asked } });
    result = apply(held);
  }
  const error = failure(result);
  if (error) warnOutlines(notices, tag, error);
  return result;
}

/** {@link applyCreateOutlines} through {@link withOutlines}. */
export function runCreateOutlines(adapter: CreateOutlinesAdapter, notices?: NoticesDep): Promise<CreateOutlinesResult> {
  return withOutlines(adapter, (a) => applyCreateOutlines(a), 'createOutlines', notices);
}

/**
 * Static descriptor for Create Outlines: replace the selected nodes that have
 * an outline (text's glyphs) with path nodes carrying it. Reads the
 * `createOutlinesAdapter` dep, published with `useCreateOutlinesAdapter`.
 */
export const createOutlinesAction: Action = {
  id: 'createOutlines',
  label: 'Create Outlines',
  icon: icon('core:createOutlines'),
  group: 'text',
  // Affinity's Convert to Curves; Illustrator's Mod+Shift+O is Chrome's bookmark manager.
  defaultBinding: [{ spec: { kind: 'key', key: 'Enter', mods: { mod: true }, phase: BETWEEN_GESTURES }, opts: { id: 'createOutlines.key' } }],
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'createOutlinesAdapter', 'notices'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const adapter = deps.createOutlinesAdapter;
      if (adapter) void runCreateOutlines(adapter, deps.notices);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const ids = deps?.selection?.get() ?? [];
    if (ids.length === 0) return ActionDisabledReason.SelectionRequired;
    const adapter = deps?.createOutlinesAdapter;
    return adapter && ids.some((id) => adapter.getOutline(id) !== undefined)
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
