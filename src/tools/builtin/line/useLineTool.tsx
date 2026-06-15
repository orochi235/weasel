import { useCallback, useMemo, useRef, useState } from 'react';
import { defineTool } from '../../routing';
import { LineIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool } from '../../types';

const GHOST_STROKE = '#7fb069';
const GHOST_LINE_WIDTH = 1;
const GHOST_DASH: number[] = [4, 4];

export interface LinePoint { x: number; y: number }

export interface UseLineToolOptions<TNode extends { id: string }> {
  create: (a: LinePoint, b: LinePoint) => TNode | null;
  label?: string;
  minLength?: number;
  /** Optional: snap world-space points to the active grid (or any other
   *  snap target). Applied to every coord the gesture ingests, so both the
   *  live overlay and the committed endpoints use the snapped values.
   *
   *  Order with modifiers: the Shift-constrain-to-15° branch runs on raw
   *  coords first, then the result is snapped — this preserves the user
   *  intent (constrain the angle), then aligns the endpoint to grid. */
  snapPoint?: (p: LinePoint) => LinePoint;
}

/** @internal */
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
  const { create, label = 'Insert line', minLength = 0, snapPoint } = options;
  const createRef = useRef(create);
  createRef.current = create;
  const snapPointRef = useRef(snapPoint);
  snapPointRef.current = snapPoint;

  // Live overlay state: setLineState fires React re-renders on every move
  // so the ghost layer redraws as the user drags. Ref tracks the same
  // value for synchronous reads inside the overlay closure. Kept for
  // parity with the imperative tool — the routing factory's begin() writes
  // scratch into the dispatcher's ctx but doesn't trigger a re-render on
  // its own.
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
        // Apply the Shift-constrain-to-15° branch BEFORE snap (per the
        // gesture's modifier-ordering rule): the user's intent is to lock
        // the angle, then we round the endpoint to the grid.
        if (s.shift) b = snapTo15Degrees(a, b);
        const sp = snapPointRef.current;
        if (sp) b = sp(b);
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
      defineTool<LineScratch>({
        id: 'line',
        capabilities: ['creates-shapes'],
        hookName: 'useLineTool',
        cursor: 'crosshair',
        presentation: {
          label: 'Line',
          group: 'shape',
          icon: <LineIcon />,
        },
        // Declarative binding routes empty-space drags through the
        // dispatcher + insertAction. bindingsOverrideDrag suppresses the
        // legacy drag channel in the dispatcher; the route-table entry below
        // is retained as dead code until Phase 14e removes it.
        bindings: [
          {
            spec: { kind: 'drag' },
            actionId: 'insert',
            opts: { params: { kind: 'line' } },
          },
        ],
        initial: {
          overlay: () => overlay,
        },
      }) as Tool<LineScratch | null>,
    [label, minLength, overlay, writeState],
  );
}
