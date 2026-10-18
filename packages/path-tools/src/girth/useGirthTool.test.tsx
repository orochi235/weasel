import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { boundsOfPath, countPathAnchors, PathBuilder, pathDistanceToPoint, polylineFromPoints, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { DrawCommand } from '@weasel-js/renderer';
import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import {
  createScene, defaultPaintBounds, resolveEditablePathOf, type RectPose, type RenderLayer,
} from '@weasel-js/core';
import { useGirthTool } from './useGirthTool';

type Data = { path?: Path; stroke?: Stroke };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const LINE = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
// Its apex is (50, -45), where it runs in +x: its left edge is above it.
const ARC = new PathBuilder().moveTo(0, 0).curveTo(30, -60, 70, -60, 100, 0).build();

/** The largest distance from a point of one path's flattening to the other path, both ways. */
function shapeGap(a: Path, b: Path): number {
  let worst = 0;
  for (const [from, to] of [[a, b], [b, a]] as const) {
    for (const pl of extractPolylines(from, { flattenTolerance: 0.01 })) {
      for (let i = 0; i < pl.points.length; i += 2) {
        worst = Math.max(worst, pathDistanceToPoint(to, pl.points[i], pl.points[i + 1]));
      }
    }
  }
  return worst;
}

const centerOf = (cmd: DrawCommand) => {
  const b = boundsOfPath((cmd as { path: Path }).path);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
};

function setup(path: Path = LINE, stroke: Stroke = { paint: { color: '#000' }, width: 4 }, given?: RectPose) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const pose = given ?? (path === LINE ? { x: 0, y: 0, width: 100, height: 0 } : { x: 0, y: -45, width: 100, height: 45 });
  const line = scene.add({ kind: 'leaf', layer: 'main', pose, data: { path, stroke } });
  const { result } = renderHook(() => useGirthTool());
  const deps = { scene, view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
  const actionOf = (id: string): Action => (result.current.actions ?? []).find((x) => x.id === id)!;
  const ctx = (x: number, y: number, start = { x, y }, alt = false): InvocationCtx => ({
    world: { x, y }, screen: { x, y }, modifiers: { alt, ctrl: false, meta: false, shift: false }, deps,
    drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
  });
  /** Press at the first point and move through the rest. */
  const drag = (
    points: [number, number][],
    o: { reason?: 'commit' | 'cancel'; alt?: boolean; peek?: (h: OngoingHandle) => void } = {},
  ) => {
    const invoker = actionOf('girth.drag').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('girth.drag is not ongoing');
    const start = { x: points[0][0], y: points[0][1] };
    const handle = invoker.start(ctx(start.x, start.y, start, o.alt), undefined);
    for (const [x, y] of points.slice(1)) handle.onMove?.(ctx(x, y, start, o.alt));
    o.peek?.(handle);
    handle.onEnd?.({ ...ctx(0, 0), deps: {} as ActionDeps }, o.reason ?? 'commit');
  };
  const run = (id: string, params: Record<string, unknown>) => {
    const invoker = actionOf(id).invoker;
    if (invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
    invoker.run(deps, params);
  };
  const altClick = (x: number, y: number) => run('girth.clear', { pressX: x, pressY: y, mods: { alt: true } });
  const hover = (x: number, y: number) => run('girth.hover', { worldX: x, worldY: y });
  const data = () => scene.get(line)!.data;
  const widths = () => data().stroke?.vertexWidths;
  const overlay = result.current.overlay as RenderLayer<unknown>;
  const marks = () => overlay.draw(undefined, VIEW, { width: 400, height: 400 }) as DrawCommand[];
  const bounds = () => defaultPaintBounds(scene.get(line)!, scene.get(line)!.pose, VIEW)!;
  return { scene, line, drag, altClick, hover, run, data, widths, marks, bounds };
}

describe('useGirthTool', () => {
  it('declares edits-page', () => {
    const { result } = renderHook(() => useGirthTool());
    expect(result.current.eligibility?.capabilities).toEqual(['edits-page']);
  });

  it('drags an edge along the normal, the other edge mirroring it, as one undo entry', () => {
    const t = setup();
    // The right edge sits 2 below the path; pull it to 10, 3 along the way:
    // 10 from the path along the normal, so 20 wide, not twice the radial 10.4.
    t.drag([[100, 2], [103, 10]]);
    expect(t.widths()).toEqual([NaN, 20]);
    t.scene.undo();
    expect(t.widths()).toBeUndefined();
  });

  it('pinches the stroke when an edge is dragged inward, and stops at zero', () => {
    const t = setup();
    t.drag([[100, -2], [100, 1], [100, 5]]);
    expect(t.widths()).toEqual([NaN, 0]);
  });

  it('moves only the grabbed edge on an Alt-drag, and collapses a pair whose sides meet', () => {
    const t = setup();
    t.drag([[100, 2], [100, 10]], { alt: true });
    expect(t.widths()).toEqual([NaN, { left: 2, right: 10 }]);
    t.drag([[100, 10], [100, 2]], { alt: true });
    expect(t.widths()).toEqual([NaN, 4]);
  });

  it('inserts an anchor where an edge is grabbed between two, without changing the shape', () => {
    const t = setup(ARC);
    const world = () => resolveEditablePathOf(t.scene.get(t.line) as never)!;
    const before = world();
    // The left edge at the apex is 2 above it; pull it 5 farther out.
    t.drag([[50, -47], [50, -52]]);
    const after = world();
    expect(countPathAnchors(after)).toBe(3);
    expect(shapeGap(before, after)).toBeLessThan(0.05);
    const w = t.widths()!;
    expect(w).toHaveLength(3);
    expect(w[1]).toBeCloseTo(14, 1);
    expect(Number.isNaN(w[0]) && Number.isNaN(w[2])).toBe(true);
    t.scene.undo();
    expect(countPathAnchors(t.data().path!)).toBe(2);
  });

  it('shows the dragged width live and writes nothing until the drag ends', () => {
    const t = setup();
    t.drag([[100, 2], [100, 10]], {
      peek: (h) => {
        expect(t.widths()).toBeUndefined();
        expect(h.previewIds?.()).toEqual([t.line]);
        expect((h.previewData?.(t.line) as Data).stroke?.vertexWidths?.[1]).toBe(20);
      },
    });
  });

  it('leaves the stroke as it was on a canceled drag', () => {
    const t = setup();
    t.drag([[50, 2], [50, 10]], { reason: 'cancel' });
    expect(t.widths()).toBeUndefined();
    expect(countPathAnchors(t.data().path!)).toBe(2);
  });

  it('passes over a press away from any edge', () => {
    const t = setup();
    t.drag([[50, 40], [50, 60]]);
    expect(t.widths()).toBeUndefined();
  });

  it('grows the stroke\'s paint bounds with the width, a one-sided one included, live and committed', () => {
    const t = setup();
    const before = t.bounds();
    t.drag([[100, 2], [100, 60]], {
      alt: true,
      peek: (h) => {
        const node = { ...t.scene.get(t.line)!, data: h.previewData?.(t.line) as Data };
        expect(defaultPaintBounds(node, node.pose, VIEW)!.height).toBeGreaterThan(before.height);
      },
    });
    expect(t.widths()).toEqual([NaN, { left: 2, right: 60 }]);
    const after = t.bounds();
    expect(after.y + after.height).toBeGreaterThanOrEqual(60);
    expect(after.height).toBeGreaterThan(before.height);
  });

  it('clears an anchor\'s width on an Alt-click, and the list with its last entry', () => {
    const t = setup(LINE, { paint: { color: '#000' }, width: 4, vertexWidths: [8, { left: 1, right: 3 }] });
    t.altClick(0, 0);
    expect(t.widths()).toEqual([NaN, { left: 1, right: 3 }]);
    t.altClick(100, 0);
    expect(t.widths()).toBeUndefined();
  });

  it('marks the grab point on the edge under a hover and the width point it moves', () => {
    const t = setup();
    expect(t.marks()).toEqual([]);
    t.hover(50, 3);
    const marks = t.marks();
    // The grab point is on the right edge, 2 below the path; the width point on the path.
    expect(marks.some((m) => Math.hypot(centerOf(m).x - 50, centerOf(m).y - 2) < 0.5)).toBe(true);
    expect(marks.some((m) => Math.hypot(centerOf(m).x - 50, centerOf(m).y) < 0.5)).toBe(true);
    t.hover(50, 40);
    expect(t.marks().some((m) => Math.hypot(centerOf(m).x - 50, centerOf(m).y - 2) < 0.5)).toBe(false);
    t.hover(100, -3);
    t.run('girth.unhover', {});
    expect(t.marks().some((m) => Math.hypot(centerOf(m).x - 100, centerOf(m).y + 2) < 0.5)).toBe(false);
  });

  it('marks each anchor of the stroke it last touched, and the edges of the ones with a width', () => {
    const t = setup();
    t.drag([[100, 2], [100, 6]]);
    t.run('girth.unhover', {});
    // A dot per anchor, and a line across the stroke for the one with a width.
    expect(t.marks()).toHaveLength(3);
  });

  describe('on a drawn rectangle', () => {
    const RECT: Path = { kind: 'rect', x: 0, y: 0, width: 100, height: 50 };
    const BOX = { x: 0, y: 0, width: 100, height: 50 };
    const rectSetup = (align?: 'inner' | 'outer') =>
      setup(RECT, { paint: { color: '#000' }, width: 4, ...(align ? { align } : {}) }, BOX);
    const setWidths = (t: ReturnType<typeof setup>) => t.widths()!.filter((w) => !Number.isNaN(w));

    it('widens the stroke where an edge is grabbed, adding an anchor to the rectangle', () => {
      const t = rectSetup();
      // The outer edge of the top side is 2 above it; pull it out to 10.
      t.drag([[50, -2], [50, -10]]);
      expect(countPathAnchors(t.data().path!)).toBe(5);
      expect(t.widths()).toHaveLength(5);
      expect(setWidths(t)).toEqual([20]);
      t.scene.undo();
      expect(t.data().path).toEqual(RECT);
    });

    it('grabs an inner stroke by the edge it draws inside the rectangle', () => {
      const t = rectSetup('inner');
      // Drawn 4 inside the top side; pulled 4 farther in, it is 8 wide.
      t.drag([[50, 4], [50, 8]]);
      expect(setWidths(t)).toEqual([8]);
    });

    it('grabs an outer stroke by the edge it draws outside the rectangle', () => {
      const t = rectSetup('outer');
      t.drag([[50, -4], [50, -8]]);
      expect(setWidths(t)).toEqual([8]);
    });
  });
});
