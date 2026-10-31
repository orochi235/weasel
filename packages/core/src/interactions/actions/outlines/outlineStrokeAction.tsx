import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { applyOutlineStroke, textIsStroked } from './outlineStroke';
import { withTextOutlines } from './createOutlinesAction';
import { icon } from '../../../icons.gen';

/**
 * Static descriptor for Outline Stroke: replace each selected
 * stroked path, or stroked text, with the region its stroke covers, filled in
 * the stroke's paint. Reads the `createOutlinesAdapter` dep, published with
 * `useCreateOutlinesAdapter`, and needs its `getWorldPath` and `getPaint` for paths.
 */
export const outlineStrokeAction: Action = {
  id: 'outlineStroke',
  label: 'Outline Stroke',
  icon: icon('outlineStroke'),
  group: 'pathfinder',
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'createOutlinesAdapter', 'view', 'notices'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const adapter = deps.createOutlinesAdapter;
      if (!adapter) return;
      const scale = deps.view?.get().scale;
      void withTextOutlines(adapter, () => applyOutlineStroke(adapter, scale ? { scale } : {}), 'outlineStroke', deps.notices);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const ids = deps?.selection?.get() ?? [];
    if (ids.length === 0) return ActionDisabledReason.SelectionRequired;
    const adapter = deps?.createOutlinesAdapter;
    return adapter && ids.some((id) => adapter.getPaint?.(id)?.stroke !== undefined || textIsStroked(adapter.getTextSource(id)))
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
