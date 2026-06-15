import { useMemo, useReducer, useRef } from 'react';
import { defineTool } from '../../routing';
import { PencilIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool } from '../../types';
import type { PolygonPath } from 'features/paths/types';

const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;

/** A single pointer sample captured during a freehand pencil stroke.
 *
 *  `pressure` / `tiltX` / `tiltY` come straight from the underlying
 *  `PointerEvent` and let downstream consumers modulate stroke width or
 *  opacity by stylus input. Mouse and ordinary touch report
 *  `pressure: 0.5` while a button is held, `0` otherwise (per the Pointer
 *  Events spec), so a consumer that wants stylus-only modulation should
 *  gate on `pointerType` from the originating event — the kit exposes
 *  `usePointerStylus()` for that. */
export interface PencilPoint {
  x: number;
  y: number;
  /** 0..1. Optional for backward compat — older `create` factories that
   *  treat samples as `{x,y}` keep working. */
  pressure?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltX?: number;
  /** Degrees, ±90. Zero for mouse/touch. */
  tiltY?: number;
  /** Per-sample stroke width, populated when the tool's
   *  `pressureToWidth` option is set. Consumers can read these widths to
   *  build a parallel `vertexWidths` array for a tapered stroke. */
  width?: number;
}

export interface UsePencilToolOptions<TNode extends { id: string }> {
  create: (path: PolygonPath, opts: { closed: boolean; widths?: number[] }) => TNode | null;
  label?: string;
  tolerance?: number;
  closeThreshold?: number;
  /** Optional callback that maps a captured sample to a stroke width.
   *  When provided, every PencilPoint gets a `width` field and the
   *  consumer's `create` factory also receives `widths`: one width per
   *  output bezier anchor, ready to drop into `Stroke.vertexWidths`. The
   *  default `pressureToWidth(p, { minWidth, maxWidth, gamma })` helper
   *  is a common drop-in. */
  pressureToWidth?: (sample: PencilPoint) => number;
}

/** @internal */
interface PencilScratch {
  samples: PencilPoint[];
}

/**
 * Freehand pencil tool. Captures pointer samples through the drag, then
 * runs `schneiderFit` on release to produce a cubic-Bezier path. If the
 * first and last samples are within `closeThreshold` world units, the
 * `create` factory receives `{ closed: true }` so the consumer can close
 * its path.
 */
export function usePencilTool<TNode extends { id: string }>(
  options: UsePencilToolOptions<TNode>,
): Tool<PencilScratch | null> {
  const {
    create,
    label = 'Insert pencil path',
    tolerance = 2.0,
    closeThreshold = 8.0,
    pressureToWidth,
  } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const widthFnRef = useRef(pressureToWidth);
  widthFnRef.current = pressureToWidth;

  // Live samples for the ghost overlay. The ref is the synchronous read
  // surface the overlay's draw closure consults; the forceRender bump
  // triggers a re-render so the layer redraws each move. Scratch carries
  // the same array by reference so both views agree.
  const samplesRef = useRef<PencilPoint[] | null>(null);
  const [, forceRender] = useReducer((n: number) => n + 1, 0);
  const forceRenderRef = useRef(forceRender);
  forceRenderRef.current = forceRender;

  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'pencil-tool-overlay',
      label: 'Pencil preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View): DrawCommand[] => {
        const samples = samplesRef.current;
        if (!samples || samples.length < 2) return [];
        const t = viewToTransform(view);
        const b = new PathBuilder();
        const [sx0, sy0] = worldToScreen(samples[0].x, samples[0].y, t);
        b.moveTo(sx0, sy0);
        for (let i = 1; i < samples.length; i++) {
          const [sx, sy] = worldToScreen(samples[i].x, samples[i].y, t);
          b.lineTo(sx, sy);
        }
        return [{
          kind: 'path',
          path: b.build(),
          stroke: { paint: { color: GHOST_STROKE }, width: GHOST_LINE_WIDTH },
        }];
      },
    }),
    [],
  );

  return useMemo(
    () =>
      defineTool<PencilScratch>({
        id: 'pencil',
        capabilities: ['creates-paths'],
        hookName: 'usePencilTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: <PencilIcon />,
        },
        // Declarative binding routes empty-space drags through the
        // dispatcher + insertAction. bindingsOverrideDrag suppresses the
        // legacy drag channel in the dispatcher; the route-table entry below
        // is retained as dead code until Phase 14e removes it.
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            opts: { params: { kind: 'pencil' } },
          },
        ],
        initial: {
          overlay: () => overlay,
        },
      }) as Tool<PencilScratch | null>,
    [label, tolerance, closeThreshold, overlay],
  );
}

