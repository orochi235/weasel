import { useMemo } from 'react';
import { useNudge, type NudgeAdapter, type UseNudgeOptions } from 'interactions/actions/nudge/nudge';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

const KEY_TO_DIR: Record<string, 'up' | 'down' | 'left' | 'right' | undefined> = {
  ArrowUp: 'up',
  ArrowDown: 'down',
  ArrowLeft: 'left',
  ArrowRight: 'right',
};

export interface UseNudgeToolOptions<TPose> extends UseNudgeOptions<TPose> {}

/** Always-on Tool wrapping `useNudge`. Handles ArrowUp/Down/Left/Right via
 *  the keyboard channel (fired on every ambient-slot tool). Reads `e.shiftKey`
 *  for large-step. The legacy hook's document-level keybinding is suppressed
 *  via `enableKeyboard: false`. */
export function useNudgeTool<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeToolOptions<TPose> = {},
): Tool<undefined> {
  const ctl = useNudge(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'nudge',
        keyboard: {
          onDown: (e) => {
            const dir = KEY_TO_DIR[e.key];
            if (!dir) return 'pass';
            ctl.nudge(dir, e.shiftKey);
            return 'claim';
          },
        },
      }),
    [ctl],
  );
}
