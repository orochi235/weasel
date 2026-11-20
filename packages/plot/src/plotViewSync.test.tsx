import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { plotRootOf, plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec } from './plotScene';
import { usePlotPropsSync, type PlotDrawing } from './plotViewSync';
import { PLOT_THEME } from './theme';
import { setXyValue } from './xychart/edit';
import type { XyChartData } from './xychart/types';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const DATA: XyChartData = {
  kind: 'xychart',
  x: { kind: 'band', categories: ['a', 'b'] },
  y: { min: 0, max: 10 },
  series: [{ kind: 'bar', values: [4, 6] }],
};
const DARK = { ...PLOT_THEME, axis: '#123456' };

function mounted() {
  const scene = createScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  for (const spec of plotSpecs(DATA, { id: 'p', box: { x: 0, y: 0, width: 400, height: 300 }, measure })) scene.add(spec as PlotSpec);
  const onChange = vi.fn();
  const hook = renderHook((p: { data: XyChartData; drawing: PlotDrawing }) => usePlotPropsSync(scene, 'p', p.data, p.drawing, onChange), {
    initialProps: { data: DATA, drawing: { width: 400, height: 300, measure } as PlotDrawing },
  });
  return { scene, onChange, hook };
}

const barPose = (scene: ReturnType<typeof mounted>['scene']) => scene.get('p/bar:0:1' as NodeId)!.pose;

describe('usePlotPropsSync', () => {
  it('redraws for the current size and theme when an undo puts back marks drawn for older ones', () => {
    const { scene, onChange, hook } = mounted();
    const edited = setXyValue(DATA, 0, 1, 9);
    act(() => replacePlotData(scene, 'p', edited, { label: 'Edit value', measure }));
    expect(onChange).toHaveBeenLastCalledWith(edited);
    hook.rerender({ data: edited, drawing: { width: 800, height: 300, theme: DARK, measure } });
    act(() => scene.history.undo());
    const root = plotRootOf(scene.get('p' as NodeId))!;
    expect(root.data).toBe(DATA);
    expect(root.theme).toBe(DARK);
    const want = plotSpecs(DATA, { id: 'p', box: { x: 0, y: 0, width: 800, height: 300 }, theme: DARK, measure }).find((m) => m.id === 'p/bar:0:1')!;
    expect(barPose(scene)).toEqual(want.pose);
    expect(onChange).toHaveBeenLastCalledWith(DATA);
    act(() => scene.history.redo());
    const redone = plotSpecs(edited, { id: 'p', box: { x: 0, y: 0, width: 800, height: 300 }, theme: DARK, measure }).find((m) => m.id === 'p/bar:0:1')!;
    expect(barPose(scene)).toEqual(redone.pose);
  });

  it('leaves marks an undo puts back alone when nothing they were drawn for has changed', () => {
    const { scene, hook } = mounted();
    const before = barPose(scene);
    act(() => replacePlotData(scene, 'p', setXyValue(DATA, 0, 1, 9), { label: 'Edit value', measure }));
    hook.rerender({ data: DATA, drawing: { width: 400, height: 300, measure } });
    const entries = scene.historyEntries().length;
    act(() => scene.history.undo());
    expect(barPose(scene)).toEqual(before);
    expect(scene.historyEntries().length).toBe(entries);
  });
});
