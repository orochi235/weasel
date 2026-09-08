/**
 * Two `<SceneCanvas>`es under one `<ActionsProvider>`: an action one of them
 * opts out of must stay live for the other, and come back when the opting-out
 * canvas leaves.
 *
 * Pinch zoom is the vehicle because `viewport={{ pinchZoom: false }}` is the
 * shortest path to an opt-out. These assert the emitted view, so the absent
 * WebGL context is irrelevant.
 */

import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { ActionsProvider } from 'interactions/actions/registry';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';

type D = { kind: 'rect' };
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

// Two canvases under one provider warn about the shared dispatcher slot —
// a separate, already-reported condition.
let warn: ReturnType<typeof vi.spyOn>;
beforeAll(() => { warn = vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { warn.mockClear(); });

function sized(el: HTMLCanvasElement): HTMLCanvasElement {
  el.getBoundingClientRect = () => ({
    left: 0, top: 0, right: 400, bottom: 400,
    width: 400, height: 400, x: 0, y: 0, toJSON() { return {}; },
  }) as DOMRect;
  return el;
}

/** Spread two fingers 100px → 200px on `canvas`: one clean factor of 2. */
function pinch(canvas: HTMLCanvasElement, emitted: View[]): View[] {
  const fire = (type: string, pointerId: number, clientX: number, clientY: number) => {
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId, clientX, clientY }));
  };
  act(() => {
    fire('pointerdown', 1, 100, 100);
    fire('pointerdown', 2, 200, 100);
  });
  emitted.length = 0;
  act(() => { fire('pointermove', 2, 300, 100); });
  const out = [...emitted];
  act(() => {
    fire('pointerup', 1, 100, 100);
    fire('pointerup', 2, 300, 100);
  });
  emitted.length = 0;
  return out;
}

describe('SceneCanvas action scopes', () => {
  it('leaves pinch zoom live on the canvas that asked for it', () => {
    const keeps: View[] = [];
    const optsOut: View[] = [];
    const sceneA = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const sceneB = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <ActionsProvider>
        <SceneCanvas
          scene={sceneA} layers={{}} width={400} height={400}
          viewport={{ pinchZoom: true }}
          onViewChange={(v) => { keeps.push(v); }}
        />
        <SceneCanvas
          scene={sceneB} layers={{}} width={400} height={400}
          viewport={{ pinchZoom: false }}
          onViewChange={(v) => { optsOut.push(v); }}
        />
      </ActionsProvider>,
    );
    const [a, b] = Array.from(container.querySelectorAll('canvas')).map((el) =>
      sized(el as HTMLCanvasElement),
    );

    expect(pinch(b!, optsOut)).toEqual([]);
    expect(pinch(a!, keeps).map((v) => v.scale.x)).toEqual([2]);
  });

  it('gives pinch zoom back when the opting-out canvas unmounts', () => {
    const keeps: View[] = [];
    const sceneA = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const sceneB = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const both = (
      <ActionsProvider>
        <SceneCanvas
          scene={sceneA} layers={{}} width={400} height={400}
          viewport={{ pinchZoom: true }}
          onViewChange={(v) => { keeps.push(v); }}
        />
        <SceneCanvas
          scene={sceneB} layers={{}} width={400} height={400}
          viewport={{ pinchZoom: false }}
        />
      </ActionsProvider>
    );
    const { container, rerender } = render(both);
    act(() => {
      rerender(
        <ActionsProvider>
          <SceneCanvas
            scene={sceneA} layers={{}} width={400} height={400}
            viewport={{ pinchZoom: true }}
            onViewChange={(v) => { keeps.push(v); }}
          />
        </ActionsProvider>,
      );
    });
    const a = sized(container.querySelector('canvas')!);
    expect(pinch(a, keeps).map((v) => v.scale.x)).toEqual([2]);
  });

  it('keeps actions={{ id: null }} to the canvas that passed it', () => {
    const keeps: View[] = [];
    const sceneA = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const sceneB = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <ActionsProvider>
        <SceneCanvas
          scene={sceneA} layers={{}} width={400} height={400}
          onViewChange={(v) => { keeps.push(v); }}
        />
        <SceneCanvas
          scene={sceneB} layers={{}} width={400} height={400}
          actions={{ 'viewport.pinchZoom': null }}
        />
      </ActionsProvider>,
    );
    const a = sized(container.querySelectorAll('canvas')[0] as HTMLCanvasElement);
    expect(pinch(a, keeps).map((v) => v.scale.x)).toEqual([2]);
  });
});
