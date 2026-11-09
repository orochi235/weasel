/** End-to-end integration test for moveAction's drag pump via the dispatcher. */

import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef } from 'react';
import { ActionsProvider, useActionsRegistry } from '@weasel-js/routing/react';
import { DepRegistryProvider, useDepRegistry } from '@weasel-js/routing/react';
import '../actions/depSchema'; // augments DepSchema with 'selection' and 'scene'
import { ActiveToolContextProvider } from '@weasel-js/routing/react';
import { useGestureDispatcher } from '@weasel-js/routing/react';
import { moveAction } from '../actions/move/action';
import { nudgeRightAction } from '../actions/defaults/nudge';
import { clipboardCopyAction, clipboardCutAction } from '../actions/clipboard/action';
import { selectAllAction } from '../actions/defaults/selectAll';
import { transformAgainAction } from '../actions/transform-again/action';
import { flipAction } from '../actions/flip/action';
import { duplicateAction } from '../actions/defaults/duplicate';
import { groupAction } from '../actions/defaults/group';
import { undoAction } from '../actions/defaults/undoRedo';
import { reorderForwardAction } from '../actions/defaults/reorder';
import { createScene } from 'core/scene/scene';
import { asNodeId } from 'core/scene/types';
import type { Scene } from 'core/scene/types';
import type { SelectionApi } from 'core/selection/useSelection';

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

/** Mounts the gesture dispatcher on the canvas element.
 *  `moveAction`'s ambient binding is `{ kind: 'drag', target: 'selected-body' }`,
 *  so a constant `classifyTarget` marks every drag as landing on the selection. */
