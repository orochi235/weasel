import type { Action, ImmediateInvoker } from '@weasel-js/routing';
import { ActionDisabledReason } from '@weasel-js/routing';
import { strokeCovers } from '@weasel-js/core';
import { applyOutlineStroke } from './outlineStroke';
import { withOutlines } from './createOutlinesAction';
import { icon } from '../icons.gen';

/**
 * Static descriptor for Outline Stroke: replace each selected
 * stroked path, or stroked outline, with the region its stroke covers, filled in
 * the stroke's paint. Reads the `createOutlinesAdapter` dep, published with
 * `useCreateOutlinesAdapter`, and needs its `getWorldPath` and `getPaint` for paths.
 */
export const outlineStrokeAction: Action = {
  id: 'outlineStroke',
  label: 'Outline Stroke',
  icon: icon('core:outlineStroke'),
  group: 'pathfinder',
  eligible: { capability: 'creates-shapes' },
  requires: ['selection', 'createOutlinesAdapter', 'view', 'notices'],
  invoker: {
    timing: 'immediate',
    run: (deps) => {
      const adapter = deps.createOutlinesAdapter;
      if (!adapter) return;
      const scale = deps.view?.get().scale;
      void withOutlines(adapter, (a) => applyOutlineStroke(a, scale ? { scale } : {}), 'outlineStroke', deps.notices);
    },
  } satisfies ImmediateInvoker,
  enabled: (deps) => {
    const ids = deps?.selection?.get() ?? [];
    if (ids.length === 0) return ActionDisabledReason.SelectionRequired;
    const adapter = deps?.createOutlinesAdapter;
    return adapter && ids.some((id) => strokeCovers(adapter.getPaint?.(id)?.stroke) || adapter.getOutline(id)?.stroked === true)
      ? true
      : ActionDisabledReason.NotApplicable;
  },
};
