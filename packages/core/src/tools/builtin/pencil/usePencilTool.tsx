import { useMemo } from 'react';
import { defineTool } from '../../routing';
import { PencilIcon } from '../../../icons';
import type { Tool } from '../../types';

/** A single pointer sample captured during a freehand pencil stroke.
 *
 *  `pressure` / `tiltX` / `tiltY` come straight from the underlying
 *  `PointerEvent` and let downstream consumers modulate stroke width or
 *  opacity by stylus input. Mouse and ordinary touch report
 *  `pressure: 0.5` while a button is held, `0` otherwise (per the Pointer
 *  Events spec), so a consumer that wants stylus-only modulation should
 *  gate on `pointerType` from the originating event — the kit exposes
 *  `usePointerStylus()` for that.
 *
 *  The dispatcher accumulates these on the drag trail and hands the whole
 *  array to `insertAction`, which forwards it as the `pencil` insert
 *  extras' `samples`. A consumer that wants pressure-driven
 *  `Stroke.vertexWidths` reads it off the samples in its own `insert` dep
 *  (`useDepSource('insert', …)`) — see `apps/site/demos/VertexWidthsDemo.tsx`.
 */
export interface PencilPoint {
  x: number;
  y: number;
  /** 0..1. Absent when the originating event carried no pressure. */
  pressure?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltX?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltY?: number;
}

/**
 * Freehand pencil tool. The `drag` binding routes to `insertAction`,
 * which accumulates the pointer trail and commits it as
 * `{ kind: 'pencil', samples }`. The kit's default `insert` dep runs
 * `schneiderFit` over the samples to produce a cubic-Bezier path.
 */
export function usePencilTool(): Tool<null> {
  return useMemo(
    () =>
      defineTool<null>({
        id: 'pencil',
        capabilities: ['creates-paths'],
        hookName: 'usePencilTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: <PencilIcon />,
        },
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            opts: { params: { kind: 'pencil' } },
          },
        ],
        initial: {},
      }),
    [],
  );
}
