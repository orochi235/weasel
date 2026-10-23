/**
 * Per-tool integration smoke tests for `<SceneCanvas>`: each mounts a minimal
 * scene with the tool under test active, fires pointer events, and asserts the
 * scene-side effect, so a silently broken dispatch path fails here.
 *
 * Under jsdom `getBoundingClientRect()` returns all-zeros, so clientX == worldX
 * at scale=1, view.x=0.
 */

import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas, BUILTIN_TOOL_IDS } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { Scene, NodeId } from 'core/scene/types';
import type { ActionDisabledReason } from '@weasel-js/routing';
import { defaultNodeRouting } from './SceneCanvas/defaultNodeRouting';
import type { NodeRoutingEntry } from '../core/scene/NodeRouting';

type D = { kind: string; path?: unknown; fill?: string };
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

/** One rect node at {x:100, y:100, width:80, height:60}. */
function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  s.batch('seed', () => {
    s.add({
      kind: 'mark',
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

describe('useSelectTool smoke', () => {
  it('move: drag on selected body translates node via scene.applyBatch("Move")', () => {
    const scene = makeScene();
    const id = firstId(scene);

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        selectionOptions={{ initial: [id] }}
        actions={{ move: FORCE_ENABLED }}
      />,
    );

    const canvas = getCanvas(container);
    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      // Body center at (140, 130) — well inside the node at {x:100,y:100,w:80,h:60}.
      // Drag right+down 30px.
      drag(canvas, 140, 130, 170, 160);
    });

    const moveCalls = batchSpy.mock.calls.filter(([, label]) => label === 'Move');
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
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        // Override areaSelect with a spy so we can detect it fired.
        actions={{
          areaSelect: {
            id: 'areaSelect',
            label: 'Area Select',
            defaultBinding: { kind: 'drag' },
            enabled: () => true as const,
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
      toggle: (nid: NodeId) => {
        if (selectionState.includes(nid)) {
          selectionState = selectionState.filter(i => i !== nid);
        } else {
          selectionState.push(nid);
        }
      },
      clear: () => { selectionState = []; },
      contains: (nid: NodeId) => selectionState.includes(nid),
      applyClick: (_id: NodeId, _mods: unknown) => {},
      adapterMethods: {
        getSelection: () => [...selectionState],
        setSelection: (ids: NodeId[]) => { selectionState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas features={['draw']}
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
      toggle: (nid: NodeId) => {
        if (selectionState.includes(nid)) {
          selectionState = selectionState.filter(i => i !== nid);
        } else {
          selectionState.push(nid);
        }
      },
      clear: () => { selectionState = []; },
      contains: (nid: NodeId) => selectionState.includes(nid),
      applyClick: (_id: NodeId, _mods: unknown) => {},
      adapterMethods: {
        getSelection: () => [...selectionState],
        setSelection: (ids: NodeId[]) => { selectionState = ids; },
      },
    };

    const { container } = render(
      <SceneCanvas features={['draw']}
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

// Alt-drag clones through the select tool's own binding; there is no clone tool.
describe('clone smoke (alt-drag via select tool)', () => {
  it('alt-drag on selected body fires cloneAction → scene.applyBatch("Clone")', () => {
    const scene = makeScene();
    const id = firstId(scene);
    const countBefore = nodeCount(scene);

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']} defaultTools={BUILTIN_TOOL_IDS}
        selectionOptions={{ initial: [id] }}
        actions={{
          // clone requires 'selection' + 'scene' deps — both wired in SceneCanvas.
          // Force-enable so the dispatcher doesn't gate on the static placeholder.
          clone: { enabled: () => true as const },
        }}
      />,
    );

    const canvas = getCanvas(container);
    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      drag(canvas, 140, 130, 170, 160, { altKey: true });
    });

    const cloneCalls = batchSpy.mock.calls.filter(([, label]) => label === 'Clone');
    expect(cloneCalls.length).toBeGreaterThanOrEqual(1);
    expect(nodeCount(scene)).toBe(countBefore + 1);

    batchSpy.mockRestore();
  });

  // Illustrator behavior: alt-drag on a node clones it whether or not it was
  // pre-selected.
  it('alt-drag on UNSELECTED body fires cloneAction → scene.applyBatch("Clone")', () => {
    const scene = makeScene();
    const countBefore = nodeCount(scene);

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']} defaultTools={BUILTIN_TOOL_IDS}
        // No initial selection — the alt-drag must select-and-clone in one go.
        actions={{
          clone: { enabled: () => true as const },
        }}
      />,
    );

    const canvas = getCanvas(container);
    const batchSpy = vi.spyOn(scene, 'applyBatch');

    act(() => {
      drag(canvas, 140, 130, 170, 160, { altKey: true });
    });

    const cloneCalls = batchSpy.mock.calls.filter(([, label]) => label === 'Clone');
    expect(cloneCalls.length).toBeGreaterThanOrEqual(1);
    expect(nodeCount(scene)).toBe(countBefore + 1);

    batchSpy.mockRestore();
  });
});

describe('useHandTool smoke', () => {
  it('drag while hand tool active pans the viewport (view changes)', () => {
    const scene = emptyScene();

    // eslint-disable-next-line prefer-const
    let capturedView: Array<{ x: number; y: number }> = [];
    const viewSpy = vi.fn((v: { x: number; y: number; scale: { x: number; y: number } }) => {
      capturedView.push({ x: v.x, y: v.y });
    });

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        viewport={{ inertia: false }}
        defaultTools={['select', 'hand']}
        onViewChange={viewSpy}
        actions={{
          'viewport.dragPan': { enabled: () => true as const },
        }}
      />,
    );

    const canvas = getCanvas(container);

    // Switch to hand tool first (separate act() so state flushes through to
    // the dispatcher context before the drag fires).
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'h', code: 'KeyH',
      }));
    });

    act(() => {
      drag(canvas, 200, 200, 250, 230);
    });

    expect(viewSpy).toHaveBeenCalled();
    expect(capturedView.length).toBeGreaterThan(0);
    const last = capturedView[capturedView.length - 1];
    expect(last.x !== 0 || last.y !== 0).toBe(true);
  });
});

