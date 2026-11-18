import { useMemo, useReducer, useState } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import { defineTool, pointSnap } from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import type { ToolOptionShare } from '@weasel-js/routing';
import type { PolygonPath } from '@weasel-js/geom';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../icons.gen';
import { createPenActions } from './penActions';
import { penToolOptions } from './penOptions';
import { createPenPreviewLayer, penReachOf } from './penPreviewLayer';
import { freshScratch, resetScratch } from './penScratch';
import { createPenTrail } from './penTrail';

/**
 * In-progress pen anchor. A click places a corner, with no handles. A drag
 * sets `outHandle` to the drag point and `inHandle` to its mirror through
 * the anchor, which shapes the segment coming into it.
 */
export interface PenDraftAnchor {
  x: number;
  y: number;
  outHandle?: { x: number; y: number };
  inHandle?: { x: number; y: number };
  /** True once Alt is held during the placement drag: from then on the
   *  in-handle stays where it is, and an anchor dragged with Alt down from
   *  the start gets none. */
  altBroken?: boolean;
}

/** One in-progress subpath of the pen tool: its anchors so far, and whether
 *  the user has closed it. */
export interface PenSubpath {
  anchors: PenDraftAnchor[];
  closed: boolean;
  /** Begun by the press right after one that closed and committed a path:
   *  the second click of a double click on the first anchor, which the
   *  double click takes back. */
  followsClose?: boolean;
}

/**
 * Mutable state shared across pen-tool gestures. The hook keeps a single
 * instance for its life and changes it in place, so click-by-click state
 * survives gesture boundaries and the tool's preview overlay reads the same
 * object.
 *
 * The pen draws new nodes, and extends an existing node's open subpath from
 * one of its ends (see `continuing`). Reshaping an existing path is anchor
 * editing: double-click a path to enter edit mode.
 */
export interface PenScratch {
  finishedSubpaths: PenSubpath[];
  current: PenSubpath | null;
  cursor: { x: number; y: number } | null;
  draggingHandleAt: number | null;
  closeHintActive: boolean;
  /** Set while the pen is extending an existing node's open subpath rather
   *  than drawing a new node. `current` then starts as that subpath (turned
   *  around when it was picked up by its first anchor), and the commit
   *  writes back into the node. */
  continuing: PenContinuation | null;
  /** The last press closed and committed a path; the next subpath begun
   *  `followsClose`. */
  justClosed?: boolean;
}

/** Which existing subpath the pen picked up, and the node's path as it was. */
export interface PenContinuation {
  id: string;
  /** Index of the picked-up subpath within `original`. */
  sub: number;
  /** True when it was picked up by its first anchor, so `current` runs
   *  backwards and is turned around again on commit. */
  reversed: boolean;
  /** The node's path in world coords at pick-up. */
  original: PolygonPath;
}

/** Options for `usePenTool`: when a closed subpath commits. A finished path
 *  is inserted through the `insert` dep as kind `'path'`, the route every
 *  shape tool takes, so a consumer shapes the node by overriding that dep.
 *  Anchors, the rubber band and the handles snap through the `snap` dep's
 *  `point` sessions, about the anchor placed before. */
export interface UsePenToolOptions {
  /** Auto-select the new object after commit. Default `true`. */
  autoSelect?: boolean;
  /** When true (default), clicking the first anchor to close a subpath
   *  commits immediately — the closed region renders with its fill right
   *  away. When false, the closed subpath stays in scratch so the user can
   *  start another subpath; commit then fires on Enter / ⌘-click /
   *  double-click, producing a compound path. Switching tools first discards
   *  it, as Escape does. The `autoCommitOnClose` option's default. */
  autoCommitOnClose?: boolean;
  /** Laid over the pen's own option shares: `{ fill: null }` keeps the pen's
   *  fill its own. Keep it stable across renders. */
  share?: ToolOptionShare;
  /** Screen-px hit radius for "click first anchor to close". Default the `targets.penCloseHitPx` kit setting, else `8`.
   *  Measured as a screen-space circle, so it stays round under non-uniform
   *  zoom; aligns with `useSelectTool.handleHitRadius`. */
  closeHitRadius?: number;
}

