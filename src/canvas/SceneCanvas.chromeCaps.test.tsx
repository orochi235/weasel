/**
 * End-to-end smoke for the chrome-caps wiring:
 *
 *   chromeVisibility prop → SceneCanvas builds getIsVisibleForCanvas →
 *   Canvas threads it into helpersForLayers.getIsVisible →
 *   composeAffordanceLayer / createSelectionOverlayLayer gate on the
 *   per-id predicate.
 *
 * Renders a `<SceneCanvas>` and reads `helpersRef.current.getIsVisible()`
 * to assert the resolver actually merges the consumer override with the
 * kit defaults and reflects the live ChromeCtx (selection, gesture).
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act, fireEvent } from '@testing-library/react';
import { useRef, useEffect } from 'react';
import type React from 'react';
import { SceneCanvas } from './SceneCanvas';
import type { CanvasHelpers } from './Canvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { never } from 'features/chrome-caps';
import type { VisibilityRules } from 'features/chrome-caps';

type D = { kind: string };
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
    s.add({
      kind: 'leaf', data: { kind: 'rect' }, layer: 'main',
      pose: { x: 10, y: 10, width: 50, height: 50 },
    });
  });
  return s;
}

function firstId(scene: Scene<D, L, P>): NodeId {
  for (const id of scene.renderOrder()) return id;
  throw new Error('No nodes');
}

function renderWith(
  scene: Scene<D, L, P>,
  selection: NodeId[],
  chromeVisibility: VisibilityRules | undefined,
): { helpersRef: React.MutableRefObject<CanvasHelpers<P> | null> } {
  const helpersRef: React.MutableRefObject<CanvasHelpers<P> | null> = { current: null };
  const selApi = {
    current: selection,
    get() { return [...selection]; },
    set() {}, add() {}, remove() {}, toggle() {}, clear() {},
    contains(id: NodeId) { return selection.includes(id); },
    applyClick() {},
    adapterMethods: {
      getSelection: () => [...selection],
      setSelection: () => {},
    },
  };

  function Probe() {
    const localRef = useRef<CanvasHelpers<P> | null>(null);
    useEffect(() => {
      helpersRef.current = localRef.current;
    });
    return (
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selection={selApi as Parameters<typeof SceneCanvas>[0]['selection']}
        helpersRef={localRef}
        {...(chromeVisibility !== undefined ? { chromeVisibility } : {})}
      />
    );
  }
  render(<Probe />);
  return { helpersRef };
}

describe('SceneCanvas — chrome-caps wiring', () => {
  it('helpers.getIsVisible reflects kit defaults when no override is supplied', () => {
    const scene = makeScene();
    const { helpersRef } = renderWith(scene, [firstId(scene)], undefined);
    act(() => {});
    const isVisible = helpersRef.current!.getIsVisible();
    // With one selection, no gesture: outline + resize-handles visible.
    // rotation-handle requires focused=true; SceneCanvas defaults focused
    // to true when no getFocused is wired.
    expect(isVisible('selection.outline')).toBe(true);
    expect(isVisible('selection.resize-handles')).toBe(true);
    expect(isVisible('selection.rotation-handle')).toBe(true);
  });

  it('consumer override beats defaults', () => {
    const scene = makeScene();
    const { helpersRef } = renderWith(
      scene,
      [firstId(scene)],
      { 'selection.rotation-handle': never },
    );
    act(() => {});
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('selection.outline')).toBe(true);
    expect(isVisible('selection.resize-handles')).toBe(true);
    expect(isVisible('selection.rotation-handle')).toBe(false);
  });

  it('reflects live selection state — empty selection hides outline', () => {
    const scene = makeScene();
    const { helpersRef } = renderWith(scene, [], undefined);
    act(() => {});
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('selection.outline')).toBe(false);
    expect(isVisible('selection.resize-handles')).toBe(false);
  });

  it('helpers.getIsVisible falls back to the universal predicate when chromeVisibility is omitted ' +
     'AND no rule matches the queried id', () => {
    const scene = makeScene();
    const { helpersRef } = renderWith(scene, [firstId(scene)], undefined);
    act(() => {});
    const isVisible = helpersRef.current!.getIsVisible();
    // Ids the kit has no default for fall through to `always`.
    expect(isVisible('something.custom')).toBe(true);
  });
});

/** Variant harness for selectionMode tests — returns the rendered container
 *  so tests can drive pointer events on the canvas to start a real marquee. */
function renderWithMode(
  scene: Scene<D, L, P>,
  selectionMode: 'single' | 'none',
): {
  helpersRef: React.MutableRefObject<CanvasHelpers<P> | null>;
  container: HTMLElement;
} {
  const helpersRef: React.MutableRefObject<CanvasHelpers<P> | null> = { current: null };
  function Probe() {
    const localRef = useRef<CanvasHelpers<P> | null>(null);
    useEffect(() => {
      helpersRef.current = localRef.current;
    });
    return (
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selectionMode={selectionMode}
        helpersRef={localRef}
      />
    );
  }
  const { container } = render(<Probe />);
  return { helpersRef, container };
}

describe('SceneCanvas — selectionMode none suppresses marquee chrome', () => {
  function dragOnEmpty(container: HTMLElement) {
    const canvas = container.querySelector('canvas')!;
    act(() => {
      fireEvent.pointerDown(canvas, { clientX: 200, clientY: 200, pointerId: 1, button: 0 });
      fireEvent.pointerMove(canvas, { clientX: 300, clientY: 280, pointerId: 1 });
    });
    return canvas;
  }

  it('control: default mode shows action.marquee while an empty-drag is in flight', () => {
    const scene = makeScene();
    const { helpersRef, container } = renderWithMode(scene, 'single');
    act(() => {});
    dragOnEmpty(container);
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('action.marquee')).toBe(true);
  });

  it('selectionMode none: action.marquee stays hidden mid-drag', () => {
    const scene = makeScene();
    const { helpersRef, container } = renderWithMode(scene, 'none');
    act(() => {});
    dragOnEmpty(container);
    const isVisible = helpersRef.current!.getIsVisible();
    expect(isVisible('action.marquee')).toBe(false);
    expect(isVisible('action.lasso')).toBe(false);
  });
});
