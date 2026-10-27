/** Behaviors at the Canvas / SceneCanvas seam that no other suite covers. */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { useActionsRegistry, ActionsProvider } from '@weasel-js/routing/react';

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

function firstId(scene: Scene<D, L, P>): NodeId {
  for (const id of scene.renderOrder()) return id;
  throw new Error('No nodes');
}

function idsOf(scene: Scene<D, L, P>): NodeId[] {
  const out: NodeId[] = [];
  for (const id of scene.renderOrder()) out.push(id);
  return out;
}

function pd(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...opts }));
}
function pu(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...opts }));
}

describe('Behavior 3: pickEvery receives view-adjusted worldXY', () => {
  it('worldXY passed to pickEvery accounts for view.x pan offset', () => {
    // With view.x = 50, clientX = 60 is worldX = 110, inside the node at
    // world x=100..140. Without the view offset it would miss.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    scene.batch('seed', () => {
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 100, y: 0, width: 40, height: 400 } as P });
    });
    const id = firstId(scene);

    let selState: NodeId[] = [];
    const selApi = {
      get current() { return selState; },
      get() { return [...selState]; },
      set(ids: NodeId[]) { selState = ids; },
      add(nid: NodeId) { if (!selState.includes(nid)) selState = [...selState, nid]; },
      remove(nid: NodeId) { selState = selState.filter(i => i !== nid); },
      toggle(nid: NodeId) {
        if (selState.includes(nid)) {
          selState = selState.filter(i => i !== nid);
        } else {
          selState.push(nid);
        }
      },
      clear() { selState = []; },
      contains(nid: NodeId) { return selState.includes(nid); },
      applyClick(nid: NodeId, _mods: unknown) { selState = [nid]; },
      adapterMethods: {
        getSelection: () => [...selState],
        setSelection: (ids: NodeId[]) => { selState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        view={{ x: 50, y: 0, scale: { x: 1, y: 1 } }}
        onViewChange={() => {}}
        selection={selApi as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );

    const canvas = container.querySelector('canvas')!;

    act(() => {
      // clientX=60 → worldX=110 (with view.x=50) → hits node at 100..140.
      pd(canvas, 60, 200);
      pu(canvas, 60, 200);
    });

    // The node should be selected because the view transform was applied.
    expect(selState).toContain(id);
  });
});

describe('Behavior 9: viewport.pan and viewport.zoom register action descriptors', () => {
  /** Probe component that reads the actions registry and reports action ids. */
  function ActionProbe({ onIds }: { onIds: (ids: string[]) => void }) {
    const reg = useActionsRegistry();
    useEffect(() => {
      onIds(reg ? reg.list().map(a => a.id) : []);
    });
    return null;
  }

  it('viewport prop registers viewport.pan and viewport.zoom actions', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        viewport={{ pan: true, zoom: true }}
      >
        <ActionProbe onIds={(ids) => { capturedIds = ids; }} />
      </SceneCanvas>,
    );

    expect(capturedIds).toContain('viewport.wheelPan');
    expect(capturedIds).toContain('viewport.zoom');
  });

  it('viewport prop with pan=false does not register viewport.pan', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        viewport={{ pan: false, zoom: true }}
      >
        <ActionProbe onIds={(ids) => { capturedIds = ids; }} />
      </SceneCanvas>,
    );

    expect(capturedIds).not.toContain('viewport.wheelPan');
    expect(capturedIds).toContain('viewport.zoom');
  });

  it('viewport prop with zoom=false does not register viewport.zoom', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        viewport={{ pan: true, zoom: false }}
      >
        <ActionProbe onIds={(ids) => { capturedIds = ids; }} />
      </SceneCanvas>,
    );

    expect(capturedIds).toContain('viewport.wheelPan');
    expect(capturedIds).not.toContain('viewport.zoom');
  });

  it('without explicit viewport prop, viewport.pan and viewport.zoom ARE still registered (defaults to enabled)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
      >
        <ActionProbe onIds={(ids) => { capturedIds = ids; }} />
      </SceneCanvas>,
    );

    expect(capturedIds).toContain('viewport.wheelPan');
    expect(capturedIds).toContain('viewport.zoom');
  });

  // Canvases under one <ActionsProvider> register the same ids, and the second
  // displaces the first. Its teardown must uncover what it displaced.
  it('a sibling canvas unmounting leaves the viewport actions registered', () => {
    const sceneA = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const sceneB = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    function Pair({ showB }: { showB: boolean }) {
      return (
        <ActionsProvider>
          <SceneCanvas features={['draw']} scene={sceneA} layers={{}} width={200} height={200} />
          {showB ? <SceneCanvas features={['draw']} scene={sceneB} layers={{}} width={200} height={200} /> : null}
          <ActionProbe onIds={(ids) => { capturedIds = ids; }} />
        </ActionsProvider>
      );
    }

    const { rerender } = render(<Pair showB />);
    expect(capturedIds).toContain('viewport.zoom');

    act(() => { rerender(<Pair showB={false} />); });
    expect(capturedIds).toContain('viewport.wheelPan');
    expect(capturedIds).toContain('viewport.zoom');
  });
});

