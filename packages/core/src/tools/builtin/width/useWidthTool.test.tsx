import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { polylineFromPoints, type Path } from '@weasel-js/geom';
import type { Stroke } from '@weasel-js/paint';
import type { Action, ActionDeps, InvocationCtx, OngoingHandle } from '@weasel-js/routing';
import type { RenderLayer } from 'core/layers/render';
import { createScene } from 'core/scene/scene';
import type { RectPose } from 'core/scene/types';
import { useWidthTool } from './useWidthTool';

type Data = { path?: Path; stroke?: Stroke };

const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

function setup(stroke: Stroke = { paint: { color: '#000' }, width: 4 }) {
  const scene = createScene<Data, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  const line = scene.add({
    kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 100, height: 0 },
    data: { path: polylineFromPoints([{ x: 0, y: 0 }, { x: 100, y: 0 }]), stroke },
  });
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
    const invoker = actionOf('width.removeStop').invoker;
    if (invoker?.timing !== 'immediate') throw new Error('width.removeStop is not immediate');
    invoker.run(deps, { pressX: x, pressY: y, mods: { alt: true } });
  };
  const profile = () => scene.get(line)!.data.stroke?.widthProfile;
  const overlay = result.current.overlay as RenderLayer<unknown>;
  const marks = () => overlay.draw(undefined, VIEW, { width: 400, height: 400 });
  return { scene, line, drag, altClick, profile, marks };
}

describe('useWidthTool', () => {
  it('sets the width where a drag starts, between level ends, as one undo entry', () => {
    const t = setup();
    // Out to 6 from the centerline: 12 wide, three times the stroke's 4.
    t.drag([[50, 1], [50, 6]]);
    const p = t.profile()!;
    expect(p.map((s) => s.t)).toEqual([0, 0.5, 1]);
    expect(p[1].width).toBeCloseTo(3, 6);
    expect(p[0].width).toBe(1);
    t.scene.undo();
    expect(t.profile()).toBeUndefined();
  });

  it('shows the dragged profile live and writes nothing until the drag ends', () => {
    const t = setup();
    t.drag([[50, 1], [50, 6]], {
      peek: (h) => {
        expect(t.profile()).toBeUndefined();
        expect(h.previewIds?.()).toEqual([t.line]);
        const live = h.previewData?.(t.line) as Data;
        expect(live.stroke?.widthProfile?.[1].width).toBeCloseTo(3, 6);
      },
    });
  });

  it('moves the stop a press lands near rather than adding one', () => {
    const t = setup({ paint: { color: '#000' }, width: 4, widthProfile: [{ t: 0, width: 1 }, { t: 0.5, width: 2 }, { t: 1, width: 1 }] });
    t.drag([[52, 1], [52, 1]]);
    expect(t.profile()!.map((s) => s.t)).toEqual([0, 0.5, 1]);
  });

  it('leaves the stroke as it was on a canceled drag', () => {
    const t = setup();
    t.drag([[50, 1], [50, 6]], { reason: 'cancel' });
    expect(t.profile()).toBeUndefined();
  });

  it('passes over a press away from any stroke', () => {
    const t = setup();
    t.drag([[50, 40], [50, 60]]);
    expect(t.profile()).toBeUndefined();
  });

  it('removes the stop under an Alt-click', () => {
    const t = setup({ paint: { color: '#000' }, width: 4, widthProfile: [{ t: 0, width: 1 }, { t: 0.5, width: 2 }, { t: 1, width: 1 }] });
    t.altClick(50, 0);
    expect(t.profile()!.map((s) => s.t)).toEqual([0, 1]);
  });

  it('marks each stop of the stroke it last touched', () => {
    const t = setup();
    expect(t.marks()).toEqual([]);
    t.drag([[50, 1], [50, 6]]);
    // A span and a dot per stop.
    expect(t.marks()).toHaveLength(6);
  });
});
