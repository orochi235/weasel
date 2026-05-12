import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../defineTool';
import { createInsertOp } from 'core/ops/create';
import { LineIcon } from '../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../renderer';
import type { Tool, ToolCtx } from '../types';

const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;
const GHOST_DASH: number[] = [4, 4];

export interface LinePoint { x: number; y: number }

export interface UseLineToolOptions<TNode extends { id: string }> {
  create: (a: LinePoint, b: LinePoint) => TNode | null;
  label?: string;
  minLength?: number;
}

interface LineScratch {
  start: LinePoint;
  current: LinePoint;
  /** Modifier snapshot captured on the latest move — used by the live
   *  overlay so the ghost reflects shift-snap / alt-mirror in real time. */
  shift: boolean;
  alt: boolean;
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

  // Live overlay state: setLineState fires React re-renders on every move
  // so the ghost layer redraws as the user drags. Ref tracks the same
  // value for synchronous reads inside the overlay closure.
  const [, setLineState] = useState<LineScratch | null>(null);
  const lineStateRef = useRef<LineScratch | null>(null);
  const writeState = useCallback((next: LineScratch | null) => {
    lineStateRef.current = next;
    setLineState(next);
  }, []);

  // Mirror the modifier-driven end-resolution logic in the overlay so the
  // ghost reflects shift / alt the same way the committed geometry will.
  const overlay = useMemo<RenderLayer<unknown>>(
    () => ({
      id: 'line-tool-overlay',
      label: 'Line preview',
      space: 'screen' as const,
      draw: (_data: unknown, view: View): DrawCommand[] => {
        const s = lineStateRef.current;
        if (!s) return [];
        let a = s.start;
        let b = s.current;
        if (s.shift) b = snapTo15Degrees(a, b);
        if (s.alt) {
          a = { x: a.x - (b.x - a.x), y: a.y - (b.y - a.y) };
        }
        if (a.x === b.x && a.y === b.y) return [];
        const t = viewToTransform(view);
        const [ax, ay] = worldToScreen(a.x, a.y, t);
        const [bx, by] = worldToScreen(b.x, b.y, t);
        const path = new PathBuilder().moveTo(ax, ay).lineTo(bx, by).build();
        return [{
          kind: 'path',
          path,
          stroke: { paint: { color: GHOST_STROKE }, width: GHOST_LINE_WIDTH, dash: GHOST_DASH },
        }];
      },
    }),
    [],
  );

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
            const init: LineScratch = {
              start: { x: ctx.worldX, y: ctx.worldY },
              current: { x: ctx.worldX, y: ctx.worldY },
              shift: ctx.modifiers.shift,
              alt: ctx.modifiers.alt,
            };
            ctx.scratch = init;
            writeState(init);
            return 'claim';
          },
          onMove: (_e, ctx) => {
            const s = ctx.scratch as LineScratch | null;
            if (!s) return 'pass';
            s.current = { x: ctx.worldX, y: ctx.worldY };
            s.shift = ctx.modifiers.shift;
            s.alt = ctx.modifiers.alt;
            writeState({ ...s });
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
              writeState(null);
              return 'claim';
            }
            const node = createRef.current(a, b);
            if (node) {
              applyOpsRef.current([createInsertOp({ node, label })], label);
            }
            ctx.scratch = null;
            writeState(null);
            return 'claim';
          },
          onCancel: (ctx) => {
            ctx.scratch = null;
            writeState(null);
          },
        },
        overlay,
      }),
    [label, minLength, overlay, writeState],
  );
}
