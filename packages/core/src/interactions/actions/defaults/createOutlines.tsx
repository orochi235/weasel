import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import type { NodeId } from 'core/scene/types';
import { loadTextOutlines, type TextNodeSource } from 'features/text/textToPath';
import {
  applyCreateOutlines, type CreateOutlinesAdapter, type CreateOutlinesResult,
} from '../outlines/createOutlines';
import { CreateOutlinesIcon } from './icons/outlineIcons';

/**
 * {@link applyCreateOutlines}, waiting first for any face whose outlines are
 * registered but not yet loaded — a face is parsed on first use, so the first
 * conversion in a session would otherwise fail. Warns with the reason when
 * the selection still cannot be converted.
 */
export async function runCreateOutlines(adapter: CreateOutlinesAdapter): Promise<CreateOutlinesResult> {
  let result = applyCreateOutlines(adapter);
  if (result.kind === 'failed' && result.error.reason === 'outlines-loading') {
    const texts = [...adapter.getSelection()]
      .map((id) => adapter.getTextSource(id as NodeId))
      .filter((t): t is TextNodeSource => t !== undefined);
    await Promise.all(texts.map((t) => loadTextOutlines(t.data)));
    result = applyCreateOutlines(adapter);
  }
  if (result.kind === 'failed') console.warn(`[createOutlines] ${result.error.message}`);
  return result;
}

/**
 * @experimental Static descriptor for Create Outlines: replace the selected
 * text nodes with path nodes carrying their glyph outlines. Reads the
 * `createOutlinesAdapter` dep, published with `useCreateOutlinesAdapter`.
 */
export const createOutlinesAction: Action = {
  id: 'createOutlines',
  label: 'Create Outlines',
  icon: <CreateOutlinesIcon />,
  group: 'text',
  defaultBinding: { kind: 'key', key: 'o', mods: { mod: true, shift: true } },
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'createOutlinesAdapter'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const adapter = deps.createOutlinesAdapter;
      if (adapter) void runCreateOutlines(adapter);
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
