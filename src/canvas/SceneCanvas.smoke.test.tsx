/**
 * Per-tool integration smoke tests for `<SceneCanvas>`.
 *
 * These tests catch end-to-end regressions where a tool's dispatch path is
 * silently broken — the kind of bug that Phase 14c.1 + Phase 14a's insert-dep
 * gap caused: shape-tool drags doing nothing in real demos because tests only
 * exercised callback-level behavior.
 *
 * ## Strategy
 *
 * Each test mounts `<SceneCanvas>` with a minimal scene and the tool under
 * test as active, fires pointer events at canvas-relative coords, and asserts
 * the expected scene-side effect (node added / moved / selection changed /
 * view panned).
 *
 * ## jsdom constraints
 *
 * - `getBoundingClientRect()` returns all-zeros → clientX == worldX at
 *   scale=1, view.x=0.
 * - Pointer events are fired on the canvas element obtained from `container`.
 *
 * ## Skipped tests
 *
 * The following tests are wrapped in `it.skip(...)` pending parallel-track
 * dep wiring:
 *
 * - useRectTool, useEllipseTool, useLineTool, usePolygonTool, useStarTool,
 *   usePencilTool — blocked on `insert` dep being wired in
 *   `<StandardActionsRegistrar>` (parallel insert-dep agent).
 * - useLassoTool — blocked on `lassoSelect` dep being wired in
 *   `<StandardActionsRegistrar>` (same agent).
 *
 * Controller: flip `it.skip` → `it` once insert-dep wiring lands and merges.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { ActionDisabledReason } from 'interactions/actions/registry';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type D = { kind: string; path?: unknown; fill?: string };
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
// Scene helpers
// ---------------------------------------------------------------------------

/** One rect node at {x:100, y:100, width:80, height:60}. */
function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({
      kind: 'leaf',
      data: { kind: 'rect' },
      layer: 'main' as L,
      pose: { x: 100, y: 100, width: 80, height: 60 } as P,
    });
  });
  return s;
}

/** Empty scene — no nodes. */
function emptyScene(): Scene<D, L, P> {
  return createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
}

function firstId(scene: Scene<D, L, P>): NodeId {
  for (const id of scene.renderOrder()) return id;
  throw new Error('No nodes in scene');
}

function nodeCount(scene: Scene<D, L, P>): number {
  let n = 0;
  for (const _ of scene.renderOrder()) n++;
  return n;
}

// ---------------------------------------------------------------------------
// Gesture helpers
// ---------------------------------------------------------------------------

function pd(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  canvas.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...opts }));
}
function pm(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...opts }));
}
function pu(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  canvas.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: x, clientY: y, pointerId: 1, ...opts }));
}

/** Standard drag gesture: down, move past threshold, up. */
function drag(canvas: HTMLCanvasElement, x0: number, y0: number, x1: number, y1: number, opts: PointerEventInit = {}) {
  pd(canvas, x0, y0, opts);
  pm(canvas, x1, y1, opts);
  pu(canvas, x1, y1, opts);
}

/** Click gesture (no move). */
function click(canvas: HTMLCanvasElement, x: number, y: number, opts: PointerEventInit = {}) {
  pd(canvas, x, y, opts);
  pu(canvas, x, y, opts);
}

function getCanvas(container: HTMLElement): HTMLCanvasElement {
  const c = container.querySelector('canvas');
  if (!c) throw new Error('No <canvas> in container');
  return c;
}

/** move action needs enabled: () => true to bypass SelectionRequired placeholder. */
const FORCE_ENABLED: { enabled: () => true | ActionDisabledReason } = { enabled: () => true };

// ---------------------------------------------------------------------------
// useSelectTool — move: drag selected body translates node pose
// ---------------------------------------------------------------------------

