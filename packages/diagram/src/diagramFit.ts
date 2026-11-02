/**
 * How `DiagramView` frames its diagram: the fit it opens on, and the fits that
 * replace it — a settled layout run, specs that no longer fit in view, or a
 * call to `fit()` — each applied only while the view is still the last fit,
 * except `fit()`, which takes the view back.
 */
import { RIGID_POSE_COMPOSITION, worldPosesOf, clampView, fitViewToBounds, useLatest, viewportWorldRect, type Bounds, type RectPose, type SceneCanvasApi, type View } from '@weasel-js/core';
import { useEffect, useMemo, useRef, useState, type RefObject } from 'react';
import { isBodyOrRegion } from './bodyNode';
import { diagramEdgeOf } from './edgeTrait';
import { diagramGroupOf } from './group';

/** How `fitDiagram` frames a diagram in its box. */
export interface DiagramFit {
  minScale?: number;
  maxScale?: number;
  anchor?: 'center' | 'start';
  padding?: number;
  /** A world rect every fit is kept inside, as `SceneCanvas` keeps every view inside its `viewBounds`. */
  bounds?: Bounds;
}

/** The space a fit keeps clear around a diagram, in CSS pixels, and a bounded view's margin in world units. */
export const DEFAULT_FIT_PADDING = 16;

type Boxes = readonly { id?: string; kind: string; pose: unknown; data: unknown; parent?: string | null }[];

/** The world rect every node box, group box and route point takes, and `extra`, or `null` for none. */
function diagramBounds(specs: Boxes, extra?: Bounds): Bounds | null {
  const world = worldPosesOf(specs as never, RIGID_POSE_COMPOSITION);
  const boxes: Bounds[] = specs.filter((s) => isBodyOrRegion(s) || diagramGroupOf(s) !== null)
    .map((s) => (world.get((s as { id?: string }).id ?? '') ?? s.pose) as RectPose);
  for (const s of specs) {
    const edge = diagramEdgeOf(s);
    for (const p of [...(edge?.waypoints ?? []), ...(edge?.route ?? [])]) boxes.push({ x: p.x, y: p.y, width: 0, height: 0 });
  }
  if (extra !== undefined) boxes.push(extra);
  if (boxes.length === 0) return null;
  const x = Math.min(...boxes.map((b) => b.x));
  const y = Math.min(...boxes.map((b) => b.y));
  return {
    x,
    y,
    width: Math.max(...boxes.map((b) => b.x + b.width)) - x,
    height: Math.max(...boxes.map((b) => b.y + b.height)) - y,
  };
}

/** The view `DiagramView` opens on: every node box and group box in view, never above
 *  `maxScale` (default 1) and never below `minScale`. `extra` is further bounds to take in, such as the
 *  pages'. Takes specs, or a scene's nodes at the poses they are drawn at. */
export function fitDiagram(
  specs: Boxes,
  size: { width: number; height: number },
  fit: DiagramFit = {},
  extra?: Bounds,
): View | undefined {
  const bounds = diagramBounds(specs, extra);
  if (bounds === null) return undefined;
  const view = fitViewToBounds(bounds, size, { x: 0, y: 0, scale: { x: 1, y: 1 } }, {
    maxScale: fit.maxScale ?? 1,
    ...(fit.minScale !== undefined ? { minScale: fit.minScale } : {}),
    ...(fit.anchor !== undefined ? { anchor: fit.anchor } : {}),
    padding: fit.padding ?? DEFAULT_FIT_PADDING,
  });
  // Clamped here as the canvas would clamp it, so the view the canvas holds is the fit itself, and
  // a later fit still sees the view as untouched.
  return fit.bounds === undefined ? view : clampView(view, fit.bounds, size);
}

/** The world rect a bounded diagram's view stays inside: every node box, group box and route
 *  point, and `extra`, with `padding` world units around them; `undefined` for an empty diagram. */
