import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { EnteredGroupDep } from 'canvas/deps/enteredGroup';
import { rectPathFor } from './handleCommands';

/** How the frame around the entered group is drawn. */
export const ENTERED_FRAME_STROKE = {
  paint: { kind: 'solid' as const, color: '#a48bd4' },
  width: 1,
  dash: [6, 4],
};

/**
 * The frame around the group a canvas is working inside: one dashed outline on the group's
 * box, in the selection chrome's own screen space, repainting when the entered group changes.
 */
export function createEnteredGroupFrameLayer(opts: {
  entered: EnteredGroupDep;
  /** The box to frame, in world units. */
  boundsOf: (id: string) => Bounds | null;
}): RenderLayer<unknown> {
  return {
    id: 'entered-group-frame',
    label: 'Entered group',
    space: 'screen',
    subscribe: (repaint) => opts.entered.subscribe(repaint),
    draw: (_data, view) => {
      const id = opts.entered.get();
      const b = id === null ? null : opts.boundsOf(id);
      if (b === null) return [];
      const [x, y] = worldToScreen(b.x, b.y, viewToTransform(view));
      return [{
        kind: 'path',
        path: rectPathFor(x, y, b.width * view.scale.x, b.height * view.scale.y),
        stroke: ENTERED_FRAME_STROKE,
      }];
    },
  };
}

export function useEnteredGroupFrameLayer(
  entered: EnteredGroupDep,
  boundsOf: (id: string) => Bounds | null,
): RenderLayer<unknown> {
  return useMemo(() => createEnteredGroupFrameLayer({ entered, boundsOf }), [entered, boundsOf]);
}
