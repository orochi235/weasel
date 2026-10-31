import { describe, expect, it } from 'vitest';
import { createScene, type NodeId, type RectPose } from '@weasel-js/core';
import { withDiagramRegistry } from '@weasel-js/diagram';
import { plotRootOf, replacePlotData, setXyValue, type XyChartData } from '@weasel-js/plot';
import type { DiagramDocument, PlotPage } from './document';
import { documentFromScene } from './fromScene';
import { exportPageSvg } from './pageSvg';
import { plotRootIdOf, plotThemeOf } from './plotPages';
import { MEASURE, THEME } from './testing/docScene';
import { documentSpecs } from './toScene';

const CHART: XyChartData = {
  kind: 'xychart', title: 'Sales', x: { kind: 'band', categories: ['a', 'b'] }, y: { min: 0, max: 10 },
  series: [{ kind: 'bar', values: [3, 7] }],
};
const DOC: DiagramDocument = {
  pages: [
    { kind: 'graph', id: 'one', width: 400, height: 300, data: { nodes: [{ id: 'n', lines: ['N'], at: { x: 20, y: 30 } }], edges: [] } },
    { kind: 'plot', id: 'two', name: 'Chart', width: 500, height: 300, data: CHART },
  ],
  theme: THEME.id,
};

function sceneOf(doc: DiagramDocument = DOC) {
  const { specs, doc: values } = documentSpecs(doc, { measure: MEASURE, theme: THEME });
  return createScene<unknown, string, RectPose>({ systemLayers: [{ id: 'main' }], registry: withDiagramRegistry(), doc: values, initial: specs as never });
}

describe('plot pages', () => {
  it('draw as one plot root filling the page where it is placed, in the theme\'s roles', () => {
    const { specs } = documentSpecs(DOC, { measure: MEASURE, theme: THEME });
    const root = specs.find((s) => s.id === plotRootIdOf('two'))!;
    // Page two starts past page one and the 40 gap.
    expect(root.pose).toEqual({ x: 440, y: 0, width: 500, height: 300 });
    expect(plotRootOf(root)).toEqual({ data: CHART, theme: plotThemeOf(THEME) });
    expect(specs.filter((s) => s.parent === plotRootIdOf('two')).length).toBeGreaterThan(5);
    expect(specs.find((s) => s.id === 'n')!.pose).toMatchObject({ x: 20, y: 30 });
  });

  it('read back from the scene as the spec the root holds, edits included, beside the graph pages', () => {
    const scene = sceneOf();
    replacePlotData(scene, plotRootIdOf('two'), setXyValue(CHART, 0, 1, 9));
    const doc = documentFromScene(scene, { theme: THEME });
    expect(doc.pages.map((p) => p.kind)).toEqual(['graph', 'plot']);
    const plot = doc.pages[1] as PlotPage;
    expect(plot).toMatchObject({ id: 'two', name: 'Chart', width: 500, height: 300 });
    expect(plot.data.series[0]!.values).toEqual([3, 9]);
    const graph = doc.pages[0]!;
    expect(graph.kind === 'graph' && graph.data.nodes.map((n) => n.id)).toEqual(['n']);
  });

  it('export to SVG as their marks', async () => {
    const scene = sceneOf();
    const svg = await exportPageSvg(scene as never, { x: 440, y: 0, width: 500, height: 300 }, { background: null });
    const parsed = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const bar = scene.get(`${plotRootIdOf('two')}/bar:0:1` as NodeId)!;
    const color = (bar.data as { fill: { paint: { color: string } } }).fill.paint.color;
    expect(parsed.querySelector(`[fill="${color}"]`)).not.toBeNull();
    expect(parsed.querySelector('text')?.textContent).toBe('Sales');
  });
});
