/**
 * `<Canvas backgroundFill>`.
 *
 * Layer composition is read from the debug snapshot's layer list. Under
 * jsdom's GL stub the WebGL branch early-returns before `draw` fires, so this
 * proves at most that a layer was registered and ordered, never its pixels.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render } from '@testing-library/react';
import { Canvas } from './testing/BareCanvas';
import type { CanvasDebugSink } from '../debug/types';
import { waitForFrame } from './testing/stubCanvasContext';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => ({
    canvas: { width: 0, height: 0 },
    clearRect: vi.fn(), fillRect: vi.fn(), strokeRect: vi.fn(),
    save: vi.fn(), restore: vi.fn(), translate: vi.fn(), setTransform: vi.fn(),
    scale: vi.fn(), setLineDash: vi.fn(), beginPath: vi.fn(), closePath: vi.fn(),
    moveTo: vi.fn(), lineTo: vi.fn(), arc: vi.fn(), stroke: vi.fn(), fill: vi.fn(),
    fillText: vi.fn(), measureText: vi.fn(() => ({ width: 10 })),
    font: '', textBaseline: '', globalAlpha: 1,
    fillStyle: '', strokeStyle: '', lineWidth: 1,
  } as unknown as CanvasRenderingContext2D));
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

describe('<Canvas> backgroundFill prop', () => {
  it('includes a scene-background-fill layer before scene in the debug snapshot', async () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{ scene: { layers: [{ key: 'scene', layer: { id: 'scene', label: 'Scene', draw: () => [] } }] } }}
        backgroundFill={{ color: '#ff0000' }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await waitForFrame();

    const ids = sinkRef.current!.snapshot().layers.map((l) => l.id);
    expect(ids).toContain('scene');
    expect(ids).toContain('scene-background-fill');
    expect(ids.indexOf('scene-background-fill')).toBeLessThan(ids.indexOf('scene'));
  });

  it('omitting backgroundFill produces no scene-background-fill layer', async () => {
    const sinkRef: { current: CanvasDebugSink | null } =
      { current: null };

    render(
      <Canvas
        width={200}
        height={200}
        layers={{ scene: { layers: [{ key: 'scene', layer: { id: 'scene', label: 'Scene', draw: () => [] } }] } }}
        debug={{ layers: true }}
        debugSinkRef={sinkRef}
      />,
    );
    await waitForFrame();

    const ids = sinkRef.current!.snapshot().layers.map((l) => l.id);
    expect(ids).toContain('scene');
    expect(ids).not.toContain('scene-background-fill');
  });
});