// Each shape-tool test activates the tool via its keybinding, then drags on
// empty space.
describe('useRectTool smoke', () => {
  it('drag-empty inserts a rect node', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'rect']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate rect tool via 'R' keybinding.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'r', code: 'KeyR',
      }));
    });

    act(() => { drag(canvas, 50, 50, 200, 150); });

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
  it('drag-empty inserts an ellipse node', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
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

describe('usePolygonTool smoke', () => {
  it('drag-empty inserts a polygon node', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'polygon']}
      />,
    );

    const canvas = getCanvas(container);

    // Activate polygon tool via 'G' keybinding.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'g', code: 'KeyG',
      }));
    });

    act(() => {
      drag(canvas, 50, 50, 200, 200);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('useStarTool smoke', () => {
  it('drag-empty inserts a star node', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'star']}
        initialActiveTool="star"
      />,
    );

    const canvas = getCanvas(container);

    act(() => {
      drag(canvas, 50, 50, 200, 200);
    });

    expect(nodeCount(scene)).toBe(1);
  });
});

describe('insert geometry uses tool params, not AABB', () => {
  it('line tool: inserted node uses actual drag endpoints (not AABB diagonal)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'line']}
      />,
    );
    const canvas = getCanvas(container);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: '\\', code: 'Backslash' }));
    });
    // Drag from bottom-left to top-right — the AABB diagonal would slope
    // the opposite way.
    act(() => { drag(canvas, 10, 200, 150, 50); });

    expect(nodeCount(scene)).toBe(1);
    const id = firstId(scene);
    const node = scene.get(id) as { data: { path: { commands: Uint8Array; coords: Float32Array } } };
    const coords = node.data.path.coords;
    // linePath emits moveTo(ax, ay) → lineTo(bx, by) = 4 coords.
    expect(coords.length).toBe(4);
    expect(coords[0]).toBeCloseTo(10);
    expect(coords[1]).toBeCloseTo(200);
    expect(coords[2]).toBeCloseTo(150);
    expect(coords[3]).toBeCloseTo(50);
  });

  it('polygon tool: inserted node uses true side count (not the AABB-inscribed-hexagon stub)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'polygon']}
      />,
    );
    const canvas = getCanvas(container);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'g', code: 'KeyG' }));
    });
    // An AABB-inscribed hexagon also has the default 6 sides, so bump sides
    // via ArrowUp mid-gesture.
    act(() => {
      pd(canvas, 50, 50);
      pm(canvas, 200, 200);
      // ArrowUp twice mid-gesture to bump sides 6 → 8.
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
      pu(canvas, 200, 200);
    });

    expect(nodeCount(scene)).toBe(1);
    const id = firstId(scene);
    const node = scene.get(id) as { data: { path: { commands: Uint8Array } } };
    // 8 sides is 9 commands: one M/L per vertex plus a trailing Z.
    expect(node.data.path.commands.length).toBe(9);
  });

  it('pencil tool: inserted node has a smooth path derived from the sample trail (not a stub rect)', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'pencil']}
      />,
    );
    const canvas = getCanvas(container);
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'n', code: 'KeyN' }));
    });
    act(() => {
      pd(canvas, 50, 50);
      pm(canvas, 80, 60);
      pm(canvas, 120, 80);
      pm(canvas, 150, 100);
      pu(canvas, 150, 100);
    });

    expect(nodeCount(scene)).toBe(1);
    const id = firstId(scene);
    const node = scene.get(id) as { data: { path: { kind: string; commands?: Uint8Array } } };
    // Stub rect would be { kind: 'rect', x, y, ... } (no commands array). The
    // real path is a PolygonPath with command stream.
    expect(node.data.path.kind).toBe('polygon');
    expect(node.data.path.commands).toBeDefined();
    expect(node.data.path.commands!.length).toBeGreaterThan(1);
  });
});

