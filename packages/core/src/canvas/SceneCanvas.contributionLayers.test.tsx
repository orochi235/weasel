/**
 * A contribution's `layers` are registered, hit-tested layers, in entry order,
 * and keep that order when one entry is rebuilt.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import * as React from 'react';
import { act, cleanup, render } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { RenderLayer } from 'core/layers/render';
import type { SceneCanvasApi } from './canvasExtension';
import type { SurfaceContribution } from './surfaceContribution';
import { makeGLRecorder } from '@weasel-js/renderer/testing/glRecorder';

beforeAll(() => {
  const recorder = makeGLRecorder();
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn((kind: unknown) => (kind === 'webgl2' ? recorder.gl : null));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

afterEach(() => { cleanup(); });

const scene = createScene<unknown, 'main', { x: number; y: number; width: number; height: number }>({ systemLayers: [{ id: 'main' }] });

/** A layer that claims every point. */
function claiming(id: string): RenderLayer<unknown> {
  return { id, label: id, space: 'screen', draw: () => [], hitTest: () => ({}) };
}

const entry = (id: string, layer: RenderLayer<unknown>): SurfaceContribution => ({ id, eligibility: { always: true }, layers: [layer] });

function Harness({ ambient, canvasRef }: { ambient: SurfaceContribution[]; canvasRef: React.Ref<SceneCanvasApi> }) {
  return <SceneCanvas ref={canvasRef} scene={scene} layers={{}} width={100} height={100} ambient={ambient} />;
}

describe('SurfaceContribution.layers', () => {
  it('are hit-tested, the last entry first', () => {
    const ref = React.createRef<SceneCanvasApi>();
    render(<Harness canvasRef={ref} ambient={[entry('a', claiming('a')), entry('b', claiming('b'))]} />);
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('b');
  });

  it('keep entry order when an earlier entry is rebuilt', () => {
    const ref = React.createRef<SceneCanvasApi>();
    const b = entry('b', claiming('b'));
    const { rerender } = render(<Harness canvasRef={ref} ambient={[entry('a', claiming('a')), b]} />);
    rerender(<Harness canvasRef={ref} ambient={[entry('a', claiming('a2')), b]} />);
    expect(ref.current?.hitTestExtras(0, 0)?.layerId).toBe('b');
  });

  it('unregister with their entry', () => {
    const ref = React.createRef<SceneCanvasApi>();
    const { rerender } = render(<Harness canvasRef={ref} ambient={[entry('a', claiming('a'))]} />);
    act(() => { rerender(<Harness canvasRef={ref} ambient={[]} />); });
    expect(ref.current?.hitTestExtras(0, 0)).toBeNull();
  });
});
