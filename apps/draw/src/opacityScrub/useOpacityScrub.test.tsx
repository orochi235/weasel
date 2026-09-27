/**
 * Hold O and turn the wheel: the scrub tool engages at hotkey scope, so the
 * wheel reaches its nudge action and not the viewport's pan/zoom bindings.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act, cleanup } from '@testing-library/react';
import {
  SceneCanvas, asNodeId, paintAlpha, solid, useScene, useSelection,
  type FillStyle, type View,
} from '@weasel-js/core';
import { useOpacityScrub } from './useOpacityScrub';

type D = { fill: FillStyle | null };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

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
afterEach(() => cleanup());

const HOME: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const ID = asNodeId('a');

function setup({ selected = true } = {}) {
  const onViewChange = vi.fn();
  let api!: {
    scene: ReturnType<typeof useScene<D, L, P>>;
    percent: number | null;
  };
  function Harness() {
    const scene = useScene<D, L, P>({
      systemLayers: [{ id: 'main' }],
      initial: [{
        id: ID, kind: 'leaf', layer: 'main',
        pose: { x: 0, y: 0, width: 50, height: 50 },
        data: { fill: solid('#ff0000') },
      }],
    });
    const selection = useSelection({ mode: 'multi', scene, initial: selected ? [ID] : [] });
    const { tool, percent } = useOpacityScrub({
      scene: scene as unknown as Parameters<typeof useOpacityScrub>[0]['scene'],
      selection,
    });
    api = { scene, percent };
    return (
      <SceneCanvas
        scene={scene}
        selection={selection}
        width={200} height={200}
        layers={{}}
        view={HOME}
        onViewChange={onViewChange}
        tools={{ opacityScrub: tool }}
      />
    );
  }
  const { container } = render(<Harness />);
  const canvas = container.querySelector('canvas')!;
  const wheel = (init: WheelEventInit = {}) => act(() => {
    canvas.dispatchEvent(new WheelEvent('wheel', { deltaY: 10, bubbles: true, cancelable: true, ...init }));
  });
  const key = (type: 'keydown' | 'keyup') => act(() => {
    window.dispatchEvent(new KeyboardEvent(type, { key: 'o', code: 'KeyO' }));
  });
  const alpha = () => {
    const fill = (api.scene.get(ID)!.data as D).fill;
    return Math.round(paintAlpha(fill!) * 100);
  };
  return { onViewChange, wheel, key, alpha, api: () => api };
}

describe('opacity scrub', () => {
  it('scrubs the selection while O is held, without moving the view', () => {
    const t = setup();
    t.key('keydown');
    expect(t.api().percent).toBe(100);
    t.wheel();
    t.wheel();
    expect(t.alpha()).toBe(90);
    expect(t.api().percent).toBe(90);
    t.wheel({ shiftKey: true });
    expect(t.alpha()).toBe(89);
    expect(t.onViewChange).not.toHaveBeenCalled();
  });

  it('commits the session as one undo entry on release, and the wheel pans again', () => {
    const t = setup();
    const before = t.api().scene.historyIndex();
    t.key('keydown');
    t.wheel();
    t.wheel();
    t.key('keyup');
    expect(t.api().percent).toBe(null);
    expect(t.api().scene.historyIndex()).toBe(before + 1);

    t.wheel();
    expect(t.onViewChange).toHaveBeenCalled();
    expect(t.alpha()).toBe(90);

    act(() => t.api().scene.undo());
    expect(t.alpha()).toBe(100);
  });

  it('commits when the window loses focus mid-hold', () => {
    const t = setup();
    const before = t.api().scene.historyIndex();
    t.key('keydown');
    t.wheel();
    act(() => { window.dispatchEvent(new Event('blur')); });
    expect(t.api().percent).toBe(null);
    expect(t.api().scene.historyIndex()).toBe(before + 1);
  });

  it('opens no session with nothing selected, and leaves the wheel to the viewport', () => {
    const t = setup({ selected: false });
    t.key('keydown');
    expect(t.api().percent).toBe(null);
    t.wheel();
    expect(t.onViewChange).toHaveBeenCalled();
    expect(t.alpha()).toBe(100);
  });
});
