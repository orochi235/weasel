import { useMemo } from 'react';
import { useLatest } from '@weasel-js/react';
import { createEmitter } from '@weasel-js/registry';
import type { ToolKeybinding } from '@weasel-js/routing';
import { defineTool, type Tool } from '@weasel-js/core';
import {
  createGirthActions, GIRTH_CLEAR_ID, GIRTH_DRAG_ID, GIRTH_HOVER_ID, GIRTH_UNHOVER_ID, type GirthEnv, type GirthFocus,
} from './girthActions';
import { createGirthOverlay } from './girthOverlay';
import { icon } from '../icons.gen';

/** Options for `useGirthTool`. */
export interface UseGirthToolOptions {
  /** Override the default keybinding (`{ key: 'W', shift: true }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen px around a stroke's edge within which a press takes hold of it,
   *  and along the path within which it takes the anchor there rather than
   *  inserting one. Default 6. */
  reach?: number;
}

/**
 * Girth tool: shapes a stroke's width along its length, into its
 * `vertexWidths`, by dragging the stroke's edges. Hovering near either edge
 * marks the grab point on it and the width point a press there moves: the
 * anchor at that spot, or a new one inserted between two, keeping the path's
 * shape. Dragging moves the grabbed edge along the path's normal, the other
 * edge mirroring it so the width stays centered; inward pinches it, down to
 * zero. With Alt held only the grabbed edge moves, writing a `{ left, right }`
 * pair. Either drag is live and one undo entry. Alt-click on a width point
 * clears it, so it takes the stroke's own width. The last stroke touched shows
 * its anchors, with a line across the stroke at each that has a width.
 */
export function useGirthTool(options: UseGirthToolOptions = {}): Tool {
  const opts = useLatest({ reach: options.reach ?? 6 });
  const env = useMemo(() => {
    const changed = createEmitter();
    const held: { focus: GirthFocus | null } = { focus: null };
    const value: GirthEnv & { listen(fn: () => void): () => void } = {
      focus: () => held.focus,
      setFocus: (next) => {
        held.focus = next;
        changed.emit();
      },
      reachPx: () => opts.current.reach,
      listen: changed.subscribe,
    };
    return value;
  }, [opts]);

  const actions = useMemo(() => createGirthActions(env), [env]);
  const overlay = useMemo(() => createGirthOverlay({ focus: env.focus, subscribe: env.listen }), [env]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'girth',
    capabilities: ['edits-page'],
    hookName: 'useGirthTool',
    cursor: 'crosshair',
    presentation: { label: 'Girth', group: 'path', icon: icon('girth') },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'W', shift: true } }),
    actions,
    overlay,
    onDeactivate: () => env.setFocus(null),
    bindings: [
      { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: GIRTH_DRAG_ID, opts: { id: 'girth.drag' } },
      { spec: { kind: 'click', mods: { alt: true } }, actionId: GIRTH_CLEAR_ID, opts: { id: 'girth.clear' } },
      { spec: { kind: 'hover', mods: { alt: 'optional', shift: 'optional' } }, actionId: GIRTH_HOVER_ID, opts: { id: 'girth.hover' } },
      { spec: { kind: 'hover', motion: 'leave' }, actionId: GIRTH_UNHOVER_ID, opts: { id: 'girth.leave' } },
    ],
  }), [actions, overlay, keybinding, env]);
}
