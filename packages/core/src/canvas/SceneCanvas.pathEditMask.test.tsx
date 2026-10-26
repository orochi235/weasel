/**
 * A path is being anchor-edited only while its node exists, is selected, and
 * the mode permits it. Everything on `<SceneCanvas>` that asks — the
 * `editAnchors` dep, the anchor overlay, the selection overlay, the rule
 * context, and the select tool's shift-click lock — gets the one answer, also
 * when the target stops qualifying without `exitPathEdit` having run.
 */
import { describe, it, expect, vi, beforeAll, afterEach } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { pathInWorld, polygonFromPoints, type Path } from '@weasel-js/geom';
import { createModeRegistry, DEFAULT_MODES } from '@weasel-js/modes';
import { useActionsRegistry, useDepRegistry } from '@weasel-js/routing/react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type NodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import { editingAnchors } from 'domains/chrome-caps';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewInputs, type SurfaceViewInputs } from './viewInputs';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';

type P = { x: number; y: number; width: number; height: number };
type D = { path: Path; fill: string };

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

const A = asNodeId('a');
const B = asNodeId('b');
const C = asNodeId('c');
const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 400, dpr: 1 };
/** A consumer chrome id visible exactly while the rule context says a path is being edited. */
const PROBE = 'probe.editing';

const square = (): Path =>
  polygonFromPoints([{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }, { x: 0, y: 40 }]);

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function setup(props: Record<string, unknown> = {}) {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const at: Record<string, [number, number]> = { a: [100, 100], b: [200, 100], c: [100, 200] };
  for (const id of [A, B, C]) {
    const [x, y] = at[id];
    scene.add({ id, kind: 'mark', layer: 'main', pose: { x, y, width: 40, height: 40 }, data: { path: square(), fill: '#000' } });
  }
  scene.setSelection([A]);
  const grabbed = {} as {
    actions: { trigger(id: string): boolean };
    deps: { get(key: string): unknown };
    views: ViewRegistry;
    inputs: SurfaceViewInputs;
  };
  function Grab() {
    grabbed.actions = useActionsRegistry() as typeof grabbed.actions;
    grabbed.deps = useDepRegistry() as typeof grabbed.deps;
    grabbed.views = useOptionalViewRegistry()!;
    grabbed.inputs = useOptionalViewInputs()!;
    return null;
  }
  const { container } = render(
    <SceneCanvas
      features={['draw']} scene={scene} width={DIMS.width} height={DIMS.height}
      chromeVisibility={{ [PROBE]: editingAnchors }}
      {...props}
    >
      <Grab />
    </SceneCanvas>,
  );
  const canvas = container.querySelector('canvas')!;
  const layer = (id: string): RenderLayer<unknown> =>
    grabbed.views.surface()!.layers().find((l) => l.id === id)!;
  const isVisible = () => grabbed.inputs.chromeCaps!.isVisible({
    selection: scene.getSelection() as readonly NodeId[], view: VIEW, action: { kind: null, id: null },
  });
  const pointer = (type: string, x: number, y: number, init: PointerEventInit = {}) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, ...init }));
  return {
    enter: () => act(() => { grabbed.actions.trigger('enterPathEdit'); }),
    select: (ids: NodeId[]) => act(() => { scene.setSelection(ids); }),
    remove: (id: NodeId) => act(() => { scene.remove(id); }),
    /** What hit-testing reads: `anchorStateFrom` takes its id from this dep. */
    depEditingId: () => (grabbed.deps.get('editAnchors') as { editingId: string }).editingId,
    dep: () => grabbed.deps.get('editAnchors') as {
      setEditingId(id: string | null): void;
      setSelectedAnchors(next: Iterable<number>): void;
      setMarquee(rect: { x: number; y: number; width: number; height: number } | null): void;
    },
    overlayLayer: () => layer('path-editing-overlay'),
    /** Draw commands the overlay paints in view zero, under the canvas's own chrome-caps gate: the outline, then a square per anchor. */
    overlayCommands: () => layer('path-editing-overlay').draw({ getIsVisible: isVisible }, VIEW, DIMS).length,
    /**
     * A proxy: whether the selection overlay would skip `id`. The envelope
     * claims `id` is selected whether or not it is, because a node that left
     * the selection draws no outline for a reason that has nothing to do with
     * the suppressed set.
     */
    outlineSuppressed: (id: NodeId) => layer('selection-overlay').draw({
      getChromeState: () => ({
        selection: [id], multiActive: false, unionBounds: null,
        boundsOf: () => ({ x: 100, y: 100, width: 40, height: 40 }),
        modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      }),
    }, VIEW, DIMS).length === 0,
    ruleSaysEditing: () => isVisible()(PROBE),
    worldCoords: (id: NodeId): number[] => {
      const node = scene.get(id)!;
      return Array.from((pathInWorld(node.data.path, node.pose) as { coords: ArrayLike<number> }).coords);
    },
    drag: (from: [number, number], to: [number, number]) => act(() => {
      pointer('pointerdown', ...from);
      pointer('pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
      pointer('pointermove', ...to);
      pointer('pointerup', ...to);
    }),
    shiftClick: (x: number, y: number) => act(() => {
      pointer('pointerdown', x, y, { shiftKey: true });
      pointer('pointerup', x, y, { shiftKey: true });
    }),
    selection: () => [...scene.getSelection()],
  };
}