describe('useLassoTool smoke', () => {
  it('lasso drag sets selection to enclosed nodes', () => {
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
      toggle: (nid: NodeId) => {
        if (selectionState.includes(nid)) {
          selectionState = selectionState.filter(i => i !== nid);
        } else {
          selectionState.push(nid);
        }
      },
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
        features={['draw']}
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

  /** Triangle lasso over three rects: one inside it, one straddling the
   *  hypotenuse (x + y = 340), and one inside the triangle's bounding box but
   *  wholly past the hypotenuse. */
  function triangleLasso(mode?: 'centers' | 'intersect' | 'enclosed') {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const ids = {} as Record<'inside' | 'straddle' | 'outside', NodeId>;
    scene.batch('seed', () => {
      const add = (x: number, y: number, s: number) => scene.add({
        kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
        pose: { x, y, width: s, height: s } as P,
      });
      ids.inside = add(40, 40, 30);
      ids.straddle = add(140, 140, 40);
      ids.outside = add(250, 250, 40);
    });
    let selected: NodeId[] = [];
    const selection = {
      get current() { return selected; },
      get() { return [...selected]; },
      set: (next: NodeId[]) => { selected = next; },
      clear: () => { selected = []; },
      contains: (nid: NodeId) => selected.includes(nid),
      applyClick: () => {},
    };
    const { container, unmount } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'lasso']}
        initialActiveTool="lasso"
        {...(mode ? { toolOptions: { lasso: { mode } } } : {})}
        selection={selection as unknown as Parameters<typeof SceneCanvas>[0]['selection']}
      />,
    );
    const canvas = getCanvas(container);
    act(() => {
      pd(canvas, 20, 20);
      pm(canvas, 320, 20);
      pm(canvas, 20, 320);
      pu(canvas, 20, 320);
    });
    unmount();
    return { ids, selected: [...selected].sort() };
  }

  it("default 'intersect' tests the lasso polygon, not its bounding box", () => {
    const { ids, selected } = triangleLasso();
    expect(selected).toEqual([ids.inside, ids.straddle].sort());
  });

  it("'enclosed' takes only nodes wholly inside the lasso polygon", () => {
    const { ids, selected } = triangleLasso('enclosed');
    expect(selected).toEqual([ids.inside]);
  });

  it("'centers' takes nodes whose center is inside the lasso polygon", () => {
    // The straddling rect's center (160,160) sits inside the hypotenuse.
    const { ids, selected } = triangleLasso('centers');
    expect(selected).toEqual([ids.inside, ids.straddle].sort());
  });
});

