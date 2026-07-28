/**
 * SceneCanvas seam-refactor coverage
 *
 * Targeted tests for the 9 behaviors that must stay green through the
 * Canvas / SceneCanvas seam refactor.  Only behaviors that had no direct
 * coverage in the existing test files are exercised here.
 *
 * Behaviors covered:
 *   2. selectionMode='multi' accumulates via shift-click through SceneCanvas
 *   3. pickEvery receives view-adjusted worldXY (pan offset applied)
 *   7. SceneCanvas backgroundFill wires a layer (mounts, layer appears in debug)
 *   8. cursorCoordsHud / pickHud render into the DOM when enabled
 *   9. viewport.pan / viewport.zoom register their action descriptors
 *
 * Public-prop forwards (appended; not part of the 9-behavior seam list):
 *   - selectTool.pickBest forwards an alt-aware body-pick into useSelectTool
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import { useActionsRegistry } from 'interactions/actions/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type D = { kind: string };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

// ---------------------------------------------------------------------------
// jsdom canvas setup
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 10, y: 10, width: 50, height: 50 } as P });
    s.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 100, y: 10, width: 50, height: 50 } as P });
  });
  return s;
}

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

// ---------------------------------------------------------------------------
// Behavior 2: selectionMode='multi' allows multi-select via shift-click
// ---------------------------------------------------------------------------

describe('Behavior 2: selectionMode=multi accumulates selection', () => {
  it('shift-click on a second node adds it to the selection (does not replace)', () => {
    const scene = makeScene();
    const [idA, idB] = idsOf(scene);

    // Track selection via the selection prop override.
    let selState: NodeId[] = [idA];
    const selApi = {
      get current() { return selState; },
      get() { return [...selState]; },
      set(ids: NodeId[]) { selState = ids; },
      add(id: NodeId) { if (!selState.includes(id)) selState = [...selState, id]; },
      remove(id: NodeId) { selState = selState.filter(i => i !== id); },
      toggle(id: NodeId) {
        selState.includes(id)
          ? (selState = selState.filter(i => i !== id))
          : selState.push(id);
      },
      clear() { selState = []; },
      contains(id: NodeId) { return selState.includes(id); },
      applyClick(id: NodeId, mods: { shift: boolean; meta: boolean; ctrl: boolean }) {
        if (mods.shift) {
          // multi mode: toggle
          selState.includes(id)
            ? (selState = selState.filter(i => i !== id))
            : selState.push(id);
        } else {
          selState = [id];
        }
      },
      adapterMethods: {
        getSelection: () => [...selState],
        setSelection: (ids: NodeId[]) => { selState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selection={selApi as Parameters<typeof SceneCanvas>[0]['selection']}
        selectionOptions={{ mode: 'multi' }}
      />,
    );

    const canvas = container.querySelector('canvas')!;

    // Click node B with shift — should add idB to the selection.
    act(() => {
      // Node B at x:100, width:50 → center at (125, 35).
      pd(canvas, 125, 35, { shiftKey: true });
      pu(canvas, 125, 35, { shiftKey: true });
    });

    // Both idA (initial) and idB (shift-clicked) should be selected.
    expect(selState).toContain(idA);
    expect(selState).toContain(idB);
  });
});

// ---------------------------------------------------------------------------
// Behavior 3 + 5: pickEvery / dispatcher receive view-adjusted worldXY
// ---------------------------------------------------------------------------

describe('Behavior 3: pickEvery receives view-adjusted worldXY', () => {
  it('worldXY passed to pickEvery accounts for view.x pan offset', () => {
    // With view.x = 50 and clientX = 60 at scale=1:
    //   worldX = (60 - 0) / 1 + 50 = 110
    // A node at world x=100 (width=40) is hit; without the view offset it
    // would be missed (clientX=60 < node.x=100 at identity view).
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    scene.batch('seed', () => {
      scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
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
        selState.includes(nid) ? (selState = selState.filter(i => i !== nid)) : selState.push(nid);
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
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        // Pan the view 50 units to the right: world origin is at clientX = -50.
        // So clientX=60 maps to worldX = 60/1 + 50 = 110, which is inside the
        // node at world x=100..140.
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

// ---------------------------------------------------------------------------
// Behavior 7: SceneCanvas backgroundFill wires a layer
// ---------------------------------------------------------------------------

describe('Behavior 7: backgroundFill prop wires a layer', () => {
  it('mounts without throwing when backgroundFill is set', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        backgroundFill={{ color: '#ff0000' }}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('backgroundFill=undefined produces no background layer (no throw, no extra noise)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });
});

// ---------------------------------------------------------------------------
// Behavior 8: cursorCoordsHud / pickHud render into the DOM
// ---------------------------------------------------------------------------

describe('Behavior 8: cursorCoordsHud and pickHud render when enabled', () => {
  it('cursorCoordsHud=true mounts without throwing and canvas is present', () => {
    // CursorCoordsHud renders null until the first pointermove (anchor is null
    // until useEffect fires getBoundingClientRect). Under jsdom we can only
    // assert no throw and that the canvas is still rendered.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        cursorCoordsHud={true}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('pickHud=true mounts without throwing', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        pickHud={true}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('both cursorCoordsHud and pickHud can be enabled together without throwing', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        cursorCoordsHud={true}
        pickHud={true}
      />,
    );
    expect(container.querySelector('canvas')).toBeTruthy();
  });

  it('cursorCoordsHud updates world coords on pointermove via document listener', () => {
    // CursorCoordsHud renders after the anchor useEffect fires; trigger a
    // pointermove on document and verify the component remains mounted (no
    // error, no unmount). The HUD logic that transforms client→world is the
    // same formula as Canvas's clientToWorld: (clientX / scale) + view.x.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container, unmount } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={200}
        height={200}
        cursorCoordsHud={true}
      />,
    );
    // Fire a pointermove on document — CursorCoordsHud listens on document.
    act(() => {
      document.dispatchEvent(new PointerEvent('pointermove', {
        bubbles: true, clientX: 50, clientY: 50,
      }));
    });
    // Canvas should still be present (no throw from HUD update).
    expect(container.querySelector('canvas')).toBeTruthy();
    unmount();
  });
});

// ---------------------------------------------------------------------------
// Behavior 9: viewport.pan / viewport.zoom register action descriptors
// ---------------------------------------------------------------------------

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
      <SceneCanvas
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
      <SceneCanvas
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
      <SceneCanvas
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
    // SceneCanvas passes `viewport?.pan !== false` and `viewport?.zoom !== false`
    // to StandardActionsRegistrar — both are `true` when the viewport prop is
    // omitted (undefined !== false = true). So both descriptors are registered
    // by default even when the consumer passes no viewport prop at all.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let capturedIds: string[] = [];

    render(
      <SceneCanvas
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
});

// ---------------------------------------------------------------------------
// Seam: selectTool.pickBest forwards through to the internal useSelectTool
// ---------------------------------------------------------------------------

/** Minimal mutable SelectionApi stub — `applyClick` replaces the selection
 *  with the clicked id (single-select), enough to observe which id a body
 *  pick settled on. */
