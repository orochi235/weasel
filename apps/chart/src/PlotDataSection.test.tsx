import { createScene, type NodeId } from '@weasel-js/core';
import { plotRootOf, plotSpecs } from '@weasel-js/plot';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { CHART_LAYERS, CHART_REGISTRY, type ChartData, type ChartLayer, type ChartPose } from './chartDocument';
import { PlotDataSection } from './PlotDataSection';

function chartWithPie() {
  const scene = createScene<ChartData, ChartLayer, ChartPose>({ systemLayers: CHART_LAYERS, registry: CHART_REGISTRY });
  const specs = plotSpecs({ kind: 'pie', slices: [{ label: 'Dogs', value: 3 }] }, { id: 'p', layer: 'shapes', box: { x: 0, y: 0, width: 400, height: 300 } });
  for (const spec of specs) scene.add(spec as never);
  return scene;
}

describe('PlotDataSection', () => {
  it('shows the data of the chart a selected mark belongs to, each edit one undo entry', () => {
    const scene = chartWithPie();
    const mark = scene.childrenOf('p' as NodeId)[0]!;
    const { rerender } = render(<PlotDataSection scene={scene} selected={[mark]} />);
    fireEvent.click(screen.getByRole('button', { name: 'Add slice' }));
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toEqual({ kind: 'pie', slices: [{ label: 'Dogs', value: 3 }, { label: 'Slice 2', value: 1 }] });
    rerender(<PlotDataSection scene={scene} selected={['p']} />);
    expect(screen.getByRole('textbox', { name: 'Label of Slice 2' })).toBeTruthy();
    scene.undo();
    expect(plotRootOf(scene.get('p' as NodeId))!.data).toEqual({ kind: 'pie', slices: [{ label: 'Dogs', value: 3 }] });
  });

  it('shows nothing for a selection in no chart', () => {
    const { container } = render(<PlotDataSection scene={chartWithPie()} selected={[]} />);
    expect(container.textContent).toBe('');
  });
});
