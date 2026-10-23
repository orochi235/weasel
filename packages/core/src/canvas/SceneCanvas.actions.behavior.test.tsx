import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene } from 'core/scene/types';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L, pose: { x: 0, y: 0, width: 10, height: 10 } as P });
  });
  return s;
}

describe('SceneCanvas keydown dispatch', () => {
  it('Escape clears the selection', () => {
    const scene = makeScene();
    scene.setSelection([...scene.renderOrder()]);
    expect(scene.getSelection()).toHaveLength(1);
    render(<SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64} />);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(scene.getSelection()).toEqual([]);
  });

  it('skipInEditable: keydown inside an <input> does not invoke the action', () => {
    const scene = makeScene();
    const customRun = vi.fn();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{ selectAll: { invoker: { timing: 'immediate' as const, run: () => { customRun(); } } } }} />,
    );
    const input = document.createElement('input');
    document.body.appendChild(input);
    input.focus();
    act(() => { input.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })); });
    expect(customRun).not.toHaveBeenCalled();
    document.body.removeChild(input);
  });

  it("an action's run that throws is logged but does not break subsequent dispatches", () => {
    const scene = makeScene();
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const next = vi.fn();
    render(
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={64} height={64}
        actions={{
          selectAll: { invoker: { timing: 'immediate', run: () => { throw new Error('boom'); } } },
          // Override `enabled` so the dispatcher's gate doesn't suppress `escape`
          // when there is no active selection (the test doesn't set one up).
          escape: { invoker: { timing: 'immediate' as const, run: () => { next(); } }, enabled: () => true },
        }} />,
    );
    // jsdom is not Mac, so `mod: true` in the defaultBinding resolves to ctrlKey.
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true })); });
    expect(errSpy).toHaveBeenCalled();
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); });
    expect(next).toHaveBeenCalledOnce();
    errSpy.mockRestore();
  });
});
