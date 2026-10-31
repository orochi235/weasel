import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { describe, expect, it } from 'vitest';
import { plotRootOf, plotSpecs, replacePlotData, type PlotSceneData, type PlotSpec } from '../plotScene';
import type { XyChartData } from '../xychart/types';
import { foldPlotText, isPlotText, plotTextOf } from './textEdit';

const measure = (text: string) => ({ width: text.length * 7, height: 14 });
const DATA: XyChartData = { kind: 'xychart', title: 'Sales', series: [{ kind: 'bar', values: [4, 6] }] };

function setup() {
  const scene = createScene<PlotSceneData, 'main', RectPose>({ systemLayers: [{ id: 'main' }] });
  scene.untracked(() => { for (const spec of plotSpecs(DATA, { id: 'p', box: { x: 0, y: 0, width: 400, height: 300 }, measure })) scene.add(spec as PlotSpec); });
  const type = (text: string) => scene.batch('Type', () => {
    scene.update('p/title' as NodeId, { data: { ...scene.get('p/title' as NodeId)!.data, text } as PlotSceneData });
  });
  const edits: { rootId: string; data: unknown; label: string }[] = [];
  const fold = () => foldPlotText(scene as never, 'p/title', (edit) => {
    edits.push(edit);
    replacePlotData(scene, edit.rootId, edit.data, { label: edit.label, measure });
  });
  return { scene, type, edits, fold };
}

describe('editing a chart\'s text in place', () => {
  it('knows a text mark naming an edit from any other', () => {
    const { scene } = setup();
    expect(plotTextOf(scene.get('p/title' as NodeId))).toEqual({ edit: 'title' });
    expect(isPlotText(scene.get('p/title' as NodeId)!.data)).toBe(true);
    expect(isPlotText(scene.get('p/axis:value:label:0' as NodeId)!.data)).toBe(false);
  });

  it('folds the typed text into one edit of the spec, the typing itself undone', () => {
    const { scene, type, edits, fold } = setup();
    type('Revenue');
    fold();
    expect(edits).toEqual([{ rootId: 'p', label: 'Edit text', data: { ...DATA, title: 'Revenue' } }]);
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toEqual({ ...DATA, title: 'Revenue' });
    expect(scene.historyEntries().map((e) => e.label)).toEqual(['Edit text']);
    scene.history.undo();
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toBe(DATA);
  });

  it('commits nothing for text left as it was', () => {
    const { scene, edits, fold } = setup();
    fold();
    expect(edits).toEqual([]);
    expect(scene.historyEntries()).toEqual([]);
  });
});
