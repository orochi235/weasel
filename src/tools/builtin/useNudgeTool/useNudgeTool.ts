import { useMemo } from 'react';
import { useNudge, type NudgeAdapter, type UseNudgeOptions } from 'interactions/actions/nudge/nudge';
import { defineTool, claim } from '../../routing';
import type { Tool } from '../../types';

export interface UseNudgeToolOptions<TPose> extends UseNudgeOptions<TPose> {}

/** Always-on Tool wrapping `useNudge`. Handles ArrowUp/Down/Left/Right via
 *  declarative keyDown routes (fired on every ambient-slot tool). Reads
 *  `e.shiftKey` for large-step. The legacy hook's document-level keybinding
 *  is suppressed via `enableKeyboard: false`. */
export function useNudgeTool<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeToolOptions<TPose> = {},
): Tool<undefined> {
  const ctl = useNudge(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'nudge',
        presentation: { label: 'Nudge' },
        initial: {
          keyDown: {
            ArrowUp: (_ctx, event) => {
              ctl.nudge('up', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowDown: (_ctx, event) => {
              ctl.nudge('down', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowLeft: (_ctx, event) => {
              ctl.nudge('left', (event as KeyboardEvent).shiftKey);
              return claim();
            },
            ArrowRight: (_ctx, event) => {
              ctl.nudge('right', (event as KeyboardEvent).shiftKey);
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