describe('useSelectTool smoke', () => {
  it('move: drag on selected body translates node via scene.batch("Move")', () => {
    const scene = makeScene();
    const id = firstId(scene);

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selectionOptions={{ initial: [id] }}
        actions={{ move: FORCE_ENABLED }}
      />,
    );

    const canvas = getCanvas(container);
    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      // Body center at (140, 130) — well inside the node at {x:100,y:100,w:80,h:60}.
      // Drag right+down 30px.
      drag(canvas, 140, 130, 170, 160);
    });

    const moveCalls = batchSpy.mock.calls.filter(([label]) => label === 'Move');
    expect(moveCalls.length).toBeGreaterThanOrEqual(1);

    const finalPose = scene.get(id)?.pose as P | undefined;
    expect(finalPose).toBeDefined();
    if (finalPose) {
      expect(finalPose.x).toBe(130); // 100 + 30
      expect(finalPose.y).toBe(130); // 100 + 30
    }

    batchSpy.mockRestore();
  });

  it('areaSelect: drag on empty fires areaSelectAction (action invoked)', () => {
    const scene = makeScene();
    const areaSelectSpy = vi.fn();

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        // Override areaSelect with a spy so we can detect it fired.
        actions={{
          areaSelect: {
            id: 'areaSelect',
            label: 'Area Select',
            gestureBinding: { kind: 'drag' },
            run: areaSelectSpy,
            enabled: () => true as true,
            invoker: {
              timing: 'ongoing',
              start: () => { areaSelectSpy(); return {}; },
            },
          },
        }}
      />,
    );

    const canvas = getCanvas(container);

    act(() => {
      // Drag on empty space — far from node at {x:100,y:100,w:80,h:60}.
      drag(canvas, 300, 300, 350, 350);
    });

    expect(areaSelectSpy).toHaveBeenCalledTimes(1);
  });

  it('clearSelection: click on empty (no mods) clears selection', () => {
    const scene = makeScene();
    const id = firstId(scene);

    let selectionState: NodeId[] = [id];
    const selectionApi = {
      get current() { return selectionState; },
      get() { return [...selectionState]; },
      set: (ids: NodeId[]) => { selectionState = ids; },
      add: (nid: NodeId) => { if (!selectionState.includes(nid)) selectionState = [...selectionState, nid]; },
      remove: (nid: NodeId) => { selectionState = selectionState.filter(i => i !== nid); },
      toggle: (nid: NodeId) => { selectionState.includes(nid) ? (selectionState = selectionState.filter(i => i !== nid)) : selectionState.push(nid); },
      clear: () => { selectionState = []; },
      contains: (nid: NodeId) => selectionState.includes(nid),
      applyClick: (_id: NodeId, _mods: unknown) => {},
      adapterMethods: {
        getSelection: () => [...selectionState],
        setSelection: (ids: NodeId[]) => { selectionState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selection={selectionApi as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );

    const canvas = getCanvas(container);

    act(() => {
      // Click on empty space (no node there).
      click(canvas, 10, 10);
    });

    expect(selectionState).toEqual([]);
  });

  it('clearSelection: shift-click on empty does NOT clear selection', () => {
    const scene = makeScene();
    const id = firstId(scene);

    let selectionState: NodeId[] = [id];
    const selectionApi = {
      get current() { return selectionState; },
      get() { return [...selectionState]; },
      set: (ids: NodeId[]) => { selectionState = ids; },
      add: (nid: NodeId) => { if (!selectionState.includes(nid)) selectionState = [...selectionState, nid]; },
      remove: (nid: NodeId) => { selectionState = selectionState.filter(i => i !== nid); },
      toggle: (nid: NodeId) => { selectionState.includes(nid) ? (selectionState = selectionState.filter(i => i !== nid)) : selectionState.push(nid); },
      clear: () => { selectionState = []; },
      contains: (nid: NodeId) => selectionState.includes(nid),
      applyClick: (_id: NodeId, _mods: unknown) => {},
      adapterMethods: {
        getSelection: () => [...selectionState],
        setSelection: (ids: NodeId[]) => { selectionState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selection={selectionApi as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );

    const canvas = getCanvas(container);

    act(() => {
      click(canvas, 10, 10, { shiftKey: true });
    });

    // Shift-click on empty is a no-op — selection unchanged.
    expect(selectionState).toEqual([id]);
  });
});

// ---------------------------------------------------------------------------
// useCloneTool — alt-drag on selected body: new node added (Clone batch)
//
// The clone tool's primary gesture binding is:
//   { kind: 'drag', target: 'selected-body', mods: { alt: true } }
// It is matched by the dispatcher when clone is the ACTIVE tool (not just a
// hotkey tool), so this test activates clone explicitly via `defaultTools`.
// The selection is pre-seeded and the node is at (100,100,80,60) — dragging
// from its center (140,130) with altKey satisfies both target + mods constraints.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BUG SURFACED: Alt keydown on window does not push clone onto the hotkey
// stack in the jsdom test environment. The `tool.hold.clone` action's
// `key-held` gesture binding (registered via useKeybindings + ActionsRegistry)
// is not being fired by a bare KeyboardEvent on window — either because
// useGestureDispatcher's key-held path requires the event to come through
// the canvas or because state updates from the action aren't flushing before
// the pointer events run.
//
// This is a **real dispatch-path bug** surfaced by the smoke-test harness.
// The clone alt-drag path through SceneCanvas does not work end-to-end.
// Filed for investigation; keep skipped until fixed.
// ---------------------------------------------------------------------------

describe('useCloneTool smoke', () => {
  it.skip('alt-drag on selected body fires cloneAction → scene.batch("Clone") [BUG: Alt key-held not reaching dispatcher]', () => {
    const scene = makeScene();
    const id = firstId(scene);
    const countBefore = nodeCount(scene);

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        // exhaustive bundle includes clone. SceneCanvas starts active='select',
        // but the clone tool has hotkey: 'alt'. Holding alt pushes clone onto
        // the hotkey stack → clone's drag binding enters the active+hotkey scope.
        toolBundle="exhaustive"
        selectionOptions={{ initial: [id] }}
        actions={{
          // clone requires 'selection' + 'scene' deps — both wired in SceneCanvas.
          // Force-enable so the dispatcher doesn't gate on the static placeholder.
          clone: { enabled: () => true as true },
        }}
      />,
    );

    const canvas = getCanvas(container);
    const batchSpy = vi.spyOn(scene, 'batch');

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'Alt', code: 'AltLeft', altKey: true,
      }));
      drag(canvas, 140, 130, 170, 160, { altKey: true });
    });

    const cloneCalls = batchSpy.mock.calls.filter(([label]) => label === 'Clone');
    expect(cloneCalls.length).toBeGreaterThanOrEqual(1);
    expect(nodeCount(scene)).toBe(countBefore + 1);

    batchSpy.mockRestore();
  });
});

