import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { createEmitter } from '@weasel-js/registry';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { createWidthActions, WIDTH_DRAG_ID, WIDTH_REMOVE_STOP_ID, type WidthEnv, type WidthFocus } from './widthActions';
import { createWidthOverlay } from './widthOverlay';

/** Options for `useWidthTool`. */
export interface UseWidthToolOptions {
  /** Override the default keybinding (`{ key: 'W', shift: true }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen px around a stroke's ink within which a press takes it, and
   *  around a stop within which a press takes hold of that stop. Default 6. */
  reach?: number;
}

/**
 * Width tool: shapes a stroke's width along its length, into its
 * `widthProfile`. A drag on a stroke sets its width at the point pressed — at
 * the stop already there, or a new one — to twice the pointer's distance
 * from the centerline, live, as one undo entry. Alt-click removes the stop
 * under the pointer. The last stroke touched shows its stops.
 */
export function useWidthTool(options: UseWidthToolOptions = {}): Tool {
  const opts = useLatest({ reach: options.reach ?? 6 });
  const env = useMemo(() => {
    const changed = createEmitter();
    let focus: WidthFocus | null = null;
    const value: WidthEnv & { listen(fn: () => void): () => void } = {
      focus: () => focus,
      setFocus: (next) => {
        focus = next;
        changed.emit();
      },
      reachPx: () => opts.current.reach,
      listen: changed.subscribe,
    };
    return value;
  }, [opts]);

  const actions = useMemo(() => createWidthActions(env), [env]);
  const overlay = useMemo(() => createWidthOverlay({ focus: env.focus, subscribe: env.listen }), [env]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'width',
    capabilities: ['edits-page'],
    hookName: 'useWidthTool',
    cursor: 'crosshair',
    presentation: { label: 'Width', group: 'shape' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'W', shift: true } }),
    actions,
    overlay,
    onDeactivate: () => env.setFocus(null),
    bindings: [
      { spec: { kind: 'drag', mods: { shift: 'optional' } }, actionId: WIDTH_DRAG_ID },
      { spec: { kind: 'click', mods: { alt: true } }, actionId: WIDTH_REMOVE_STOP_ID },
    ],
  }), [actions, overlay, keybinding, env]);
}
