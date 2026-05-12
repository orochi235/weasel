import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../defineTool';
import { createInsertOp } from 'core/ops/create';
import { schneiderFit } from 'features/paths/schneiderFit';
import { PencilIcon } from '../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../renderer';
import type { Tool, ToolCtx } from '../types';
import type { PolygonPath } from 'features/paths/types';

const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;

export interface PencilPoint { x: number; y: number }

export interface UsePencilToolOptions<TNode extends { id: string }> {
  create: (path: PolygonPath, opts: { closed: boolean }) => TNode | null;
  label?: string;
  tolerance?: number;
  closeThreshold?: number;
}

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
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);

  // Live samples for the ghost overlay. The ref is the synchronous read
  // surface; the React state bump forces a re-render so the layer redraws
  // each move. Reference identity changes on each bump so memo'd consumers
  // observe the update.
  const [, setSampleTick] = useState(0);
  const samplesRef = useRef<PencilPoint[] | null>(null);
  const bumpSamples = useCallback(() => setSampleTick((n) => n + 1), []);

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
      defineTool<PencilScratch | null>({
        id: 'pencil',
        keybinding: { key: 'N' },
        cursor: 'crosshair',
        initScratch: () => null,
        presentation: {
          label: 'Pencil',
          group: 'draw',
          icon: <PencilIcon />,
        },
        drag: {
          onStart: (_e, ctx) => {
            const samples = [{ x: ctx.worldX, y: ctx.worldY }];
            ctx.scratch = { samples };
            samplesRef.current = samples;
            bumpSamples();
            return 'claim';
          },
          onMove: (_e, ctx) => {
            if (!ctx.scratch) return 'pass';
            ctx.scratch.samples.push({ x: ctx.worldX, y: ctx.worldY });
            // samplesRef already points at ctx.scratch.samples (same array
            // identity); bumping the tick forces React to redraw the overlay.
            bumpSamples();
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            applyOpsRef.current = ctx.applyOps;
            const s = ctx.scratch;
            if (!s || s.samples.length < 2) {
              ctx.scratch = null;
              samplesRef.current = null;
              bumpSamples();
              return 'claim';
            }
            const first = s.samples[0];
            const last = s.samples[s.samples.length - 1];
            const closed = Math.hypot(first.x - last.x, first.y - last.y) < closeThreshold;
            const path = schneiderFit(s.samples, tolerance);
            const node = createRef.current(path, { closed });
            if (node && applyOpsRef.current) {
              applyOpsRef.current([createInsertOp({ node, label })], label);
            }
            ctx.scratch = null;
            samplesRef.current = null;
            bumpSamples();
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
            samplesRef.current = null;
            bumpSamples();
          },
        },
        overlay,
      }),
    [label, tolerance, closeThreshold, overlay, bumpSamples],
  );
}
