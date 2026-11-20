import { describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { RIGID_POSE_COMPOSITION, worldPosesOf, type SceneCanvasApi } from '@weasel-js/core';
import { diagramViewBounds, fitDiagram, useDiagramFit } from './diagramFit';
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

describe('useDiagramFit', () => {
  it('frames the nodes current() gives at the world poses they are drawn at', () => {
    const specs = diagramScene({
      nodes: [{ id: 'a', lines: [], width: 40, height: 40, at: { x: 600, y: 400 } }],
      edges: [],
      containers: [{ id: 'box', role: 'container', members: ['a'], box: { x: 500, y: 300, width: 300, height: 200 } }],
    }, { layout: 'none' });
    expect(specs.find((s) => s.id === 'a')?.parent).toBe('box');
    const world = worldPosesOf(specs as never, RIGID_POSE_COMPOSITION);
    const drawn = specs.map((s) => ({ ...s, pose: world.get(s.id ?? '') ?? s.pose }));
    const setView = vi.fn();
    const canvasRef = { current: { getView: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), setView } as unknown as SceneCanvasApi };
    const size = { width: 400, height: 300 };
    const { result } = renderHook(() => useDiagramFit({
      canvasRef, specs, current: () => drawn, controlled: false, size, fit: {}, extra: undefined,
    }));
    act(() => result.current.fitNow());
    expect(setView).toHaveBeenLastCalledWith(fitDiagram(specs, size));
  });
});
