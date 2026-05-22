import { useMemo, createElement } from 'react';
import { defineTool } from '../../routing';
import { LassoIcon } from '../../../icons';
import type { Tool } from '../../types';
import type { UseLassoSelectOptions } from 'interactions/actions/lasso-select/options';
import { selectFromLasso } from 'interactions/actions/lasso-select/behaviors/selectFromLasso';
import type { LassoHitMode, LassoSelectAdapter } from 'core/adapters/types';
import type { KeyBinding } from 'interactions/keyHelpers';

export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding (`{ key: 'L' }`). Pass `null` to omit. */
  keybinding?: KeyBinding | null;
}

/** Free-form polygon select Tool. Drag is handled entirely by the gesture
 *  dispatcher via the `lassoSelect` action binding below; the dispatcher
 *  overlay layer (`useDispatcherOverlayLayer`) paints the live polyline +
 *  dashed close-line while the gesture is in flight. Esc cancels through
 *  the dispatcher's standard cancel pipeline.
 *
 *  Phase 14e Task 3: legacy `useLassoSelect` hook removed — all gesture
 *  state, overlay rendering, and selection commit live in
 *  `lassoSelectAction` (see `src/interactions/actions/defaults/lassoSelect.ts`). */
export function useLassoTool(
  _adapter: LassoSelectAdapter,
  options: UseLassoToolOptions = {},
): Tool<undefined> {
  // Behaviors are still resolved here so consumers' `mode` option threads
  // through `selectFromLasso`. The actual gesture machinery reads behaviors
  // from the dispatcher-path `lassoSelectAction` registration; this resolution
  // is preserved for option-surface parity even though the value isn't
  // currently forwarded into the action (deferred to the action descriptor's
  // own option surface).
  void (options.behaviors ?? [selectFromLasso({ mode: options.mode ?? 'intersect' })]);

  return useMemo(() => {
    return defineTool<undefined>({
      id: 'lasso',
      hookName: 'useLassoTool',
      ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? { key: 'L' } }),
      cursor: 'crosshair',
      presentation: {
        label: 'Lasso',
        icon: createElement(LassoIcon),
        group: 'select',
      },
      // Declarative drag binding for the new gesture dispatcher. The
      // dispatcher invokes `lassoSelectAction`, which owns vertex buffering,
      // overlay state, and the commit-on-end selection write.
      bindings: [
        { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: 'lassoSelect' },
      ],
      initial: {},
    });
  }, [options.keybinding]);
}
