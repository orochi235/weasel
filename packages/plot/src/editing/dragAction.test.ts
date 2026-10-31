import { createScene, type InvocationCtx, type NodeId, type OngoingHandle, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { plotRootOf, plotSpecs, type PlotSceneData, type PlotSpec } from '../plotScene';
import type { XyChartData } from '../xychart/types';
import { createPlotDragAction } from './dragAction';
import { plotHandles } from './handleLayer';
import { plotEditing } from './plotEditing';

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

describe('plot.dragValue', () => {
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

  it('is bound to a drag on the handle layer\'s kind', () => {
    const { scene } = setup();
    const { contribution } = plotEditing({ scene: scene as never });
    expect(contribution.bindings?.find((b) => b.spec.kind === 'drag')).toMatchObject({
      spec: { target: 'affordance:layer:plot-handles' }, actionId: 'plot.dragValue',
    });
  });
});
