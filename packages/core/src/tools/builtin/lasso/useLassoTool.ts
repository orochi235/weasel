import { useMemo, useRef, createElement } from 'react';
import { defineTool } from '../../overlayBinding';
import { LassoIcon } from '../../../icons';
import type { Tool } from '../../overlayBinding';
import type { UseLassoSelectOptions } from 'interactions/actions/lasso-select/options';
import { selectFromLasso } from 'interactions/actions/lasso-select/behaviors/selectFromLasso';
import type { LassoHitMode, LassoSelectAdapter } from 'core/adapters/types';
import type { ToolKeybinding } from '@weasel-js/routing';

/** Options for `useLassoTool` — the lasso-select action's options plus the
 *  tool's own hit mode and activation key. */
export interface UseLassoToolOptions extends Pick<UseLassoSelectOptions,
  'behaviors' | 'transient' | 'label' | 'onGestureStart' | 'onGestureEnd' |
  'minVertexSpacing' | 'debug'> {
  /** Hit mode forwarded to the default `selectFromLasso` behavior when no
   *  explicit `behaviors` array is passed. Default 'intersect'. */
  mode?: LassoHitMode;
  /** Override the default keybinding (`{ key: 'L' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
}

/** Free-form polygon select Tool. Drag is handled entirely by the gesture
 *  dispatcher via the `lassoSelect` action binding below; the dispatcher
 *  overlay layer (`useDispatcherOverlayLayer`) paints the live polyline +
 *  dashed close-line while the gesture is in flight. Esc cancels through
 *  the dispatcher's standard cancel pipeline.
 *
 *  The legacy `useLassoSelect` hook is removed — all gesture
 *  state, overlay rendering, and selection commit live in
 *  `lassoSelectAction` (see `src/interactions/actions/defaults/lassoSelect.ts`). */
export function useLassoTool(
  _adapter: LassoSelectAdapter,
  options: UseLassoToolOptions = {},
): Tool<undefined> {
  // `behaviors` is not forwarded into the dispatcher-path action yet; `mode`
  // reaches it through the binding's params below.
  void (options.behaviors ?? [selectFromLasso({ mode: options.mode ?? 'intersect' })]);
  const modeRef = useRef<LassoHitMode>(options.mode ?? 'intersect');
  modeRef.current = options.mode ?? 'intersect';

  return useMemo(() => {
    return defineTool<undefined>({
      id: 'lasso',
      capabilities: ['creates-selection'],
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
        {
          spec: { kind: 'drag', mods: { shift: 'optional' } },
          actionId: 'lassoSelect',
          // Thunked so a mode change reaches the next gesture without
          // rebuilding the tool.
          opts: { params: () => ({ mode: modeRef.current }) },
        },
      ],
    });
  }, [options.keybinding]);
}
