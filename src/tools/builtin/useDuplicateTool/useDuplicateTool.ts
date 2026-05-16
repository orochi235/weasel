import { useMemo } from 'react';
import { useDuplicate, type DuplicateAdapter, type UseDuplicateOptions } from 'interactions/actions/duplicate/duplicate';
import { defineTool, claim, none } from '../../routing';
import type { Tool } from '../../types';

export interface UseDuplicateToolOptions extends UseDuplicateOptions {}

/** Always-on Tool wrapping `useDuplicate`. Handles Mod+D (meta or ctrl)
 *  for cross-platform support. The legacy hook's document keybinding is
 *  suppressed by passing `enableKeyboard: false`. */
export function useDuplicateTool<TPose>(
  adapter: DuplicateAdapter<TPose>,
  options: UseDuplicateToolOptions = {},
): Tool<undefined> {
  const ctl = useDuplicate(adapter, { ...options, enableKeyboard: false });

  return useMemo(
    () =>
      defineTool({
        id: 'duplicate',
        presentation: { label: 'Duplicate' },
        initial: {
          keyDown: {
            d: (_ctx, event) => {
              const e = event as KeyboardEvent;
              if (!(e.metaKey || e.ctrlKey)) return none();
              ctl.duplicate();
              return claim();
            },
          },
        },
      }),
    [ctl],
  );
}