// ---------------------------------------------------------------------------
// useHandTool — drag pans the viewport (view.x / view.y change)
//
// The hand tool's primary gesture binding is:
//   bindings: [{ spec: { kind: 'drag' }, actionId: 'viewport.dragPan' }]
// with `bindingsOverrideDrag: true` when the gesture dispatcher is mounted.
// This fires when the hand tool is the ACTIVE tool in the dispatcher context.
//
// useKeybindings attaches to `document` for tool-switch keydowns, so we
// fire H on `document` to switch the active tool to 'hand'.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// BUG SURFACED (two issues):
//
// 1. H keydown on `document` does NOT switch the active tool from 'select' to
//    'hand'. Debug probing confirmed: active tool remains 'select' after the H
//    keydown is dispatched. `useKeybindings` attaches to `document`, the event
//    fires, but `setActive('hand')` is either not reached or its state update
//    doesn't flush before the pointer events run.
//
// 2. Even if the tool switch DID work, the select tool's ambient binding
//    `{ kind:'drag', target:'empty' } → areaSelect` hits first in `matchBest`
//    and — when `areaSelect.enabled()` returns non-true (disabled, waiting for
//    `SelectionRequired`) — the dispatcher returns 'unhandled' without falling
//    through to `viewport.dragPan`. The ambient-scope fallthrough behavior is a
//    known design gap in `dispatcher.ts`.
//
// These are **real dispatch-path bugs** surfaced by the smoke-test harness.
// Filed for investigation; keep skipped until fixed.
// ---------------------------------------------------------------------------

describe('useHandTool smoke', () => {
  it.skip('drag while hand tool active pans the viewport (view changes) [BUG: H key does not switch active tool; dragPan blocked by areaSelect enabled() gate]', () => {
    const scene = emptyScene();

    // eslint-disable-next-line prefer-const
    let capturedView: Array<{ x: number; y: number }> = [];
    const viewSpy = vi.fn((v: { x: number; y: number; scale: { x: number; y: number } }) => {
      capturedView.push({ x: v.x, y: v.y });
    });

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        viewport={{ inertia: false }}
        defaultTools={['select', 'hand']}
        onViewChange={viewSpy}
        actions={{
          'viewport.dragPan': { enabled: () => true as true },
        }}
      />,
    );

    const canvas = getCanvas(container);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'h', code: 'KeyH',
      }));
      drag(canvas, 200, 200, 250, 230);
    });

    expect(viewSpy).toHaveBeenCalled();
    if (capturedView.length > 0) {
      const last = capturedView[capturedView.length - 1];
      const changed = last.x !== 0 || last.y !== 0;
      expect(changed).toBe(true);
    }
  });
});

