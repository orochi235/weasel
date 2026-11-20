import { createScene, type InvocationCtx, type NodeId, type OngoingHandle, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { plotRootOf, plotSpecs, type PlotSceneData, type PlotSpec } from '../plotScene';
import type { XyChartData } from '../xychart/types';
import { createPlotDragAction } from './dragAction';
import { plotHandles } from './handleLayer';
import { createPlotEditingContribution } from './createPlotEditingContribution';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const DATA: XyChartData = {
  kind: 'xychart', x: { kind: 'band', categories: ['a', 'b'] }, y: { min: 0, max: 10 }, series: [{ kind: 'bar', values: [4, 6] }],
};

function setup() {
  const scene = createScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const spec of plotSpecs(DATA, { id: 'p', box: { x: 20, y: 30, width: 400, height: 300 }, measure })) scene.add(spec as PlotSpec);
  const handle = [...plotHandles(scene as never)].find((h) => h.markId === 'p/bar:0:1')!;
  // The y one unit of value spans, from the bar's own scale: 6 units tall.
  const unit = scene.get('p/bar:0:1' as NodeId)!.pose.height / 6;
  const ctx = (world: { x: number; y: number }) => ({
    world, deps: { scene }, drag: { start: { x: handle.at.x, y: handle.at.y + 2 }, affordance: { payload: handle } },
  }) as unknown as InvocationCtx;
  const start = (): OngoingHandle => {
    const action = createPlotDragAction({ measure });
    const invoker = action.invoker as { start(ctx: InvocationCtx): OngoingHandle };
    return invoker.start(ctx({ x: handle.at.x, y: handle.at.y + 2 }));
  };
  return { scene, handle, unit, ctx, start };
}

