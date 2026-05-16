import { useMemo, useReducer, useRef } from 'react';
import { defineTool, begin, claim } from '../../routing';
import { createInsertOp } from 'core/ops/create';
import { schneiderFit } from 'features/paths/schneiderFit';
import { PencilIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { forEachCoalesced } from 'core/pointer/stylus';
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
}

export interface UsePencilToolOptions<TNode extends { id: string }> {
  create: (path: PolygonPath, opts: { closed: boolean }) => TNode | null;
  label?: string;
  tolerance?: number;
  closeThreshold?: number;
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
  } = options;
  const createRef = useRef(create);
  createRef.current = create;

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
        keybinding: { key: 'N' },
        cursor: 'crosshair',
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: <PencilIcon />,
        },
        initial: {
          overlay: () => overlay,
          drag: (ctx) => {
            const samples: PencilPoint[] = [{ x: ctx.worldX, y: ctx.worldY }];
            samplesRef.current = samples;
            forceRenderRef.current();
            return begin({
              scratch: { samples },
              onMove: (c, event) => {
                if (event) {
                  // When the browser merged multiple high-frequency stylus
                  // samples (Apple Pencil at ~240Hz, drawing tablets) into
                  // one parent `pointermove`, iterate each sub-event for
                  // smoother strokes. Otherwise use the dispatcher-derived
                  // ctx.worldX/Y so behavior matches pre-stylus pencil.
                  const ext = event as unknown as { getCoalescedEvents?: () => PointerEvent[] };
                  const sub = ext.getCoalescedEvents?.();
                  if (sub && sub.length > 1) {
                    forEachCoalesced(event, c, (s) => {
                      samples.push({
                        x: s.worldX,
                        y: s.worldY,
                        pressure: s.stylus.pressure,
                        tiltX: s.stylus.tiltX,
                        tiltY: s.stylus.tiltY,
                      });
                    });
                  } else {
                    samples.push({
                      x: c.worldX,
                      y: c.worldY,
                      pressure: event.pressure,
                      tiltX: event.tiltX ?? 0,
                      tiltY: event.tiltY ?? 0,
                    });
                  }
                } else {
                  samples.push({ x: c.worldX, y: c.worldY });
                }
                forceRenderRef.current();
                return claim();
              },
              onRelease: (c) => {
                if (samples.length < 2) {
                  samplesRef.current = null;
                  forceRenderRef.current();
                  return claim();
                }
                const first = samples[0];
                const last = samples[samples.length - 1];
                const closed = Math.hypot(last.x - first.x, last.y - first.y) <= closeThreshold;
                const path = schneiderFit(samples, tolerance);
                const node = createRef.current(path, { closed });
                if (node) {
                  c.applyOps([createInsertOp({ node, label })], label);
                }
                samplesRef.current = null;
                forceRenderRef.current();
                return claim();
              },
              onCancel: () => {
                samplesRef.current = null;
                forceRenderRef.current();
              },
            });
          },
        },
      }) as Tool<PencilScratch | null>,
    [label, tolerance, closeThreshold, overlay],
  );
}
