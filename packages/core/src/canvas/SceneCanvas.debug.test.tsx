/**
 * SceneCanvas — the debug overlay's config reaches the canvas, and viewport
 * actions report what they did to the canvas's sink through the `debug` dep.
 *
 * jsdom has no WebGL, so these read the sink rather than the pixels.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import { createScene } from 'core/scene/scene';
import { dragPanContribution } from '../tools/builtin/hand/dragPanContribution';
import type { CanvasDebugSink, DebugConfig } from '../debug/types';
import type { Contribution } from '../tools/overlayBinding';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as {
    getContext: (...args: unknown[]) => unknown;
    setPointerCapture: (...args: unknown[]) => void;
    releasePointerCapture: (...args: unknown[]) => void;
  };
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function mount(debug: DebugConfig | false, ambient: Contribution[] = []) {
  const scene = createScene<unknown, 'main', { x: number; y: number }>({ systemLayers: [{ id: 'main' }] });
  const sinkRef = { current: null as CanvasDebugSink | null };
  const ref = { current: null as SceneCanvasApi | null };
  const { container } = render(
    <SceneCanvas
      features={['view']}
      ref={ref}
      scene={scene}
      layers={{}}
      width={200}
      height={200}
      debug={debug}
      debugSinkRef={sinkRef}
      ambient={ambient}
    />,
  );
  const canvas = container.querySelector('canvas')!;
  canvas.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 200, bottom: 200, width: 200, height: 200, x: 0, y: 0, toJSON() { return {}; },
  }) as DOMRect;
  return { canvas, sinkRef, ref };
}

describe('SceneCanvas debug', () => {
  it('hands its debug config to the canvas, which then keeps a sink', () => {
    expect(mount({ bounds: true }).sinkRef.current).not.toBeNull();
    expect(mount(false).sinkRef.current).toBeNull();
  });

  it('exposes the sink on its handle', () => {
    const { sinkRef, ref } = mount({ viewport: true });
    expect(ref.current!.getDebug()).toBe(sinkRef.current);
  });

  it('records a wheel zoom with the world point it held under the pointer', () => {
    const { canvas, sinkRef } = mount({ viewport: true });
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', {
        bubbles: true, cancelable: true, deltaY: -100, ctrlKey: true, clientX: 50, clientY: 80,
      }));
    });
    const rec = sinkRef.current!.snapshot().viewport!;
    expect(rec.kind).toBe('zoom');
    expect(rec.from.scale.x).toBe(1);
    expect(rec.to.scale.x).toBeCloseTo(1.1);
    expect(rec.anchor).toEqual({ x: 50, y: 80 });
  });

  it('records a drag pan against the view it started from, anchored at the press', () => {
    const { canvas, sinkRef } = mount({ viewport: true }, [dragPanContribution()]);
    const fire = (type: string, x: number, y: number) =>
      canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, isPrimary: true }));
    act(() => {
      fire('pointerdown', 50, 50);
      fire('pointermove', 65, 60);
      fire('pointermove', 80, 70);
      fire('pointerup', 80, 70);
    });
    const rec = sinkRef.current!.snapshot().viewport!;
    expect(rec.kind).toBe('pan');
    expect([rec.from.x, rec.from.y]).toEqual([0, 0]);
    expect([rec.to.x, rec.to.y]).toEqual([-30, -20]);
    expect(rec.anchor).toEqual({ x: 50, y: 50 });
  });

  it('records a wheel pan', () => {
    const { canvas, sinkRef } = mount({ viewport: true });
    act(() => {
      canvas.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, deltaX: 0, deltaY: 40 }));
    });
    const rec = sinkRef.current!.snapshot().viewport!;
    expect(rec.kind).toBe('pan');
    expect(rec.to.y).not.toBe(rec.from.y);
  });
});
