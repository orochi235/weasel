import { useMemo, useRef } from 'react';
import { useKitSettings, useLatest } from '@weasel-js/react';
import { defineTool } from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import type { ToolKeybinding } from '@weasel-js/routing';
import { sliceAction } from './slice';
import { icon } from '../icons.gen';
import type { GestureBinding } from '@weasel-js/routing';
import { createPendingCutActions, createSliceLive, resetPendingCut, type SliceScratch } from './slicePendingCut';
import { createPendingCutLayer } from './slicePendingCutLayer';

export type { SliceScratch } from './slicePendingCut';

/** Options for `useSliceTool`. */
export interface UseSliceToolOptions {
  /** Override the default keybinding (`{ key: 'K' }`). Pass `null` to omit. */
  keybinding?: ToolKeybinding | null;
  /** Screen-px radius around the first point within which a click closes the
   *  cut into a loop and commits it. Default the `targets.sliceCloseHitPx` kit setting, else `8`. */
  closeHitRadius?: number;
}

export const VERTEX_RADIUS_PX = 3;
/** How near the first point, in screen px, a click closes the cut. */
export const SLICE_CLOSE_HIT_PX = 8;

const SLICE_BINDINGS: GestureBinding[] = [
  { spec: { kind: 'click', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.addPoint', opts: { id: 'slice.click' } },
  {
    spec: { kind: 'doubleClick', mods: { shift: 'optional', alt: 'optional' } },
    actionId: 'slice.finish',
    opts: { id: 'slice.doubleClick', params: { viaDoubleClick: true } },
  },
  // Ahead of the cutting drags: it declines unless points are placed.
  { spec: { kind: 'drag', mods: { shift: 'optional', alt: 'optional' } }, actionId: 'slice.dragPoint', opts: { id: 'slice.dragPoint', yields: true } },
  // Requiring Alt ties it with the freehand cut's specificity, so it stays ahead of that too.
  { spec: { kind: 'drag', mods: { shift: 'optional', alt: true } }, actionId: 'slice.dragPoint', opts: { id: 'slice.dragPoint.alt', yields: true } },
  { spec: { kind: 'drag' }, actionId: 'slice', opts: { id: 'slice.drag' } },
  { spec: { kind: 'drag', mods: { alt: true } }, actionId: 'slice', opts: { id: 'slice.freehand', params: { cut: 'freehand' } } },
  { spec: { kind: 'key', key: 'Enter' }, actionId: 'slice.finish', opts: { id: 'slice.finish' } },
  { spec: { kind: 'key', key: 'Escape' }, actionId: 'slice.cancel', opts: { id: 'slice.cancel' } },
  { spec: { kind: 'key', key: 'Backspace' }, actionId: 'slice.dropPoint', opts: { id: 'slice.dropPoint' } },
];

/**
 * Knife tool. A drag cuts along a straight line, and an Alt-drag along its
 * freehand trail, through `sliceAction`. Clicks place a cut one point at a
 * time: Enter or a double-click commits it, Escape discards it, Backspace
 * takes back the last point, and a click on the first point closes it into a
 * loop and commits. While points are placed, a drag places one more where it
 * is released instead of cutting on its own.
 *
 * Every cut goes to the `slice` dep, which decides what it does to the scene.
 * `<SceneCanvas>` publishes one that cuts every path the cut crosses.
 */
export function useSliceTool(options: UseSliceToolOptions = {}): Tool {
  const scratch = useRef<SliceScratch>({ points: [] }).current;
  const closeHitRef = useLatest(options.closeHitRadius);
  const kitSettings = useKitSettings();
  const live = useMemo(() => createSliceLive(), []);

  const actions = useMemo(() => [
    sliceAction,
    ...createPendingCutActions(scratch, live, () =>
      closeHitRef.current ?? kitSettings.get('targets.sliceCloseHitPx') ?? SLICE_CLOSE_HIT_PX),
  ], [scratch, live, closeHitRef, kitSettings]);

  const overlay = useMemo(() => createPendingCutLayer(scratch, live, () =>
    kitSettings.get('targets.sliceVertexRadiusPx') ?? VERTEX_RADIUS_PX,
  ), [scratch, live, kitSettings]);

  const { keybinding } = options;
  return useMemo(() => defineTool({
    id: 'slice',
    capabilities: ['edits-page'],
    hookName: 'useSliceTool',
    cursor: 'crosshair',
    presentation: { label: 'Slice', icon: icon('core:slice'), group: 'slice' },
    ...(keybinding === null ? {} : { keybinding: keybinding ?? { key: 'K' } }),
    actions,
    overlay,
    onDeactivate: () => resetPendingCut(scratch, live),
    bindings: SLICE_BINDINGS,
  }), [scratch, actions, overlay, keybinding, live]);
}
