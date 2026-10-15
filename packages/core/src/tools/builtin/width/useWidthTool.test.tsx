import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { extractPolylines } from '@weasel-js/geom/tessellate';
import { countPathAnchors, PathBuilder, pathDistanceToPoint, polylineFromPoints, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { RenderLayer } from 'core/layers/render';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { resolveEditablePathOf } from 'features/paths/editablePath';
import { useWidthTool } from './useWidthTool';

type Data = { path?: Path; stroke?: Stroke };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const LINE = polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]);
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

function setup(path: Path = LINE, stroke: Stroke = { paint: { color: '#000' }, width: 4 }) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const pose = path === LINE ? { x: 0, y: 0, width: 100, height: 0 } : { x: 0, y: -45, width: 100, height: 45 };
  const line = scene.add({ kind: 'leaf', layer: 'main', pose, data: { path, stroke } });
  const { result } = renderHook(() => useWidthTool());
  const deps = { scene, view: { get: () => VIEW, set: () => {} } } as unknown as ActionDeps;
  const actionOf = (id: string): Action => (result.current.actions ?? []).find((x) => x.id === id)!;
  const ctx = (x: number, y: number, start = { x, y }): InvocationCtx => ({
    world: { x, y }, screen: { x, y }, modifiers: { alt: false, ctrl: false, meta: false, shift: false }, deps,
    drag: { start, current: { x, y }, delta: { x: x - start.x, y: y - start.y } },
  });
  /** Press at the first point and move through the rest. */
  const drag = (points: [number, number][], o: { reason?: 'commit' | 'cancel'; peek?: (h: OngoingHandle) => void } = {}) => {
    const invoker = actionOf('width.drag').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('width.drag is not ongoing');
    const start = { x: points[0][0], y: points[0][1] };
    const handle = invoker.start(ctx(start.x, start.y), undefined);
    for (const [x, y] of points.slice(1)) handle.onMove?.(ctx(x, y, start));
    o.peek?.(handle);
    handle.onEnd?.({ ...ctx(0, 0), deps: {} as ActionDeps }, o.reason ?? 'commit');
  };
  const altClick = (x: number, y: number) => {
    const invoker = actionOf('width.clear').invoker;
    if (invoker?.timing !== 'immediate') throw new Error('width.clear is not immediate');
    invoker.run(deps, { pressX: x, pressY: y, mods: { alt: true } });
  };
  const data = () => scene.get(line)!.data;
  const widths = () => data().stroke?.vertexWidths;
  const overlay = result.current.overlay as RenderLayer<unknown>;
  const marks = () => overlay.draw(undefined, VIEW, { width: 400, height: 400 });
  return { scene, line, drag, altClick, data, widths, marks };
}

describe('useWidthTool', () => {
  it('sets the width of the anchor a drag starts on, as one undo entry', () => {
    const t = setup();
    // Out to 6 from the anchor: 12 wide.
    t.drag([[100, 1], [100, 6]]);
    expect(t.widths()).toEqual([NaN, 12]);
    t.scene.undo();
    expect(t.widths()).toBeUndefined();
  });

  it('inserts an anchor where a drag starts between two, without changing the shape', () => {
    const t = setup(ARC);
    const world = () => resolveEditablePathOf(t.scene.get(t.line) as never)!;
    const before = world();
    t.drag([[50, -44], [50, -40]]);
    const after = world();
    expect(countPathAnchors(after)).toBe(3);
    expect(shapeGap(before, after)).toBeLessThan(0.05);
    const w = t.widths()!;
    expect(w).toHaveLength(3);
    expect(w[1]).toBeGreaterThan(7);
    expect(Number.isNaN(w[0]) && Number.isNaN(w[2])).toBe(true);
    t.scene.undo();
    expect(countPathAnchors(t.data().path!)).toBe(2);
  });

  it('shows the dragged width live and writes nothing until the drag ends', () => {
    const t = setup();
    t.drag([[100, 1], [100, 6]], {
      peek: (h) => {
        expect(t.widths()).toBeUndefined();
        expect(h.previewIds?.()).toEqual([t.line]);
        expect((h.previewData?.(t.line) as Data).stroke?.vertexWidths?.[1]).toBe(12);
      },
    });
  });

  it('leaves the stroke as it was on a canceled drag', () => {
    const t = setup();
    t.drag([[50, 1], [50, 6]], { reason: 'cancel' });
    expect(t.widths()).toBeUndefined();
    expect(countPathAnchors(t.data().path!)).toBe(2);
  });

  it('passes over a press away from any stroke', () => {
    const t = setup();
    t.drag([[50, 40], [50, 60]]);
    expect(t.widths()).toBeUndefined();
  });

  it('clears an anchor\'s width on an Alt-click, and the list with its last entry', () => {
    const t = setup(LINE, { paint: { color: '#000' }, width: 4, vertexWidths: [8, 2] });
    t.altClick(0, 0);
    expect(t.widths()).toEqual([NaN, 2]);
    t.altClick(100, 0);
    expect(t.widths()).toBeUndefined();
  });

  it('marks each anchor of the stroke it last touched, and rings the ones with a width', () => {
    const t = setup();
    expect(t.marks()).toEqual([]);
    t.drag([[100, 1], [100, 6]]);
    // A dot per anchor, and a ring for the one with a width.
    expect(t.marks()).toHaveLength(3);
  });
});
