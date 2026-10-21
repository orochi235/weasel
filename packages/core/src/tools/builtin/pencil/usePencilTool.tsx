import { useMemo } from 'react';
import { defineTool } from '../../overlayBinding';
import type { Tool } from '../../overlayBinding';
import { insertBindingBehaviors, type InsertToolOptions } from '../shared/insertToolOptions';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../../../icons.gen';

/** A single pointer sample captured during a freehand pencil stroke.
 *
 *  `pressure` / `tiltX` / `tiltY` come straight from the underlying
 *  `PointerEvent`. Mouse and ordinary touch report `pressure: 0.5` while a
 *  button is held, `0` otherwise (per the Pointer Events spec), so a consumer
 *  that wants stylus-only modulation should gate on `pointerType` — the kit
 *  exposes `usePointerStylus()` for that.
 *
 *  The samples reach the `insert` dep as the `pencil` insert extras'
 *  `samples`; a consumer that wants pressure-driven `Stroke.vertexWidths`
 *  reads it off them in its own `insert` dep (`useDepSource('insert', …)`).
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
export function usePencilTool(options: InsertToolOptions = {}): Tool {
  const { behaviors } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'pencil',
        keybinding: { key: 'N' },
        capabilities: ['creates-paths'],
        hookName: 'usePencilTool',
        cursor: cursorFor('pencil', { fallback: 'crosshair' }),
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: icon('pencil'),
        },
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            opts: { id: 'pencil.drag', params: { kind: 'pencil' }, ...insertBindingBehaviors(behaviors) },
          },
        ],
      }),
    [behaviors],
  );
}
