/**
 * A registered layer's declared cursor reaches `canvas.style.cursor`.
 * `wrappedAffordanceAt` used to build `{ kind, payload }` by hand and drop
 * `cursor` on the floor, so the hover-cursor pump (`refreshHoverCursor` in
 * `useGestureDispatcher`) never saw it.
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

// `strength: claim.strength ?? 'shared'` is the compatibility promise every
// pre-`LayerHit` layer relies on; `@weasel-js/hud` is the only one that
// opts into `'exclusive'`.

const bareLayer: RenderLayer<unknown> = {
  id: 'bare-claimer',
  label: 'Bare claimer',
  space: 'screen',
  draw: () => [],
  hitTest: () => ({ initialScratch: { note: 'no strength here' } }),
};

function RectHarness({ apiOut }: { apiOut: { sceneRef: { current: ReturnType<typeof useScene<Empty>> | null } } }) {
  const ref = React.useRef<SceneCanvasApi>(null);
  const scene = useScene<Empty>({ items: [] });
  apiOut.sceneRef.current = scene;
  React.useEffect(() => ref.current?.registerLayer(bareLayer), []);
  return (
    <SceneCanvas
      ref={ref}
      width={200}
      height={200}
      scene={scene}
      layers={{}}
      defaultTools={['rect']}
      initialActiveTool="rect"
    />
  );
}

describe('a layer hit with no declared strength defaults to shared', () => {
  it('a drag over the layer still reaches the active tool', async () => {
    const apiOut = { sceneRef: { current: null } as { current: ReturnType<typeof useScene<Empty>> | null } };
    const { container } = render(<RectHarness apiOut={apiOut} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 60, clientY: 60 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 60, clientY: 60 }));
    });

    // The bare claim (no `strength`) must not become exclusive; if it did,
    // rect's untargeted `drag` binding would be filtered out of the pool
    // and no node would be inserted.
    expect(apiOut.sceneRef.current!.nodes.size).toBe(1);
  });
});

// `owner: extra.layerId` (`SceneCanvas.tsx`) also has no test. Its one
// production reader is the dispatcher's dead-claim warning: an exclusive
// claim whose kind nothing recognizes (not `editAnchors`, not
// `enterPathEdit`, not any tool binding) reaches the dispatcher, matches
// nothing, and warns naming `owner`. No option threads a `warn` override
// through `<SceneCanvas>` — `dispatcher.ts` calls `matchSorted` with no
// `warn` argument at both call sites — so `console.warn` is the real sink
// a consumer sees too; spying on it observes production behavior, not an
// internal.

function ownerProbeLayer(id: string): RenderLayer<unknown> {
  return {
    id,
    label: 'Owner probe',
    space: 'screen',
    draw: () => [],
    hitTest: () => ({ strength: 'exclusive' }),
  };
}

function OwnerProbeHarness({ apiOut, layerId }: {
  apiOut: { ref: React.RefObject<SceneCanvasApi | null> };
  layerId: string;
}) {
  const ref = React.useRef<SceneCanvasApi>(null);
  apiOut.ref = ref;
  const scene = useScene<Empty>({ items: [] });
  React.useEffect(() => ref.current?.registerLayer(ownerProbeLayer(layerId)), [layerId]);
  return (
    <SceneCanvas
      ref={ref}
      width={200}
      height={200}
      scene={scene}
      layers={{}}
      defaultTools={['rect']}
      initialActiveTool="rect"
    />
  );
}

describe('the claim carries the layer id as owner', () => {
  it('an exclusive claim from an unrecognized layer warns naming the layer id', async () => {
    const layerId = 'owner-warn-layer';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const apiOut = { ref: { current: null } as React.RefObject<SceneCanvasApi | null> };
    const { container } = render(<OwnerProbeHarness apiOut={apiOut} layerId={layerId} />);
    await act(async () => {});

    const canvas = container.querySelector('canvas')!;
    await act(async () => {
      canvas.dispatchEvent(makePointerEvent('pointerdown', { clientX: 20, clientY: 20 }));
      canvas.dispatchEvent(makePointerEvent('pointermove', { clientX: 60, clientY: 60 }));
      canvas.dispatchEvent(makePointerEvent('pointerup', { clientX: 60, clientY: 60 }));
    });

    expect(warn).toHaveBeenCalledWith(expect.stringContaining(`"${layerId}"`));
    warn.mockRestore();
  });
});
