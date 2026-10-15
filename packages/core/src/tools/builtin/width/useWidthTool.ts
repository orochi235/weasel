import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { createEmitter } from '@weasel-js/registry';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { createWidthActions, WIDTH_CLEAR_ID, WIDTH_DRAG_ID, type WidthEnv, type WidthFocus } from './widthActions';
import { createWidthOverlay } from './widthOverlay';

/** Options for `useWidthTool`. */
export interface UseWidthToolOptions {
  /** Override the default keybinding (`{ key: 'W', shift: true }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen px around a stroke's ink within which a press takes it, and
   *  around an anchor within which a press takes hold of that anchor. Default 6. */
  reach?: number;
}

/**
 * Width tool: shapes a stroke's width along its length, into its
 * `vertexWidths`. A drag on an anchor sets that anchor's width to twice the
 * pointer's distance from it; a drag between two anchors first inserts one
 * there, keeping the path's shape. Either is live and one undo entry.
 * Alt-click on an anchor clears its width, so it takes the stroke's own. The
 * last stroke touched shows its anchors, ringed where they have a width.
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
      { spec: { kind: 'click', mods: { alt: true } }, actionId: WIDTH_CLEAR_ID },
    ],
  }), [actions, overlay, keybinding, env]);
}