/**
 * Active-slot Tool: click + drag to build a `PolygonPath` Illustrator-style.
 *
 * Click places a corner anchor; click-drag places an anchor with an
 * outgoing bezier handle; click-the-first-anchor closes the subpath; Enter
 * open-finishes; Esc discards, and so does a tool switch. Shift constrains the placement-drag handle to 0/45/90/135°;
 * Alt during drag breaks the handle mirror for the next segment.
 *
 * Reshaping an existing path is not this tool's job — see {@link PenScratch}.
 */
export function usePenTool(
  options: UsePenToolOptions = {},
): Tool {
  const { autoSelect = true, autoCommitOnClose, closeHitRadius, share } = options;
  const toolOptions = useMemo(() => penToolOptions(share, autoCommitOnClose), [share, autoCommitOnClose]);

  const [scratch] = useState(freshScratch);

  const optsRef = useLatest({ autoSelect, toolOptions, closeHitRadius, kitSettings: useKitSettings() });
  const [snaps] = useState(pointSnap);

  // Scratch mutations alone don't trigger React re-renders, so the preview
  // layer would not repaint. Force a render after every scratch mutation.
  const [, forceRender] = useReducer((x: number) => x + 1, 0);
  const [overlay] = useState(() => createPenPreviewLayer({ state: scratch, kitSettings: () => optsRef.current.kitSettings }));

  const trail = useMemo(
    () => createPenTrail(scratch, snaps, () => penReachOf(optsRef.current).close, forceRender),
    [scratch, snaps, optsRef],
  );

  const actions = useMemo(
    () => createPenActions({ scratch, snaps, trail, settings: () => optsRef.current, repaint: forceRender }),
    [scratch, snaps, trail, optsRef],
  );

  return useMemo(() => {
    return defineTool({
      id: 'pen',
      keybinding: { key: 'P' },
      capabilities: ['creates-paths'],
      hookName: 'usePenTool',
      options: toolOptions,
      cursor: () =>
        scratch.closeHintActive
          ? 'pointer'
          : cursorFor('pen', { fallback: 'crosshair' }),
      presentation: {
        label: 'Pen',
        icon: icon('core:pen'),
        group: 'draw',
      },
      actions,
      overlay,
      overlayPosition: 'before-selection',

      onDeactivate: () => {
        // Anything still in scratch is incomplete. Switching tools mid-path
        // discards it, as Escape does, rather than committing a stub polyline.
        resetScratch(scratch);
        trail.stop();
      },

      bindings: [
        // Plain click places an anchor; ⌘/Ctrl-click open-finishes. Strict
        // modifier matching keeps the two apart.
        { spec: { kind: 'click' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.placeAnchor', opts: { id: 'pen.click' } },
        { spec: { kind: 'click' as const, mods: { mod: true, shift: 'optional' as const, alt: 'optional' as const } }, actionId: 'pen.finishOpen', opts: { id: 'pen.modClick' } },
        // Double-click on the last anchor also open-finishes.
        {
          spec: { kind: 'doubleClick' as const, mods: { shift: 'optional' as const, alt: 'optional' as const } },
          actionId: 'pen.finishOpen',
          opts: { id: 'pen.doubleClick', params: { viaDoubleClick: true } },
        },
        { spec: { kind: 'drag' as const, mods: { shift: 'optional' as const, alt: 'optional' as const, ctrl: 'optional' as const } }, actionId: 'pen.dragHandle', opts: { id: 'pen.drag' } },
        { spec: { kind: 'key' as const, key: 'Enter' }, actionId: 'pen.finish', opts: { id: 'pen.finish' } },
        { spec: { kind: 'key' as const, key: 'Escape' }, actionId: 'pen.cancel', opts: { id: 'pen.cancel' } },
      ],
    });
  }, [scratch, actions, trail, overlay, toolOptions]);
}
