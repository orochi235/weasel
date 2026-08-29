/**
 * Pick tolerance is declared in screen pixels, so converting it needs the
 * camera the point was produced under — a panel's, when the click landed in
 * one.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, renderHook } from '@testing-library/react';
import { createScene } from 'core/scene/scene';
import { useSceneSelectTool } from './SceneCanvas/useSceneSelectTool';
import { useSelection } from 'core/selection/useSelection';
import { CanvasView } from './CanvasView';
import { ViewInputsProvider } from './viewInputs';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import type { View } from 'core/viewport/view';
import { useEffect } from 'react';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const PANEL = { x: 100, y: 0, w: 100, h: 100 };
const PANEL_VIEW: View = { x: 0, y: 0, scale: { x: 8, y: 8 } };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

describe('pick tolerance converts against the camera the point came from', () => {
  it('a 4px slop is 4 world units at scale 1 and 0.5 at scale 8', () => {
    const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
    scene.add({ kind: 'leaf', layer: 'main', pose: { x: 0, y: 0, width: 10, height: 10 }, data: { kind: 'rect' } });

    const { result } = renderHook(() => {
      const selection = useSelection();
      // The surface's camera: scale 1.
      return useSceneSelectTool<D, 'main', P>({
        scene, selection, getView: () => ({ scale: { x: 1, y: 1 } }),
      });
    });

    // 2 world units past the right edge.
    expect(result.current.pickEvery(12, 5)).toHaveLength(1);
    // The same point through a 8× camera: the slop is 0.5 world units, so it misses.
    expect(result.current.pickEvery(12, 5, { scale: { x: 8, y: 8 } })).toHaveLength(0);
  });

  it('a view hit-tests against its own camera', () => {
    const seen: Array<{ scale: { x: number; y: number } } | null | undefined> = [];
    let registry!: ViewRegistry;
    function Probe() {
      const r = useOptionalViewRegistry();
      useEffect(() => { registry = r!; });
      return null;
    }
    const inputs = {
      adapter: undefined,
      geometry: AUTO_POSE_DESCRIPTOR as never,
      boundsOf: undefined,
      tools: undefined,
      selectionApi: { current: [], get: () => [], set: () => {} } as never,
      pickBest: (_wx: number, _wy: number, view?: { scale: { x: number; y: number } } | null) => {
        seen.push(view);
        return null;
      },
    };
    render(
      <ViewRegistryProvider>
        <ViewInputsProvider value={inputs as never}>
          <Probe />
          <CanvasView id="panel" bounds={PANEL} defaultView={PANEL_VIEW} />
        </ViewInputsProvider>
      </ViewRegistryProvider>,
    );

    registry.list()[0]!.target.classifyTarget!({ x: 150, y: 10 });
    expect(seen).toEqual([PANEL_VIEW]);
  });
});
