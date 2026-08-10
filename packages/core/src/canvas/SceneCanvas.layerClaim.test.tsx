/**
 * A registered layer's hit reaches the dispatcher as a full claim: its own id
 * as `owner`, its declared `strength`, and its `cursor` intact. `cursor` is
 * the half that silently didn't work — `wrappedAffordanceAt` built
 * `{ kind, payload }` by hand and dropped it, so the hover-cursor pump
 * (`refreshHoverCursor` in `useGestureDispatcher`) never saw it. `strength`
 * has no runtime consumer until Task 3, so a passthrough check on
 * `hitTestExtras` is the honest most that can be asserted on it today.
 */
import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import React from 'react';
import { SceneCanvas } from './SceneCanvas';
import { useScene } from 'core/scene/useScene';
import type { SceneCanvasApi } from './canvasExtension';
import type { RenderLayer } from 'core/layers/render';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

/**
 * jsdom doesn't implement PointerEvent with clientX/clientY via the
 * constructor; synthesize via Event + Object.assign instead.
 */
function makePointerEvent(type: string, init: Record<string, unknown> = {}): PointerEvent {
  const ev = new Event(type, { bubbles: true }) as PointerEvent;
  Object.assign(ev, { clientX: 0, clientY: 0, pointerId: 1, ...init });
  return ev;
}

interface Empty { id: string }

const claimLayer: RenderLayer<unknown> = {
  id: 'test-claimer',
  label: 'Test claimer',
  space: 'screen',
  draw: () => [],
  hitTest: () => ({
    initialScratch: { note: 'hi' },
    cursor: 'nwse-resize',
    strength: 'exclusive',
  }),
};

function Harness({ apiOut }: { apiOut: { ref: React.RefObject<SceneCanvasApi | null> } }) {
  const ref = React.useRef<SceneCanvasApi>(null);
  apiOut.ref = ref;
  const scene = useScene<Empty>({ items: [] });
  React.useEffect(() => ref.current?.registerLayer(claimLayer), []);
  return <SceneCanvas ref={ref} width={200} height={200} scene={scene} layers={{}} />;
}

describe('a registered layer produces a full claim', () => {
  it('carries strength through hitTestExtras', async () => {
    const apiOut = { ref: { current: null } as React.RefObject<SceneCanvasApi | null> };
    render(<Harness apiOut={apiOut} />);
    await act(async () => {});

    const extra = apiOut.ref.current!.hitTestExtras(10, 10);
    expect(extra).not.toBeNull();
    expect(extra!.binding.strength).toBe('exclusive');
  });

  it('a declared cursor reaches canvas.style.cursor through the hover-cursor pump', async () => {
    const apiOut = { ref: { current: null } as React.RefObject<SceneCanvasApi | null> };
    const { container } = render(<Harness apiOut={apiOut} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 10, clientY: 10 }));
    });

    expect(canvas.style.cursor).toBe('nwse-resize');
  });
});