describe('SceneCanvas — routing prop', () => {
  // The routing prop feeds the node-kind classifier `SceneCanvas` builds into
  // `getNodeAtPoint`. These read the kind off the `onDoubleClick` observer,
  // which reports `{ id, kind }` from that same picker.
  function Harness(props: {
    scene: Scene<D, L, P>;
    id: NodeId;
    routing?: readonly NodeRoutingEntry[];
    onKind: (kind: string | undefined) => void;
  }) {
    const { scene, id, routing, onKind } = props;
    return (
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        {...(routing ? { routing } : {})}
        selectionOptions={{ initial: [id] }}
        onDoubleClick={(hit) => onKind(hit?.kind)}
      />
    );
  }

  function doubleClickAt(container: HTMLElement, x: number, y: number) {
    const canvas = getCanvas(container);
    act(() => {
      pd(canvas, x, y);
      pu(canvas, x, y);
      pd(canvas, x, y);
      pu(canvas, x, y);
    });
  }

  it('threads routing into the synthesized adapter so the hit kind resolves to "rect"', () => {
    const scene = makeScene();
    const id = firstId(scene);
    let captured: string | undefined;

    const { container } = render(
      <Harness scene={scene} id={id} routing={defaultNodeRouting} onKind={(k) => { captured = k; }} />,
    );
    doubleClickAt(container, 140, 130);
    expect(captured).toBe('rect');
  });

  it('produces kind = "unknown" when the routing prop is omitted', () => {
    const scene = makeScene();
    const id = firstId(scene);
    let captured: string | undefined;

    const { container } = render(
      <Harness scene={scene} id={id} onKind={(k) => { captured = k; }} />,
    );
    doubleClickAt(container, 140, 130);
    expect(captured).toBe('unknown');
  });
});

describe('SceneCanvas onDoubleClick', () => {
  // The prop rides the dispatcher's synthesized double click, not a native
  // `dblclick` listener, so these tests fire two real clicks.
  it('fires with the hit node on two quick clicks on a body', () => {
    const scene = makeScene();
    const id = firstId(scene);
    const onDoubleClick = vi.fn();

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        onDoubleClick={onDoubleClick}
      />,
    );

    const canvas = getCanvas(container);
    act(() => {
      click(canvas, 140, 130);
      click(canvas, 140, 130);
    });

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick.mock.calls[0][0]).toMatchObject({ id });
  });

  it('fires with null when the double click lands on empty canvas', () => {
    const scene = makeScene();
    const onDoubleClick = vi.fn();

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        onDoubleClick={onDoubleClick}
      />,
    );

    const canvas = getCanvas(container);
    act(() => {
      click(canvas, 350, 350);
      click(canvas, 350, 350);
    });

    expect(onDoubleClick).toHaveBeenCalledTimes(1);
    expect(onDoubleClick.mock.calls[0][0]).toBeNull();
  });

  it('does not fire on a single click', () => {
    const scene = makeScene();
    const onDoubleClick = vi.fn();

    const { container } = render(
      <SceneCanvas features={['draw']}
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        onDoubleClick={onDoubleClick}
      />,
    );

    act(() => { click(getCanvas(container), 140, 130); });
    expect(onDoubleClick).not.toHaveBeenCalled();
  });
});

describe('keydown fan-out: polygon ArrowUp vs nudge', () => {
  // With the polygon tool active and a non-empty selection, ArrowUp matches
  // both the tool's side-count binding and `nudge.up`.
  it('ArrowUp with polygon active does not also nudge the selection', () => {
    const scene = makeScene();
    const id = firstId(scene);
    const before = { ...(scene.get(id)?.pose as P) };

    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'polygon']}
        selectionOptions={{ initial: [id] }}
      />,
    );
    void container;

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'g', code: 'KeyG',
      }));
    });
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
    });

    const after = scene.get(id)?.pose as P;
    expect(after.y).toBe(before.y);
  });
  // The other half: ArrowUp must still DO its job. A tool hook that registers
  // `polygon.adjustSides` with `useAction` runs above the ActionsProvider and
  // silently no-ops, leaving the binding pointing at an unregistered id.
  it('ArrowUp with polygon active changes the committed side count', () => {
    const scene = emptyScene();
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={400}
        height={400}
        features={['draw']}
        defaultTools={['select', 'polygon']}
      />,
    );
    const canvas = getCanvas(container);

    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', {
        bubbles: true, key: 'g', code: 'KeyG',
      }));
    });
    // Default is 6 sides; two ArrowUps → 8.
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
      document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'ArrowUp' }));
    });
    act(() => { drag(canvas, 60, 60, 160, 160); });

    const id = firstId(scene);
    const path = (scene.get(id)?.data as D)?.path as { coords?: number[] } | undefined;
    expect(path).toBeDefined();
    // regularPolygonPath emits one coord pair per side.
    expect((path!.coords?.length ?? 0) / 2).toBe(8);
  });
});

