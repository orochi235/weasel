import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { createInsertOp } from 'core/ops/create';
import { schneiderFit } from 'features/paths/schneiderFit';
import { PencilIcon } from '../../icons';
import type { Tool, ToolCtx } from '../types';
import type { PolygonPath } from 'features/paths/types';

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
  const applyBatchRef = useRef<ToolCtx['applyBatch'] | null>(null);

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
            ctx.scratch = { samples: [{ x: ctx.worldX, y: ctx.worldY }] };
            return 'claim';
          },
          onMove: (_e, ctx) => {
            if (!ctx.scratch) return 'pass';
            ctx.scratch.samples.push({ x: ctx.worldX, y: ctx.worldY });
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            applyBatchRef.current = ctx.applyBatch;
            const s = ctx.scratch;
            if (!s || s.samples.length < 2) {
              ctx.scratch = null;
              return 'claim';
            }
            const first = s.samples[0];
            const last = s.samples[s.samples.length - 1];
            const closed = Math.hypot(first.x - last.x, first.y - last.y) < closeThreshold;
            const path = schneiderFit(s.samples, tolerance);
            const node = createRef.current(path, { closed });
            if (node && applyBatchRef.current) {
              applyBatchRef.current([createInsertOp({ node, label })], label);
            }
            ctx.scratch = null;
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
          },
        },
      }),
    [label, tolerance, closeThreshold],
  );
}
