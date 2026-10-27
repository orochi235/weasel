import { useMemo } from 'react';
import type { RenderLayer } from 'core/layers/render';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { viewToTransform } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { EnteredGroupApi } from 'canvas/deps/enteredGroup';
import { rectPathFor } from './handleCommands';
import { transformPath, type Path } from '@weasel-js/geom';
import type { DrawCommand } from '@weasel-js/renderer';
import type { NodeId, Scene } from 'core/scene/types';
import { enteredOperandOutlines } from './enteredOperands';

/** The theme token the frame reads its color from, set on the canvas or any element above it. */
export const ENTERED_FRAME_TOKEN = '--wzl-entered-group';
/** The frame's color where nothing sets {@link ENTERED_FRAME_TOKEN}. */
export const ENTERED_FRAME_COLOR = '#a48bd4';
const FRAME_WIDTH = 1;
const FRAME_DASH = [6, 4];

/**
 * The frame around the group a canvas is working inside: one dashed outline on the group's
 * box, in the selection chrome's own screen space, repainting when the entered group changes.
 * Inside a boolean group, whose children are drawn only through its result, each of them is
 * outlined too.
 */
export function createEnteredGroupFrameLayer(opts: {
  entered: EnteredGroupApi;
  /** The box to frame, in world units. */
  boundsOf: (id: string) => Bounds | null;
  /** The frame's color, read at each paint. Default {@link ENTERED_FRAME_COLOR}. */
  color?: () => string;
  /** Hears that `color` may answer differently: a theme or mode switch. */
  colorChanged?: (fn: () => void) => () => void;
  /** The world outlines to draw while `id` is entered: `enteredOperandOutlines`. */
  outlinesOf?: (id: string) => readonly Path[];
  /** Hears that `outlinesOf` may answer differently: a scene edit or a pose override. */
  outlinesChanged?: (fn: () => void) => () => void;
}): RenderLayer<unknown> {
  return {
    id: 'entered-group-frame',
    label: 'Entered group',
    space: 'screen',
    subscribe: (repaint) => {
      const offGroup = opts.entered.subscribe(repaint);
      const offColor = opts.colorChanged?.(repaint);
      const offOutlines = opts.outlinesChanged?.(repaint);
      return () => { offGroup(); offColor?.(); offOutlines?.(); };
    },
    draw: (_data, view) => {
      const id = opts.entered.get();
      const b = id === null ? null : opts.boundsOf(id);
      if (b === null) return [];
      const t = viewToTransform(view);
      const [x, y] = worldToScreen(b.x, b.y, t);
      const paint = { kind: 'solid', color: opts.color?.() ?? ENTERED_FRAME_COLOR } as const;
      const toScreen = [t.zoom.x, 0, 0, t.zoom.y, t.panX, t.panY] as const;
      const outlines: DrawCommand[] = (opts.outlinesOf?.(id!) ?? []).map((p) => ({
        kind: 'path', path: transformPath(p, toScreen), stroke: { paint, width: FRAME_WIDTH },
      }));
      return [...outlines, {
        kind: 'path',
        path: rectPathFor(x, y, b.width * view.scale.x, b.height * view.scale.y),
        stroke: { paint, width: FRAME_WIDTH, dash: FRAME_DASH },
      }];
    },
  };
}

/** The frame layer over `scene`, outlining a boolean group's children while it is entered. */
export function useEnteredGroupFrameLayer(
  entered: EnteredGroupApi,
  boundsOf: (id: string) => Bounds | null,
  color: { read: () => string; changed: (fn: () => void) => () => void },
  scene?: Scene<unknown, string, unknown>,
): RenderLayer<unknown> {
  return useMemo(
    () => createEnteredGroupFrameLayer({
      entered, boundsOf, color: color.read, colorChanged: color.changed,
      ...(scene ? {
        outlinesOf: (id: string) => enteredOperandOutlines(scene, id as NodeId),
        outlinesChanged: (fn: () => void) => {
          const whileEntered = () => { if (entered.get() !== null) fn(); };
          const offScene = scene.subscribe(whileEntered);
          const offOverrides = scene.overrides.subscribe(whileEntered);
          return () => { offScene(); offOverrides(); };
        },
      } : {}),
    }),
    [entered, boundsOf, color, scene],
  );
}