function MountDispatcher({ canvasRef }: { canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const registry = useActionsRegistry();
  useGestureDispatcher({
    canvasRef,
    actions: registry!,
    entriesById: new Map(),
    classifyTarget: () => ({ body: 'selected-body' }),
  });
  return <canvas ref={canvasRef} data-testid="canvas" />;
}

let copies = 0;

/** Registers live dep sources for 'scene' and 'selection'. */
function RegisterDeps({ scene, selection }: { scene: Scene<D, L, P>; selection: SelectionApi }) {
  const registry = useDepRegistry();
  registry.register('scene', () => scene);
  registry.register('selection', () => selection);
  registry.register('clipboard', () => ({ copy: () => { copies++; }, paste: () => {}, isEmpty: () => true }));
  registry.register('history', () => scene.history);
  return null;
}

function RegisterMove() {
  const registry = useActionsRegistry();
  if (registry && !registry.list().find((a) => a.id === 'move')) {
    registry.register({ ...moveAction, enabled: () => true });
    registry.register(nudgeRightAction);
    for (const a of [selectAllAction, clipboardCopyAction, clipboardCutAction, transformAgainAction, flipAction, duplicateAction, groupAction, undoAction, reorderForwardAction]) {
      registry.register(a);
    }
  }
  return null;
}

/** Minimal SelectionApi backed by a plain array. */
function makeSelection(initial: string[]): SelectionApi {
  let ids = initial.map(asNodeId);
  return {
    get current() { return ids; },
    get() { return [...ids]; },
    set(next) { ids = next; },
    add(id) { if (!ids.includes(id)) ids = [...ids, id]; },
    remove(id) { ids = ids.filter((i) => i !== id); },
    toggle(id) { if (ids.includes(id)) { this.remove(id); } else { this.add(id); } },
    clear() { ids = []; },
    contains(id) { return ids.includes(id); },
    intentOf: (mods) => (mods.shift || mods.meta || mods.ctrl ? 'toggle' : 'replace'),
    applyClick(id, mods) {
      if (mods.shift || mods.meta || mods.ctrl) {
        this.toggle(id);
      } else {
        ids = [id];
      }
    },
    adapterMethods: {
      getSelection: () => [...ids],
      setSelection: (next) => { ids = next; },
    },
  };
}

/** Fires a synthetic PointerEvent on the canvas element. */
function fire(canvas: HTMLElement, type: string, coords: { clientX?: number; clientY?: number } = {}) {
  canvas.dispatchEvent(
    new PointerEvent(type, {
      bubbles: true,
      clientX: coords.clientX ?? 0,
      clientY: coords.clientY ?? 0,
    }),
  );
}

function buildHarness(scene: Scene<D, L, P>, selection: SelectionApi) {
  const canvasRef = { current: null } as React.RefObject<HTMLCanvasElement | null>;

  function Harness() {
    const ref = useRef<HTMLCanvasElement | null>(null);
    // Keep the outer ref in sync so callers can dispatch events.
    (canvasRef as React.MutableRefObject<HTMLCanvasElement | null>).current = ref.current;

    return (
      <DepRegistryProvider>
        <ActiveToolContextProvider>
            <ActionsProvider>
              <RegisterDeps scene={scene} selection={selection} />
              <RegisterMove />
              <MountDispatcher canvasRef={ref} />
            </ActionsProvider>
        </ActiveToolContextProvider>
      </DepRegistryProvider>
    );
  }

  return Harness;
}

describe('moveAction integration via gesture dispatcher', () => {
  it('drag pointerdown→move→up translates selected nodes by delta', () => {
    // Build scene with two nodes at (0,0) and (100,0).
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    const idB = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 100, y: 0, width: 50, height: 50 } });

    const selection = makeSelection([idA, idB]);
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    // Simulate drag: down at (0,0), move to (20,10), up at (20,10).
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 20, clientY: 10 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 20, clientY: 10 }); });

    const nodeA = scene.get(idA)!;
    const nodeB = scene.get(idB)!;

    expect((nodeA.pose as P).x).toBe(20);
    expect((nodeA.pose as P).y).toBe(10);
    expect((nodeB.pose as P).x).toBe(120);
    expect((nodeB.pose as P).y).toBe(10);
  });

  it('drag cancelled mid-gesture restores original poses (verify cancel path)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 5, y: 5, width: 50, height: 50 } });

    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 15 }); });
    // Cancel before up — scene should stay at original poses.
    act(() => { fire(canvas, 'pointercancel'); });

    const nodeA = scene.get(idA)!;
    expect((nodeA.pose as P).x).toBe(5);
    expect((nodeA.pose as P).y).toBe(5);
  });

  it('drag with empty selection is a no-op (no scene mutation)', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 10, y: 10, width: 50, height: 50 } });

    const selection = makeSelection([]); // empty
    const Harness = buildHarness(scene, selection);

    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    const versionBefore = scene.getVersion();

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 50, clientY: 50 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 50, clientY: 50 }); });

    // Scene version must not have advanced (no mutations).
    expect(scene.getVersion()).toBe(versionBefore);
    const nodeA = scene.get(idA)!;
    expect((nodeA.pose as P).x).toBe(10);
    expect((nodeA.pose as P).y).toBe(10);
  });

  it('an arrow key pressed mid-drag does not nudge what the drag is moving', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    const before = scene.historyEntries().length;
    const Harness = buildHarness(scene, makeSelection([idA]));
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 20, clientY: 0 }); });
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight' })); });
    act(() => { fire(canvas, 'pointerup', { clientX: 20, clientY: 0 }); });

    expect((scene.get(idA)!.pose as P).x).toBe(20);
    // One entry, the move's: no nudge entry the release then wrote over.
    expect(scene.historyEntries().length - before).toBe(1);

    // With nothing in flight the arrow nudges as usual.
    act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', code: 'ArrowRight' })); });
    expect((scene.get(idA)!.pose as P).x).toBe(21);
  });

  it.each([
    ['transformAgain', { key: 'd', code: 'KeyD', mod: true }],
    ['duplicate', { key: 'D', code: 'KeyD', mod: true, shiftKey: true }],
    ['flip', { key: 'H', code: 'KeyH', shiftKey: true }],
    ['group', { key: 'g', code: 'KeyG', mod: true }],
    ['undo', { key: 'z', code: 'KeyZ', mod: true }],
    ['reorder', { key: ']', code: 'BracketRight', mod: true }],
  ] as const)('%s pressed mid-drag leaves the scene to the drag', (_name, k) => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 100, y: 0, width: 50, height: 50 } });
    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');
    // A finished drag first, so undo has an entry to take back.
    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 10, clientY: 0 }); });
    act(() => { fire(canvas, 'pointerup', { clientX: 10, clientY: 0 }); });
    const before = scene.historyEntries().length;
    const snapshot = () => JSON.stringify([...scene.nodes.values()].map((n) => [n.id, n.parent, n.pose]));

    act(() => { fire(canvas, 'pointerdown', { clientX: 10, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 30, clientY: 0 }); });
    const during = snapshot();
    act(() => {
      const { mod, ...init } = k as { mod?: boolean; key: string; code: string; shiftKey?: boolean };
      for (const m of mod ? [{ ctrlKey: true }, { metaKey: true }] : [{}]) {
        window.dispatchEvent(new KeyboardEvent('keydown', { ...init, ...m }));
      }
    });
    expect(snapshot()).toBe(during);
    act(() => { fire(canvas, 'pointerup', { clientX: 30, clientY: 0 }); });

    expect((scene.get(idA)!.pose as P).x).toBe(30);
    expect(scene.historyEntries().length - before).toBe(1);
  });

  it('Select All and Copy pressed mid-drag wait for the drag to end', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    const idB = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 100, y: 0, width: 50, height: 50 } });
    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');
    const chord = (key: string, code: string) => {
      for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key, code, ...mod }));
      }
    };
    copies = 0;

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 20, clientY: 0 }); });
    act(() => { chord('c', 'KeyC'); chord('a', 'KeyA'); });
    expect(selection.get()).toEqual([idA]);
    expect(copies).toBe(0);
    act(() => { fire(canvas, 'pointerup', { clientX: 20, clientY: 0 }); });
    expect((scene.get(idA)!.pose as P).x).toBe(20);
    expect((scene.get(idB)!.pose as P).x).toBe(100);

    // With nothing in flight both keys work as usual.
    act(() => { chord('c', 'KeyC'); });
    expect(copies).toBe(1);
    act(() => { chord('a', 'KeyA'); });
    expect(selection.get()).toEqual([idA, idB]);
  });

  it('a cut pressed mid-drag does not delete what the drag is moving', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const idA = scene.add({ kind: 'mark', layer: 'main', data: { kind: 'rect' }, pose: { x: 0, y: 0, width: 50, height: 50 } });
    const selection = makeSelection([idA]);
    const Harness = buildHarness(scene, selection);
    const { getByTestId } = render(<Harness />);
    const canvas = getByTestId('canvas');
    const cut = () => {
      for (const mod of [{ ctrlKey: true }, { metaKey: true }]) {
        window.dispatchEvent(new KeyboardEvent('keydown', { key: 'x', code: 'KeyX', ...mod }));
      }
    };

    act(() => { fire(canvas, 'pointerdown', { clientX: 0, clientY: 0 }); });
    act(() => { fire(canvas, 'pointermove', { clientX: 20, clientY: 0 }); });
    act(cut);
    act(() => { fire(canvas, 'pointerup', { clientX: 20, clientY: 0 }); });

    expect((scene.get(idA)!.pose as P).x).toBe(20);
    expect(selection.get()).toEqual([idA]);

    act(cut);
    expect(scene.get(idA)).toBeUndefined();
  });
});
