import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { plotHandles } from './editing/handleLayer';
import { compilePlot } from './plotData';
import {
  plotMarkOf, plotRootContaining, plotRootOf, plotRootsIn, plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec,
} from './plotScene';
import { PLOT_THEME } from './theme';
import { setXyValue } from './xychart/edit';
import type { XyChartData } from './xychart/types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const DATA: XyChartData = {
  kind: 'xychart',
  x: { kind: 'band', categories: ['a', 'b'] },
  y: { min: 0, max: 10 },
  series: [{ kind: 'bar', values: [4, 6] }, { kind: 'line', values: [2, 8] }],
};
const BOX = { x: 100, y: 50, width: 400, height: 300 };

function sceneOf(data: XyChartData = DATA) {
  const scene = createScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const spec of plotSpecs(data, { id: 'p', box: BOX, measure })) scene.add(spec as PlotSpec);
  return scene;
}

describe('plotSpecs', () => {
  it('is one group root holding the spec, then every mark under it, keyed by mark', () => {
    const [root, ...marks] = plotSpecs(DATA, { id: 'p', box: BOX, measure, layer: 'shapes' });
    expect(root).toMatchObject({ kind: 'group', id: 'p', layer: 'shapes', pose: BOX, data: { plot: { data: DATA, theme: PLOT_THEME } } });
    expect(marks.map((m) => m.id)).toEqual(compilePlot(DATA, BOX, PLOT_THEME, measure).map((m) => `p/${m.key}`));
    expect(marks.every((m) => m.parent === 'p' && m.kind === 'mark')).toBe(true);
    expect(plotRootOf(root)!.data).toBe(DATA);
    expect(plotMarkOf(marks.find((m) => m.id === 'p/bar:0:1'))).toMatchObject({ kind: 'bar', datum: { value: 6 } });
    expect(plotRootOf(marks[0])).toBeNull();
  });
});

describe('a plot in a scene', () => {
  it('draws its marks in the root\'s frame, so moving the root moves the chart', () => {
    const scene = sceneOf();
    expect(plotRootsIn(scene as never)).toEqual(['p']);
    expect([plotRootContaining(scene as never, 'p'), plotRootContaining(scene as never, 'p/bar:0:1'), plotRootContaining(scene as never, 'nope')]).toEqual(['p', 'p', null]);
    const handles = [...plotHandles(scene as never)];
    const bar = handles.find((h) => h.markId === 'p/bar:0:0')!;
    const local = scene.get('p/bar:0:0' as NodeId)!.pose;
    expect(bar.at).toEqual({ x: BOX.x + local.x + local.width / 2, y: BOX.y + local.y });
    expect(handles.filter((h) => h.markId.includes('/point:'))).toHaveLength(2);
    expect(handles.some((h) => h.markId.includes('/line:'))).toBe(false);
  });

  it('replaces its spec and rebuilds its marks as one undo entry', () => {
    const scene = sceneOf();
    const before = scene.get('p/bar:0:1' as NodeId)!.pose;
    replacePlotData(scene, 'p', setXyValue(DATA, 0, 1, 9), { label: 'Edit value', measure });
    expect((plotRootOf(scene.get('p' as NodeId))!.data as XyChartData).series[0]!.values).toEqual([4, 9]);
    const after = scene.get('p/bar:0:1' as NodeId)!;
    expect(after.pose.height).toBeGreaterThan(before.height);
    expect(plotMarkOf(after)!.datum).toMatchObject({ value: 9 });
    expect(scene.historyEntries().at(-1)!.label).toBe('Edit value');

    scene.history.undo();
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toEqual(DATA);
    expect(scene.get('p/bar:0:1' as NodeId)!.pose).toEqual(before);
    scene.history.redo();
    expect(plotMarkOf(scene.get('p/bar:0:1' as NodeId))!.datum).toMatchObject({ value: 9 });
  });

  it('rebuilds a mark set that changes shape, and throws on a node that is no plot', () => {
    const scene = sceneOf();
    replacePlotData(scene, 'p', { ...DATA, series: [DATA.series[0]!] }, { measure });
    expect(scene.get('p/line:1' as NodeId)).toBeUndefined();
    expect(scene.childrenOf('p' as NodeId).every((id) => id.startsWith('p/'))).toBe(true);
    expect(() => replacePlotData(scene, 'p/bar:0:0', DATA)).toThrow(/not a plot root/);
  });
});
