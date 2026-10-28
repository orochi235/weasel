import { describe, expect, it } from 'vitest';
import { diagramViewBounds, fitDiagram } from './diagramFit';
import { diagramScene } from './fromData';

describe('fitDiagram', () => {
  it('takes in a route that runs past every node box', () => {
    const specs = diagramScene({
      nodes: [{ id: 'a', lines: [], width: 40, height: 40, at: { x: 0, y: 0 } }, { id: 'b', lines: [], width: 40, height: 40, at: { x: 200, y: 0 } }],
      edges: [{ from: 'a', to: 'b', waypoints: [{ x: 20, y: 300 }, { x: 220, y: 300 }] }],
    }, { layout: 'none' });
    const box = { width: 400, height: 200 };
    const view = fitDiagram(specs, box)!;
    expect(view.y + box.height / view.scale.y).toBeGreaterThanOrEqual(300);
  });

  it('keeps a fit inside bounds, centering a diagram smaller than the box', () => {
    const specs = diagramScene({ nodes: [{ id: 'a', lines: [], width: 40, height: 40, at: { x: 0, y: 0 } }], edges: [] }, { layout: 'none' });
    const bounds = diagramViewBounds(specs, 10)!;
    expect(bounds).toEqual({ x: -10, y: -10, width: 60, height: 60 });
    const view = fitDiagram(specs, { width: 400, height: 200 }, { anchor: 'start', bounds })!;
    expect(view.x + 200 / view.scale.x).toBeCloseTo(20);
    expect(view.y + 100 / view.scale.y).toBeCloseTo(20);
  });
});
