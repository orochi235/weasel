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

/** Always-on Tool wrapping `useNudge`. Declares its own keybinding (`ArrowUp`);
 *  also handles ArrowDown/Left/Right inside the handler since `Tool.keybinding`
 *  is single-valued. Reads `e.shiftKey` for large-step. The legacy hook's
 *  document-level keybinding is suppressed via `enableKeyboard: false`. */
export function useNudgeTool<TPose>(
  adapter: NudgeAdapter<TPose>,
  options: UseNudgeToolOptions<TPose> = {},
): Tool<undefined> {
  // enableKeyboard: false — the Tool owns its keybinding via the dispatcher.
  const ctl = useNudge(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'nudge',
        keybinding: 'ArrowUp',
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
