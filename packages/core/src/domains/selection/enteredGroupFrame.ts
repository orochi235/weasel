import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { EnteredGroupApi } from 'canvas/deps/enteredGroup';
import { rectPathFor } from './handleCommands';

/** The theme token the frame reads its color from, set on the canvas or any element above it. */
export const ENTERED_FRAME_TOKEN = '--wzl-entered-group';
/** The frame's color where nothing sets {@link ENTERED_FRAME_TOKEN}. */
export const ENTERED_FRAME_COLOR = '#a48bd4';
const FRAME_WIDTH = 1;
const FRAME_DASH = [6, 4];

/**
 * The frame around the group a canvas is working inside: one dashed outline on the group's
 * box, in the selection chrome's own screen space, repainting when the entered group changes.
 */
export function createEnteredGroupFrameLayer(opts: {
  entered: EnteredGroupApi;
  /** The box to frame, in world units. */
  boundsOf: (id: string) => Bounds | null;
  /** The frame's color, read at each paint. Default {@link ENTERED_FRAME_COLOR}. */
  color?: () => string;
  /** Hears that `color` may answer differently: a theme or mode switch. */
  colorChanged?: (fn: () => void) => () => void;
}): RenderLayer<unknown> {
  return {
    id: 'entered-group-frame',
    label: 'Entered group',
    space: 'screen',
    subscribe: (repaint) => {
      const offGroup = opts.entered.subscribe(repaint);
      const offColor = opts.colorChanged?.(repaint);
      return () => { offGroup(); offColor?.(); };
    },
    draw: (_data, view) => {
      const id = opts.entered.get();
      const b = id === null ? null : opts.boundsOf(id);
      if (b === null) return [];
      const [x, y] = worldToScreen(b.x, b.y, viewToTransform(view));
      return [{
        kind: 'path',
        path: rectPathFor(x, y, b.width * view.scale.x, b.height * view.scale.y),
        stroke: {
          paint: { kind: 'solid', color: opts.color?.() ?? ENTERED_FRAME_COLOR },
          width: FRAME_WIDTH,
          dash: FRAME_DASH,
        },
      }];
    },
  };
}

export function useEnteredGroupFrameLayer(
  entered: EnteredGroupApi,
  boundsOf: (id: string) => Bounds | null,
  color: { read: () => string; changed: (fn: () => void) => () => void },
): RenderLayer<unknown> {
  return useMemo(
    () => createEnteredGroupFrameLayer({ entered, boundsOf, color: color.read, colorChanged: color.changed }),
    [entered, boundsOf, color],
  );
}
