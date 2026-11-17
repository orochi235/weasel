import { describe, expect, it, vi } from 'vitest';
import { createScene, type RectPose } from '@weasel-js/core';
import { DIAGRAM_THEMES, withDiagramRegistry, type MeasureRowText } from '@weasel-js/diagram';
import { plotSpecs, type PlotSpec } from '@weasel-js/plot';
import type { ChartScene } from '../chartDocument';
import { applyChartTheme } from './applyChartTheme';

describe('applyChartTheme', () => {
  it("lays a chart's plots out again with the measure it is given", () => {
    const scene = createScene({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry<RectPose>() }) as unknown as ChartScene;
    const data = { kind: 'xychart', x: { kind: 'band', categories: ['a', 'b'] }, y: { min: 0, max: 10 }, series: [{ kind: 'bar', values: [4, 6] }] } as const;
    for (const spec of plotSpecs(data as never, { id: 'p', box: { x: 0, y: 0, width: 400, height: 300 }, layer: 'main' })) scene.add(spec as PlotSpec as never);
    const measure = vi.fn<MeasureRowText>((text) => ({ width: text.length * 7, height: 14 }));
    applyChartTheme(scene, DIAGRAM_THEMES.blueprint!, undefined, { measure });
    expect(measure).toHaveBeenCalled();
  });
});
