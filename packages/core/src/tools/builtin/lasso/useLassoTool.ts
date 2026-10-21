import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import type { UseLassoSelectOptions } from 'interactions/actions/lasso-select/options';
import type { LassoHitMode } from 'core/adapters/types';
import type { ToolKeybinding } from '@weasel-js/routing';
import { icon } from '../../../icons.gen';

/** Options for `useLassoTool` — the lasso-select action's options plus the
 *  tool's own hit mode and activation key. */
export interface UseLassoToolOptions extends UseLassoSelectOptions {
  /** Hit mode for the action's own selection commit, which runs when no
   *  behavior claims the gesture. A behavior carries its own, as
   *  `selectFromLasso({ mode })` does. Default 'intersect'. */
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
export function useLassoTool(options: UseLassoToolOptions = {}): Tool {
  const paramsRef = useLatest<{ mode: LassoHitMode; minVertexSpacing?: number }>({
    mode: options.mode ?? 'intersect',
    ...(options.minVertexSpacing !== undefined ? { minVertexSpacing: options.minVertexSpacing } : {}),
  });
  const { behaviors } = options;

  return useMemo(() => {
    return defineTool({
      id: 'lasso',
      capabilities: ['creates-selection'],
      hookName: 'useLassoTool',
      ...(options.keybinding === null ? {} : { keybinding: options.keybinding ?? { key: 'L' } }),
      cursor: 'crosshair',
      presentation: {
        label: 'Lasso',
        icon: icon('lasso'),
        group: 'select',
      },
      // Declarative drag binding for the new gesture dispatcher. The
      // dispatcher invokes `lassoSelectAction`, which owns vertex buffering,
      // overlay state, and the commit-on-end selection write.
      bindings: [
        {
          spec: { kind: 'drag', mods: { shift: 'optional' } },
          actionId: 'lassoSelect',
          // Thunked so a mode or spacing change reaches the next gesture
          // without rebuilding the tool.
          opts: {
            id: 'lasso.drag',
            params: () => paramsRef.current,
            ...(behaviors ? { behaviors } : {}),
          },
        },
      ],
    });
  }, [options.keybinding, behaviors, paramsRef]);
}
