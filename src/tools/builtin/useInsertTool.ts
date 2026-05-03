import { useMemo } from 'react';
import { useInsert, type UseInsertOptions } from '../../interactions/gestures/insert/insert';
import type { InsertAdapter } from '../../core/adapters/types';
import { defineTool } from '../defineTool';
import type { Tool } from '../types';

export interface UseInsertToolOptions<TPose> extends UseInsertOptions<TPose> {}

/** Active-slot Tool wrapping `useInsert`. Declares cursor `'crosshair'`.
 *  No keybinding by default — consumer activates via
 *  `useKeybindings({ overrides: { i: 'insert' } })` or similar. */
export function useInsertTool<TObject extends { id: string }, TPose>(
  adapter: InsertAdapter<TObject>,
  options: UseInsertToolOptions<TPose> = {},
): Tool<undefined> {
  const ctl = useInsert<TObject, TPose>(adapter, options);

  return useMemo(
    () =>
      defineTool({
        id: 'insert',
        cursor: 'crosshair',
        drag: {
          onStart: (_e, ctx) => {
            ctl.start(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            ctl.move(ctx.worldX, ctx.worldY, ctx.modifiers);
            return 'claim';
          },
          onEnd: () => {
            ctl.end();
            return 'claim';
          },
          onCancel: () => {
            ctl.cancel();
          },
        },
      }),
    [ctl],
  );
}