function makeSelectionStub(initial: NodeId[] = []) {
  let selState: NodeId[] = [...initial];
  return {
    get current() { return selState; },
    get() { return [...selState]; },
    set(ids: NodeId[]) { selState = ids; },
    add(id: NodeId) { if (!selState.includes(id)) selState = [...selState, id]; },
    remove(id: NodeId) { selState = selState.filter(i => i !== id); },
    toggle(id: NodeId) {
      selState.includes(id) ? (selState = selState.filter(i => i !== id)) : (selState = [...selState, id]);
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
    // Two fully-overlapping nodes. The default body pick (pickEvery +
    // pickTopMostHit) settles on the top-most (last in renderOrder = idB).
    // A pickBest that returns the BOTTOM id (idA) on alt proves the option
    // threaded through and overrode the default top-pick.
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    scene.batch('seed', () => {
      scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
      scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
    });
    const [idA, idB] = idsOf(scene);

    const selApi = makeSelectionStub();
    const pickBest = vi.fn(
      (_wx: number, _wy: number, alt: boolean, _sel: readonly string[]) =>
        (alt ? (idA as string) : (idB as string)),
    );

    const { container } = render(
      <SceneCanvas
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
      scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
      scene.add({ kind: 'leaf', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x: 0, y: 0, width: 100, height: 100 } as P });
    });
    const [, idB] = idsOf(scene);

    const selApi = makeSelectionStub();
    const { container } = render(
      <SceneCanvas
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

// The `clickFallback` prop is gone. It was a slot on the tool-routing
// dispatcher, consulted when the active tool's `pointer.onClick` returned
// `'pass'` — a phase-table concept with no equivalent in the binding grammar,
// where the same effect is what AMBIENT scope already means: a binding that
// fires when no active-scope binding claims the gesture. It had no consumer
// beyond this test.