/** How many of a square's four anchors a drag moved: one is an anchor grabbed, four is the node dragged by its body. */
function anchorsMoved(before: number[], after: number[]): number {
  let n = 0;
  for (let i = 0; i < before.length; i += 2) {
    if (before[i] !== after[i] || before[i + 1] !== after[i + 1]) n++;
  }
  return n;
}

describe('a path being anchor-edited, with its node selected', () => {
  it('is the edit target for the dep, the overlay, the selection overlay, the rule context, and the shift-click lock', () => {
    const t = setup();
    t.enter();
    expect(t.depEditingId()).toBe(A);
    expect(t.overlayCommands()).toBe(5);
    expect(t.outlineSuppressed(A)).toBe(true);
    expect(t.ruleSaysEditing()).toBe(true);
    t.shiftClick(200, 120);
    expect(t.selection()).toEqual([A]);
  });

  it('has grabbable anchors', () => {
    const t = setup();
    t.enter();
    const before = t.worldCoords(A);
    t.drag([140, 100], [150, 90]);
    expect(anchorsMoved(before, t.worldCoords(A))).toBe(1);
  });

  // A proxy for the repaint: jsdom paints nothing, so this asserts the
  // overlay announces the change, which `<Canvas>` turns into a redraw
  // (`Canvas.redrawOn.test.tsx`).
  it('has its overlay announce a change of edit target, anchor selection, or marquee', () => {
    const t = setup();
    const heard = vi.fn();
    const off = t.overlayLayer().subscribe!(heard);
    t.enter();
    expect(heard).toHaveBeenCalled();
    heard.mockClear();
    act(() => t.dep().setSelectedAnchors([1]));
    expect(heard).toHaveBeenCalledTimes(1);
    act(() => t.dep().setMarquee({ x: 0, y: 0, width: 5, height: 5 }));
    expect(heard).toHaveBeenCalledTimes(2);
    off();
  });

  it('stops being one everywhere when the mode stops permitting anchor edits', () => {
    const modes = createModeRegistry({ modes: DEFAULT_MODES, initial: 'path-edit' });
    const t = setup({ modes });
    t.enter();
    expect(t.overlayCommands()).toBe(5);
    act(() => modes.setMode('normal'));
    expect(t.depEditingId()).toBe('');
    expect(t.overlayCommands()).toBe(0);
    expect(t.outlineSuppressed(A)).toBe(false);
    expect(t.ruleSaysEditing()).toBe(false);
  });
});

describe('a path whose node leaves the selection mid-edit, without exitPathEdit', () => {
  function deselected(props?: Record<string, unknown>) {
    const t = setup(props);
    t.enter();
    t.select([B]);
    return t;
  }

  it("is no longer the dep's edit target, so a drag on an anchor moves the node", () => {
    const t = deselected();
    expect(t.depEditingId()).toBe('');
    const before = t.worldCoords(A);
    t.drag([140, 140], [150, 150]);
    expect(anchorsMoved(before, t.worldCoords(A))).toBe(4);
  });

  it('has its anchors leave the overlay', () => {
    expect(deselected().overlayCommands()).toBe(0);
  });

  it('is no longer skipped by the selection overlay', () => {
    expect(deselected().outlineSuppressed(A)).toBe(false);
  });

  it('leaves the rule context saying no path is being edited', () => {
    expect(deselected().ruleSaysEditing()).toBe(false);
  });

  it('gives shift-click back to the node selection', () => {
    const t = deselected();
    t.shiftClick(100, 220);
    expect(t.selection()).toEqual([C]);
  });

  it('is the edit target again once its node is reselected', () => {
    const t = deselected();
    t.select([A]);
    expect(t.depEditingId()).toBe(A);
    expect(t.overlayCommands()).toBe(5);
  });

  it('is dropped the same way when a host owns the id, which the host still holds', () => {
    let editing: string | null = null;
    const host = { editingId: () => editing, setEditingId: (next: string | null) => { editing = next; } };
    const t = deselected({ pathEdit: host });
    expect(editing).toBe(A);
    expect(t.depEditingId()).toBe('');
    expect(t.overlayCommands()).toBe(0);
    expect(t.outlineSuppressed(A)).toBe(false);
    expect(t.ruleSaysEditing()).toBe(false);
  });
});

describe('a path whose node is removed mid-edit', () => {
  function removed() {
    const t = setup();
    t.enter();
    t.remove(A);
    return t;
  }

  it("is no longer the dep's edit target, and the overlay has no path to paint", () => {
    const t = removed();
    // The dep's id is what the anchor hit-test reads; there is no node left to drag.
    expect(t.depEditingId()).toBe('');
    expect(t.overlayCommands()).toBe(0);
  });

  it('is no longer skipped by the selection overlay', () => {
    expect(removed().outlineSuppressed(A)).toBe(false);
  });

  it('leaves the rule context saying no path is being edited', () => {
    expect(removed().ruleSaysEditing()).toBe(false);
  });

  it('gives shift-click back to the node selection', () => {
    const t = removed();
    t.select([B]);
    t.shiftClick(100, 220);
    expect(t.selection()).toEqual([C]);
  });
});