describe('plot.editValue', () => {
  it('previews the marks the moved value redraws, in their own frame, and writes nothing', () => {
    const { scene, handle, unit, ctx, start } = setup();
    const drag = start();
    expect(drag.previewIds?.()).toBeNull();
    drag.onMove!(ctx({ x: handle.at.x, y: handle.at.y + 2 - 2 * unit }));
    expect(drag.previewIds?.()).toContain('p/bar:0:1');
    const pose = drag.previewPose!('p/bar:0:1') as RectPose;
    expect(pose.height).toBeCloseTo(8 * unit);
    expect((drag.previewData!('p/bar:0:1') as PlotSceneData & { plotMark: { datum: { value: number } } }).plotMark.datum.value).toBe(8);
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toBe(DATA);
  });

  it('commits the value under the pointer, the grab offset kept, as one undo entry', () => {
    const { scene, handle, unit, ctx, start } = setup();
    const drag = start();
    const at = { x: handle.at.x, y: handle.at.y + 2 - 3 * unit };
    drag.onMove!(ctx(at));
    drag.onEnd!(ctx(at), 'commit');
    expect((plotRootOf(scene.get('p' as NodeId))!.data as XyChartData).series[0]!.values).toEqual([4, 9]);
    expect(scene.historyEntries().at(-1)!.label).toBe('Edit value');
    scene.history.undo();
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toBe(DATA);
  });

  it('commits nothing on a cancel or a still click', () => {
    const { scene, handle, unit, ctx, start } = setup();
    const dragged = start();
    dragged.onMove!(ctx({ x: handle.at.x, y: handle.at.y - unit }));
    dragged.onEnd!(ctx({ x: handle.at.x, y: handle.at.y - unit }), 'cancel');
    start().onEnd!(ctx(handle.at), 'commit');
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toBe(DATA);
  });

  it('grabs a bar cut at the plot\'s edge by its handle there, and drags it back inside', () => {
    const scene = createScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
    const cut: XyChartData = { ...DATA, series: [{ kind: 'bar', values: [4, 1e9] }] };
    for (const spec of plotSpecs(cut, { id: 'p', box: { x: 20, y: 30, width: 400, height: 300 }, measure })) scene.add(spec as PlotSpec);
    const bar = scene.get('p/bar:0:1' as NodeId)!.pose;
    const handle = [...plotHandles(scene as never)].find((h) => h.markId === 'p/bar:0:1')!;
    // The bar runs up to the plot's top, 10 units tall, and its handle sits on that cut end.
    expect(handle.at.y).toBeCloseTo(30 + bar.y);
    const unit = bar.height / 10;
    const ctx = (world: { x: number; y: number }) => ({
      world, deps: { scene }, drag: { start: handle.at, affordance: { payload: handle } },
    }) as unknown as InvocationCtx;
    const drag = (createPlotDragAction({ measure }).invoker as { start(ctx: InvocationCtx): OngoingHandle }).start(ctx(handle.at));
    const at = { x: handle.at.x, y: handle.at.y + 3 * unit };
    drag.onMove!(ctx(at));
    drag.onEnd!(ctx(at), 'commit');
    expect((plotRootOf(scene.get('p' as NodeId))!.data as XyChartData).series[0]!.values).toEqual([4, 7]);
  });

  it('reads the pointer through a frame\'s toPlot and places handles through its fromPlot', () => {
    const { scene } = setup();
    // A stand-in for a cast onto a plane: the plot drawn at twice its size, its corner at (1000, 500).
    const roots: string[] = [];
    const frame = {
      toPlot: (w: { x: number; y: number }, rootId: string) => { roots.push(rootId); return { x: (w.x - 1000) / 2, y: (w.y - 500) / 2 }; },
      fromPlot: (p: { x: number; y: number }) => ({ x: 1000 + p.x * 2, y: 500 + p.y * 2 }),
    };
    const bar = scene.get('p/bar:0:1' as NodeId)!.pose;
    const unit = bar.height / 6;
    const handle = [...plotHandles(scene as never, frame)].find((h) => h.markId === 'p/bar:0:1')!;
    expect(handle.at).toEqual({ x: 1000 + (bar.x + bar.width / 2) * 2, y: 500 + bar.y * 2 });
    const ctx = (world: { x: number; y: number }) => ({
      world, deps: { scene }, drag: { start: { x: handle.at.x, y: handle.at.y + 2 }, affordance: { payload: handle } },
    }) as unknown as InvocationCtx;
    const drag = (createPlotDragAction({ measure, ...frame }).invoker as { start(ctx: InvocationCtx): OngoingHandle })
      .start(ctx({ x: handle.at.x, y: handle.at.y + 2 }));
    // Two world units per plot unit, so three values up is six units of the plot's value step.
    const at = { x: handle.at.x, y: handle.at.y + 2 - 2 * 3 * unit };
    drag.onMove!(ctx(at));
    drag.onEnd!(ctx(at), 'commit');
    expect((plotRootOf(scene.get('p' as NodeId))!.data as XyChartData).series[0]!.values).toEqual([4, 9]);
    expect(new Set(roots)).toEqual(new Set(['p']));
  });

  it('hands a contribution\'s frame on to its handle layer', () => {
    const { scene } = setup();
    const fromPlot = (p: { x: number; y: number }) => ({ x: p.x + 700, y: p.y + 700 });
    const layer = createPlotEditingContribution({ scene: scene as never, fromPlot }).layers![0]! as unknown as {
      hitTest(x: number, y: number, state: unknown, view: unknown, dims: unknown): { initialScratch?: unknown } | null;
    };
    const plain = [...plotHandles(scene as never, { fromPlot: (p) => p })].find((h) => h.markId === 'p/bar:0:1')!;
    const hit = (p: { x: number; y: number }) => layer.hitTest(p.x, p.y, {}, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 2000, height: 2000, dpr: 1 });
    expect(hit(plain.at)).toBeNull();
    expect(hit(fromPlot(plain.at))?.initialScratch).toMatchObject({ markId: 'p/bar:0:1', at: fromPlot(plain.at) });
  });

  it('is bound to a drag on the handle layer\'s kind', () => {
    const { scene } = setup();
    const contribution = createPlotEditingContribution({ scene: scene as never });
    expect(contribution.bindings?.find((b) => b.spec.kind === 'drag')).toMatchObject({
      spec: { target: 'affordance:layer:plot-handles' }, actionId: 'plot.editValue',
    });
  });
});
