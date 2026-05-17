import { useMemo, useReducer, useRef } from 'react';
import { defineTool, begin, claim } from '../../routing';
import { createInsertOp } from 'core/ops/create';
import { schneiderFit } from 'features/paths/schneiderFit';
import { countPathAnchors } from 'features/paths/anchors';
import { PencilIcon } from '../../../icons';
import { PathBuilder } from 'features/paths/builder';
import { viewToTransform, type View } from 'core/viewport/view';
import { worldToScreen } from 'core/viewport/viewTransform';
import { forEachCoalesced } from 'core/pointer/stylus';
import type { RenderLayer } from 'core/layers/render';
import type { DrawCommand } from '../../../renderer';
import type { Tool } from '../../types';
import type { PolygonPath } from 'features/paths/types';
import { PATH_M, PATH_L, PATH_C, PATH_Q, PATH_Z } from 'features/paths/types';

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

  // Helper: stamp `.width` onto a sample if a pressureToWidth callback is
  // configured. Inlined here so onMove and the coalesced-event branches
  // stay symmetric.
  const stampWidth = (s: PencilPoint): PencilPoint => {
    const fn = widthFnRef.current;
    if (fn) s.width = fn(s);
    return s;
  };

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
        // Phase 14c.1: declarative binding routes empty-space drags through the
        // new dispatcher + insertAction. bindingsOverrideDrag suppresses the
        // legacy drag channel in the dispatcher; the route-table entry below
        // is retained as dead code until Phase 14e removes it.
        bindings: [
          {
            spec: { kind: 'drag', target: 'empty' },
            actionId: 'insert',
            opts: { params: { kind: 'pencil' } },
          },
        ],
        bindingsOverrideDrag: true,
        initial: {
          overlay: () => overlay,
          drag: (ctx) => {
            const samples: PencilPoint[] = [stampWidth({ x: ctx.worldX, y: ctx.worldY })];
            samplesRef.current = samples;
            forceRenderRef.current();
            return begin({
              scratch: { samples },
              onMove: (c, event) => {
                if (event) {
                  const ext = event as unknown as { getCoalescedEvents?: () => PointerEvent[] };
                  const sub = ext.getCoalescedEvents?.();
                  if (sub && sub.length > 1) {
                    forEachCoalesced(event, c, (s) => {
                      samples.push(stampWidth({
                        x: s.worldX,
                        y: s.worldY,
                        pressure: s.stylus.pressure,
                        tiltX: s.stylus.tiltX,
                        tiltY: s.stylus.tiltY,
                      }));
                    });
                  } else {
                    samples.push(stampWidth({
                      x: c.worldX,
                      y: c.worldY,
                      pressure: event.pressure,
                      tiltX: event.tiltX ?? 0,
                      tiltY: event.tiltY ?? 0,
                    }));
                  }
                } else {
                  samples.push(stampWidth({ x: c.worldX, y: c.worldY }));
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
                // When pressureToWidth is configured, derive a per-anchor
                // widths array from the captured samples. schneiderFit
                // uses input samples as its cubic endpoints; we map each
                // path anchor to its closest input sample (exact-match in
                // typical cases) and read the cached `.width`.
                const widths = widthFnRef.current
                  ? deriveAnchorWidths(path, samples)
                  : undefined;
                const node = createRef.current(path, widths != null ? { closed, widths } : { closed });
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

/**
 * Build a per-anchor widths array for a path produced by `schneiderFit`,
 * by pairing each path anchor with its closest input sample (Euclidean
 * distance) and reading the sample's cached `.width`. Anchors with no
 * `.width` data fall back to 1.
 *
 * `schneiderFit` uses input samples as cubic endpoints, so the nearest-
 * sample lookup is usually exact. For straight-cubic / degenerate inputs
 * the mapping still degrades gracefully.
 */
function deriveAnchorWidths(path: PolygonPath, samples: PencilPoint[]): number[] {
  const out: number[] = new Array(countPathAnchors(path));
  // Walk the command stream, recording the (x, y) of each anchor in
  // command-stream order to match the kit's anchor numbering.
  const { commands, coords } = path;
  const anchorXY: number[] = [];
  let ci = 0;
  for (let cmdIdx = 0; cmdIdx < commands.length; cmdIdx++) {
    const cmd = commands[cmdIdx];
    if (cmd === PATH_M || cmd === PATH_L) {
      anchorXY.push(coords[ci], coords[ci + 1]);
      ci += 2;
    } else if (cmd === PATH_Q) {
      ci += 2; // control point
      anchorXY.push(coords[ci], coords[ci + 1]);
      ci += 2;
    } else if (cmd === PATH_C) {
      ci += 4; // two control points
      anchorXY.push(coords[ci], coords[ci + 1]);
      ci += 2;
    } else if (cmd === PATH_Z) {
      // closure, no new anchor
    }
  }
  for (let a = 0; a < out.length; a++) {
    const ax = anchorXY[a * 2], ay = anchorXY[a * 2 + 1];
    let bestDist = Infinity;
    let bestWidth = 1;
    for (const s of samples) {
      const dx = s.x - ax, dy = s.y - ay;
      const d = dx * dx + dy * dy;
      if (d < bestDist) {
        bestDist = d;
        bestWidth = s.width ?? 1;
      }
    }
    out[a] = bestWidth;
  }
  return out;
}
