import { useMemo } from 'react';
import {
  DEFAULT_SHAPE_PAINT, defineTool, INSERT_DRAG_MODS, insertBindingBehaviors, type InsertToolOptions,
  shapeToolOptions,
} from '@weasel-js/core';
import type { Tool } from '@weasel-js/core';
import { shareToolOptions } from '@weasel-js/routing';
import { cursorFor } from '@weasel-js/cursor';
import { icon } from '../icons.gen';
import type {} from '../actionParamSchema';

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

/** The pencil tool's options: the stroke it draws with, shared with every shape tool. */
export const PENCIL_TOOL_OPTIONS = shapeToolOptions({
  actionId: 'insert', name: 'Pencil', keys: ['stroke', 'strokeWidth'], style: { stroke: DEFAULT_SHAPE_PAINT },
});

/**
 * Freehand pencil tool. The `drag` binding routes to `insertAction`,
 * which accumulates the pointer trail and commits it as
 * `{ kind: 'pencil', samples }`. The kit's default `insert` dep runs
 * `schneiderFit` over the samples to produce a cubic-Bezier path.
 */
export function usePencilTool(options: InsertToolOptions = {}): Tool {
  const { behaviors, share } = options;
  return useMemo(
    () =>
      defineTool({
        id: 'pencil',
        keybinding: { key: 'N' },
        capabilities: ['creates-paths'],
        hookName: 'usePencilTool',
        options: shareToolOptions(PENCIL_TOOL_OPTIONS, share),
        cursor: cursorFor('pencil', { fallback: 'crosshair' }),
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: icon('core:pencil'),
        },
        bindings: [
          {
            spec: { kind: 'drag', mods: INSERT_DRAG_MODS },
            actionId: 'insert',
            opts: { id: 'pencil.drag', params: { kind: 'pencil' }, ...insertBindingBehaviors(behaviors) },
          },
        ],
      }),
    [behaviors, share],
  );
}
