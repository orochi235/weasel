import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { loadTextOutlines, type TextNodeSource, type TextOutlinesError } from '@weasel-js/text';
import {
  applyCreateOutlines, type CreateOutlinesAdapter, type CreateOutlinesResult,
} from './createOutlines';
import { icon } from '../../../icons.gen';
import { warnTextOutlines, type NoticesDep } from '../notices';

/** What an outline conversion answers when a text face had no outlines. */
type OutlinesFailure = { kind: 'failed'; error: TextOutlinesError };

/**
 * Run `apply`, an outline conversion of `adapter`'s selection, waiting first
 * for any face whose outlines are registered but not yet loaded — a face is
 * parsed on first use, so the first conversion in a session would otherwise
 * fail. Warns the user through `notices` (under `tag` on the console without
 * it) when the selection still cannot be converted.
 */
export async function withTextOutlines<R extends { kind: string } | OutlinesFailure>(
  adapter: CreateOutlinesAdapter,
  apply: () => R,
  tag: string,
  notices?: NoticesDep,
): Promise<R> {
  const failure = (r: R): TextOutlinesError | null => (r.kind === 'failed' ? (r as OutlinesFailure).error : null);
  let result = apply();
  if (failure(result)?.reason === 'outlines-loading') {
    const texts = [...adapter.getSelection()]
      .map((id) => adapter.getTextSource(id as NodeId))
      .filter((t): t is TextNodeSource => t !== undefined);
    await Promise.all(texts.map((t) => loadTextOutlines(t.data)));
    result = apply();
  }
  const error = failure(result);
  if (error) warnTextOutlines(notices, tag, error);
  return result;
}

/** {@link applyCreateOutlines} through {@link withTextOutlines}. */
export function runCreateOutlines(adapter: CreateOutlinesAdapter, notices?: NoticesDep): Promise<CreateOutlinesResult> {
  return withTextOutlines(adapter, () => applyCreateOutlines(adapter), 'createOutlines', notices);
}

/**
 * Static descriptor for Create Outlines: replace the selected
 * text nodes with path nodes carrying their glyph outlines. Reads the
 * `createOutlinesAdapter` dep, published with `useCreateOutlinesAdapter`.
 */
export const createOutlinesAction: Action = {
  id: 'createOutlines',
  label: 'Create Outlines',
  icon: icon('createOutlines'),
  group: 'text',
  // Affinity's Convert to Curves; Illustrator's Mod+Shift+O is Chrome's bookmark manager.
  defaultBinding: [{ spec: { kind: 'key', key: 'Enter', mods: { mod: true } }, opts: { id: 'createOutlines.key' } }],
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
    return adapter && ids.some((id) => adapter.getTextSource(id) !== undefined)
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
