import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { Canvas } from './Canvas';
import type { RenderLayer } from 'core/layers/render';
import type { CanvasDebugSink } from '../debug/types';
import type { CanvasExtensionApi } from './canvasExtension';
import { ROTATED_POSE_DESCRIPTOR } from 'interactions/actions/resize/geometry';
import { stubCanvasContext, waitForFrame } from './testing/stubCanvasContext';

beforeAll(stubCanvasContext);

describe('Canvas baseBoundsOf synthesis', () => {
  it('synthesized boundsOf folds rotation from descriptor.getRotation', () => {
    // Adapter holds a rotated pose; Canvas should synthesize boundsOf that
    // includes the rotation field when poseDescriptor={ROTATED_POSE_DESCRIPTOR}.
    type RotPose = { id: string; x: number; y: number; width: number; height: number; rotation: number };
    const item: RotPose = { id: 'a', x: 0, y: 0, width: 100, height: 60, rotation: Math.PI / 4 };

    const adapter = {
      getNodes: () => [item],
      getNode: (id: string) => (id === 'a' ? item : undefined),
      getPose: (id: string): RotPose | null => (id === 'a' ? item : null),
      setPose: () => {},
      getSelected: () => [],
      setSelected: () => {},
    };

    const helpersRef: React.MutableRefObject<{ getEffectiveBounds(id: string): { x: number; y: number; width: number; height: number; rotation?: number } | null } | null> = { current: null };

    function Harness() {
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          poseDescriptor={ROTATED_POSE_DESCRIPTOR as never}
          helpersRef={helpersRef as never}
        />
      );
    }

    render(<Harness />);

    // helpersRef is set synchronously during render; getEffectiveBounds goes
    // through effectiveBoundsOf → baseBoundsOf → geometry.getRotation.
    const bounds = helpersRef.current?.getEffectiveBounds('a');
    expect(bounds).not.toBeNull();
    expect((bounds as { rotation?: number }).rotation).toBeCloseTo(Math.PI / 4, 5);
  });

  it('requestRedraw on the ref bumps the redraw effect', async () => {
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };
    const ref = React.createRef<CanvasExtensionApi>();
    render(
      <Canvas
        ref={ref}
        width={200} height={200}
        layers={{}}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />
    );
    await waitForFrame();
    const beginFrameSpy = vi.spyOn(sinkRef.current!, 'beginFrame');
    act(() => { ref.current?.requestRedraw(); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();
  });

  it('hitTestExtras hands a registered layer the same live data draw gets', async () => {
    let seen: unknown = 'not-called';
    const probe: RenderLayer<unknown> = {
      id: 'probe', label: 'probe', space: 'screen',
      draw: () => [],
      hitTest: (_x, _y, data) => { seen = data; return null; },
    };
    const ref = React.createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={100} height={100} layers={{}} />);
    await waitForFrame();
    act(() => { ref.current?.registerLayer(probe); });
    act(() => { ref.current?.hitTestExtras(0, 0); });

    // `composeAffordanceLayer.hitTest` reads chrome state out of this envelope;
    // handing it `undefined` used to throw inside the pointerdown handler.
    expect(typeof (seen as { getChromeState?: unknown })?.getChromeState).toBe('function');
  });

  it('hitTestExtras skips a layer hidden by layerVisibility', async () => {
    const hitTest = vi.fn(() => ({ id: 'probe' } as never));
    const probe: RenderLayer<unknown> = {
      id: 'probe', label: 'probe', space: 'screen', draw: () => [], hitTest,
    };
    const ref = React.createRef<CanvasExtensionApi>();
    const { rerender } = render(
      <Canvas ref={ref} width={100} height={100} layers={{}} layerVisibility={{ probe: false }} />,
    );
    await waitForFrame();
    act(() => { ref.current?.registerLayer(probe); });

    expect(ref.current?.hitTestExtras(0, 0)).toBeNull();
    expect(hitTest).not.toHaveBeenCalled();

    rerender(<Canvas ref={ref} width={100} height={100} layers={{}} layerVisibility={{ probe: true }} />);
    await waitForFrame();
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('probe');
  });

  it('hitTestExtras still consults an alwaysOn layer hidden by the map', async () => {
    const probe: RenderLayer<unknown> = {
      id: 'probe', label: 'probe', space: 'screen', alwaysOn: true,
      draw: () => [], hitTest: () => ({ id: 'probe' } as never),
    };
    const ref = React.createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={100} height={100} layers={{}} layerVisibility={{ probe: false }} />);
    await waitForFrame();
    act(() => { ref.current?.registerLayer(probe); });
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('probe');
  });

  it('hitTestExtras tests under a supplied frame instead of the canvas view', async () => {
    const seen: { view?: unknown; dims?: unknown }[] = [];
    const probe: RenderLayer<unknown> = {
      id: 'probe', label: 'probe', space: 'screen',
      draw: () => [],
      hitTest: (_x, _y, _data, view, dims) => { seen.push({ view, dims }); return null; },
    };
    const ref = React.createRef<CanvasExtensionApi>();
    render(<Canvas ref={ref} width={100} height={100} layers={{}} />);
    await waitForFrame();
    act(() => { ref.current?.registerLayer(probe); });

    const inner = { x: 250, y: 200, scale: { x: 1.6, y: 1.6 } };
    act(() => { ref.current?.hitTestExtras(0, 0); });
    act(() => { ref.current?.hitTestExtras(0, 0, { view: inner, dims: { width: 240, height: 160 } }); });

    expect(seen[0]!.dims).toEqual({ width: 100, height: 100 });
    expect(seen[1]!.view).toBe(inner);
    expect(seen[1]!.dims).toEqual({ width: 240, height: 160 });
  });

  it('registerLayer adds a layer to the active stack and detach removes it', async () => {
    // Under jsdom the GL path bails before layer.draw runs, so we observe
    // draw-pass participation indirectly via debugSink.beginFrame (same proxy
    // the requestRedraw test uses).
    const sinkRef: { current: CanvasDebugSink | null } = { current: null };
    const extra: RenderLayer<unknown> = {
      id: 'extra', label: 'extra', space: 'screen',
      draw: () => [],
    };
    const ref = React.createRef<CanvasExtensionApi>();
    render(
      <Canvas
        ref={ref}
        width={100} height={100}
        layers={{}}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />
    );
    await waitForFrame();

    // After registerLayer, a new frame should be triggered.
    let detach: (() => void) | undefined;
    const beginFrameSpy = vi.spyOn(sinkRef.current!, 'beginFrame');
    act(() => { detach = ref.current?.registerLayer(extra); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();
    expect(sinkRef.current!.snapshot().layers.some(l => l.id === 'extra')).toBe(true);

    // After detach + another redraw, beginFrame fires again but the extra layer
    // should be absent from the snapshot's layer list.
    beginFrameSpy.mockClear();
    act(() => { detach?.(); });
    act(() => { ref.current?.requestRedraw(); });
    await waitForFrame();
    expect(beginFrameSpy).toHaveBeenCalled();
    const snapshot = sinkRef.current!.snapshot();
    expect(snapshot.layers.some(l => l.id === 'extra')).toBe(false);
  });
});