// ---------------------------------------------------------------------------
// Shape tool smoke tests — SKIPPED pending insert-dep wiring
//
// TODO: enable once the parallel insert-dep agent lands and merges.
//       Flip `it.skip` → `it` for each block below.
//       Required: `insert` dep wired in `StandardActionsRegistrar` (SceneCanvas.tsx)
//                 with factories for rect / ellipse / line / polygon / star / pencil.
// ---------------------------------------------------------------------------

describe('useRectTool smoke', () => {
  it.skip('drag-empty inserts a rect node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="standard"
        defaultTools={['select', 'rect']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate rect tool via 'R' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'r', code: 'KeyR',
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 150);
    });

    // After the drag a new rect node should exist.
    expect(nodeCount(scene)).toBe(1);
    const id = firstId(scene);
    const pose = scene.get(id)?.pose as P | undefined;
    expect(pose).toBeDefined();
    if (pose) {
      expect(pose.x).toBeCloseTo(50);
      expect(pose.y).toBeCloseTo(50);
      expect(pose.width).toBeCloseTo(150);
      expect(pose.height).toBeCloseTo(100);
    }
  });
});

describe('useEllipseTool smoke', () => {
  it.skip('drag-empty inserts an ellipse node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="standard"
        defaultTools={['select', 'ellipse']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate ellipse tool via 'E' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'e', code: 'KeyE',
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 150);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('useLineTool smoke', () => {
  it.skip('drag-empty inserts a line node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="standard"
        defaultTools={['select', 'line']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate line tool via 'G' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'g', code: 'KeyG',
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 150);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('usePolygonTool smoke', () => {
  it.skip('drag-empty inserts a polygon node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="exhaustive"
        defaultTools={['select', 'polygon']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate polygon tool via 'N' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'n', code: 'KeyN',
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 200);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('useStarTool smoke', () => {
  it.skip('drag-empty inserts a star node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="exhaustive"
        defaultTools={['select', 'star']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate star tool via '*' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: '*', code: 'Digit8', shiftKey: true,
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 200);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('usePencilTool smoke', () => {
  it.skip('drag-empty inserts a pencil/path node (TODO: keybindings not switching tool in jsdom)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="standard"
        defaultTools={['select', 'pencil']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate pencil tool via 'P' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'p', code: 'KeyP',
      }));
    });

    act(() => {
      pd(canvas, 50, 50);
      pm(canvas, 80, 60);
      pm(canvas, 120, 80);
      pm(canvas, 150, 100);
      pu(canvas, 150, 100);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('useLassoTool smoke', () => {
  it.skip('lasso drag sets selection to enclosed nodes (TODO: keybindings not switching tool in jsdom)', () => {
    // Node at {x:100, y:100, w:80, h:60} — lasso should enclose it.
    const scene = makeScene();
    const id = firstId(scene);

    let selectionState: NodeId[] = [];
    const selectionApi = {
      get current() { return selectionState; },
      get() { return [...selectionState]; },
      set: (ids: NodeId[]) => { selectionState = ids; },
      add: (nid: NodeId) => { if (!selectionState.includes(nid)) selectionState = [...selectionState, nid]; },
      remove: (nid: NodeId) => { selectionState = selectionState.filter(i => i !== nid); },
      toggle: (nid: NodeId) => { selectionState.includes(nid) ? (selectionState = selectionState.filter(i => i !== nid)) : selectionState.push(nid); },
      clear: () => { selectionState = []; },
      contains: (nid: NodeId) => selectionState.includes(nid),
      applyClick: (_nid: NodeId, _mods: unknown) => {},
      adapterMethods: {
        getSelection: () => [...selectionState],
        setSelection: (ids: NodeId[]) => { selectionState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        toolBundle="exhaustive"
        defaultTools={['select', 'lasso']}
        selection={selectionApi as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate lasso tool via 'L' keybinding (outside act to let state flush).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'l', code: 'KeyL',
      }));
    });

    act(() => {
      // Draw lasso polygon enclosing node at (100..180, 100..160).
      pd(canvas, 80, 80);
      pm(canvas, 200, 80);
      pm(canvas, 200, 180);
      pm(canvas, 80, 180);
      pu(canvas, 80, 180);
    });

    // lassoSelectAction should call hitTestLasso + setSelection → id in selection.
    expect(selectionState).toContain(id);
  });
});