/** Minimal mutable SelectionApi stub — `applyClick` replaces the selection
 *  with the clicked id. */
function makeSelectionStub(initial: NodeId[] = []) {
  let selState: NodeId[] = [...initial];
  return {
    get current() { return selState; },
    get() { return [...selState]; },
    set(ids: NodeId[]) { selState = ids; },
    add(id: NodeId) { if (!selState.includes(id)) selState = [...selState, id]; },
    remove(id: NodeId) { selState = selState.filter(i => i !== id); },
    toggle(id: NodeId) {
      if (selState.includes(id)) {
        selState = selState.filter(i => i !== id);
      } else {
        selState = [...selState, id];
      }
    },
    clear() { selState = []; },
    contains(id: NodeId) { return selState.includes(id); },
    applyClick(id: NodeId, _mods: unknown) { selState = [id]; },
    adapterMethods: {
      getSelection: () => [...selState],
      setSelection: (ids: NodeId[]) => { selState = ids; },
    },
  };
}

describe('Seam: selectTool.pickBest forwards into the internal select tool', () => {
  it('alt-click selects the pickBest-returned id even when it is NOT the top-most hit', () => {
    // Two fully-overlapping nodes. The default body pick settles on the
    // top-most (idB), so a pickBest that returns the BOTTOM id (idA) on alt
    // proves the option overrode it.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    scene.batch('seed', () => {
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
    });
    const [idA, idB] = idsOf(scene);

    const selApi = makeSelectionStub();
    const pickBest = vi.fn(
      (_world: unknown, alt: boolean, _sel: readonly string[]) =>
        (alt ? (idA as string) : (idB as string)),
    );

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selection={selApi as Parameters<typeof SceneCanvas>[0]['selection']}
        selectTool={{ pickBest }}
      />,
    );
    const canvas = container.querySelector('canvas')!;

    act(() => {
      pd(canvas, 50, 50, { altKey: true });
      pu(canvas, 50, 50, { altKey: true });
    });

    expect(pickBest).toHaveBeenCalled();
    // alt → pickBest returned idA (the bottom node), overriding the top pick.
    expect(selApi.current).toEqual([idA]);
    expect(selApi.current).not.toContain(idB);
  });

  it('without pickBest, the default top-most pick is used (byte-identical baseline)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    scene.batch('seed', () => {
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
      scene.add({ kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
    });
    const [, idB] = idsOf(scene);

    const selApi = makeSelectionStub();
    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        selection={selApi as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );
    const canvas = container.querySelector('canvas')!;

    act(() => {
      pd(canvas, 50, 50, { altKey: true });
      pu(canvas, 50, 50, { altKey: true });
    });

    // Top-most hit (last in renderOrder) is selected; alt is ignored by default.
    expect(selApi.current).toEqual([idB]);
  });
});
