import { useMemo, useRef } from 'react';
import { defineTool } from '../defineTool';
import { createInsertOp } from 'core/ops/create';
import { LineIcon } from '../../icons';
import type { Tool, ToolCtx } from '../types';

export interface LinePoint { x: number; y: number }

export interface UseLineToolOptions<TNode extends { id: string }> {
  create: (a: LinePoint, b: LinePoint) => TNode | null;
  label?: string;
  minLength?: number;
}

interface LineScratch {
  start: LinePoint;
  current: LinePoint;
}

function snapTo15Degrees(start: LinePoint, end: LinePoint): LinePoint {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const len = Math.hypot(dx, dy);
  if (len === 0) return end;
  const ang = Math.atan2(dy, dx);
  const step = Math.PI / 12; // 15°
  const snapped = Math.round(ang / step) * step;
  return {
    x: start.x + len * Math.cos(snapped),
    y: start.y + len * Math.sin(snapped),
  };
}

/**
 * Click-down → drag → release-place line tool. Commits via the consumer's
 * `create` factory called with the two endpoints. Modifiers:
 *   - shift: constrain to 15° increments
 *   - alt: mirror end around start (drag is treated as half-line)
 */
export function useLineTool<TNode extends { id: string }>(
  options: UseLineToolOptions<TNode>,
): Tool<LineScratch | null> {
  const { create, label = 'Insert line', minLength = 0 } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const applyOpsRef = useRef<ToolCtx['applyOps'] | null>(null);

  return useMemo(
    () =>
      defineTool<LineScratch | null>({
        id: 'line',
        keybinding: { key: '\\' },
        cursor: 'crosshair',
        initScratch: () => null,
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: <LineIcon />,
        },
        drag: {
          onStart: (_e, ctx) => {
            ctx.scratch = {
              start: { x: ctx.worldX, y: ctx.worldY },
              current: { x: ctx.worldX, y: ctx.worldY },
            };
            return 'claim';
          },
          onMove: (_e, ctx) => {
            const s = ctx.scratch as LineScratch | null;
            if (!s) return 'pass';
            s.current = { x: ctx.worldX, y: ctx.worldY };
            return 'claim';
          },
          onEnd: (_e, ctx) => {
            applyOpsRef.current = ctx.applyOps;
            const s = ctx.scratch as LineScratch | null;
            if (!s) return 'claim';
            let a = s.start;
            let b = s.current;
            if (ctx.modifiers.shift) b = snapTo15Degrees(a, b);
            if (ctx.modifiers.alt) {
              a = { x: a.x - (b.x - a.x), y: a.y - (b.y - a.y) };
            }
            const len = Math.hypot(b.x - a.x, b.y - a.y);
            if (len < minLength) {
              ctx.scratch = null;
              return 'claim';
            }
            const node = createRef.current(a, b);
            if (node) {
              applyOpsRef.current([createInsertOp({ node, label })], label);
            }
            ctx.scratch = null;
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
          },
        },
      }),
    [label, minLength],
  );
}