export function diagramViewBounds(specs: Boxes, padding: number, extra?: Bounds): Bounds | undefined {
  const b = diagramBounds(specs, extra);
  return b === null ? undefined : { x: b.x - padding, y: b.y - padding, width: b.width + 2 * padding, height: b.height + 2 * padding };
}

const IDENTITY: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const sameView = (a: View, b: View) =>
  a.x === b.x && a.y === b.y && a.scale.x === b.scale.x && a.scale.y === b.scale.y;

/** Whether `inner` lies inside what `view` shows of a `size` box. */
function inView(inner: Bounds, view: View, size: { width: number; height: number }): boolean {
  const shown = viewportWorldRect(view, size);
  return inner.x >= shown.x && inner.y >= shown.y
    && inner.x + inner.width <= shown.x + shown.width && inner.y + inner.height <= shown.y + shown.height;
}

export interface DiagramFitting {
  /** The fit the canvas opens on, before anything replaces it. */
  defaultView: View | undefined;
  /** Fit the diagram as it now stands, if the view is still the last fit. */
  settle: () => void;
  /** Fit the diagram as it now stands, whatever the view is. */
  fitNow: () => void;
}

export function useDiagramFit(args: {
  canvasRef: RefObject<SceneCanvasApi | null>;
  specs: Boxes;
  /** The nodes as they stand now, at the poses they are drawn at. */
  current: () => Boxes;
  controlled: boolean;
  size: { width: number; height: number };
  fit: DiagramFit;
  /** Further bounds every fit takes in, such as the pages'. */
  extra: Bounds | undefined;
  /** When new specs refit a view still on its last fit: only once they run past it (`'overflow'`,
   *  the default), or on every change (`'always'`). */
  refit?: 'overflow' | 'always';
}): DiagramFitting {
  const { canvasRef, specs, controlled, size, fit, extra } = args;
  // A filling canvas is 0 × 0 until measured, and no box to fit into.
  const unsized = size.width === 0 || size.height === 0;
  const defaultView = useMemo(
    () => (controlled || unsized ? undefined : fitDiagram(specs, size, fit, extra)),
    // A later `specs` is the refit check's to answer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [controlled, unsized, size.width, size.height, fit.minScale, fit.maxScale, fit.anchor, fit.padding, extra],
  );
  // A later fit holds until the box or a fit option changes.
  const [later, setLater] = useState<{ view: View | undefined; over: View | undefined } | null>(null);
  const target = later !== null && later.over === defaultView ? later.view : defaultView;
  const fitted = useRef(target);
  const opts = useLatest({ controlled, unsized, size, fit, extra, defaultView, current: args.current, refit: args.refit ?? 'overflow' });

  useEffect(() => {
    const canvas = canvasRef.current;
    const was = fitted.current;
    if (canvas === null || target === undefined || was === target) return;
    // A view the user has panned or zoomed off its fit is theirs to keep.
    if (!sameView(canvas.getView(), was ?? IDENTITY)) return;
    fitted.current = target;
    canvas.setView(target);
  }, [canvasRef, target]);

  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const { controlled: c, unsized: u, size: box, fit: f, extra: more, defaultView: over, refit } = opts.current;
    const canvas = canvasRef.current;
    const bounds = diagramBounds(specs, more);
    if (c || u || canvas === null || bounds === null) return;
    if (refit === 'overflow' && inView(bounds, canvas.getView(), box)) return;
    setLater({ view: fitDiagram(specs, box, f, more), over });
  }, [specs, canvasRef, opts]);

  return useMemo(() => {
    const now = () => {
      const { size: box, fit: f, extra: more, current } = opts.current;
      return fitDiagram(current(), box, f, more);
    };
    return {
      defaultView,
      settle: () => {
        if (opts.current.controlled) return;
        setLater({ view: now(), over: opts.current.defaultView });
      },
      fitNow: () => {
        const canvas = canvasRef.current;
        const view = now();
        if (canvas === null || view === undefined) return;
        fitted.current = view;
        canvas.setView(view);
      },
    };
  }, [defaultView, canvasRef, opts]);
}
