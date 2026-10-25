/**
 * Edge resize handles: a press on the middle of a selected node's edge resizes
 * it along one axis, ahead of whatever body sits under the pointer.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useEffect } from 'react';
import { act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SceneCanvas } from './SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import { useDepRegistry } from '@weasel-js/routing/react';
import type { SelectionApi } from 'core/selection/useSelection';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number; rotation: number };

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

/** A drag from `from` to `to`; `during` is the event state once the pointer
 *  is down, so a modifier held mid-drag doesn't change what the press grabs. */
function drag(canvas: Element, from: [number, number], to: [number, number], during: PointerEventInit = {}): void {
  const opts = (x: number, y: number, init: PointerEventInit = {}) =>
    ({ bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0, ...init });
  act(() => {
    canvas.dispatchEvent(new PointerEvent('pointerdown', opts(...from)));
    canvas.dispatchEvent(new PointerEvent('pointermove', opts(...to, during)));
    canvas.dispatchEvent(new PointerEvent('pointerup', opts(...to, during)));
  });
}

function SelectionProbe({ into }: { into: { selection: SelectionApi | null } }) {
  const deps = useDepRegistry();
  useEffect(() => {
    into.selection = (deps.get('selection') as SelectionApi | undefined) ?? null;
  });
  return null;
}

/** `a` is selected; `behind`, added first, sits under `a`'s right edge and
 *  reaches past it, so a press just outside that edge lands on its body. */
function mount(a: Partial<P> = {}, props: Record<string, unknown> = {}) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  let id!: NodeId;
  let behind!: NodeId;
  scene.batch('seed', () => {
    behind = scene.add({
      kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 90, y: 0, width: 60, height: 60, rotation: 0 },
    });
    id = scene.add({
      kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 0, y: 0, width: 100, height: 60, rotation: 0, ...a },
    });
  });
  const seen: { selection: SelectionApi | null } = { selection: null };
  const result = render(
    <SceneCanvas scene={scene} width={300} height={300} features={['pick', 'move', 'resize']} {...props}>
      <SelectionProbe into={seen} />
    </SceneCanvas>,
  );
  const canvas = result.container.querySelector('canvas')!;
  act(() => seen.selection!.set([id]));
  const pose = (n: NodeId) => scene.get(n)!.pose as P;
  return { canvas, a: () => pose(id), behind: () => pose(behind) };
}

describe('edge resize handles', () => {
  it('takes a press on the right edge ahead of the node behind it', () => {
    const { canvas, a, behind } = mount();
    // (103, 30) is outside `a` and on `behind`'s body, within the right handle.
    drag(canvas, [103, 30], [133, 45]);
    expect(behind()).toMatchObject({ x: 90, y: 0 });
    expect(a()).toMatchObject({ x: 0, y: 0, width: 130, height: 60 });
  });

  it('pins the right edge under a left-edge drag', () => {
    const { canvas, a } = mount();
    drag(canvas, [0, 30], [-20, 40]);
    expect(a()).toMatchObject({ x: -20, y: 0, width: 120, height: 60 });
  });

  it('changes height only under a bottom-edge drag', () => {
    const { canvas, a } = mount();
    drag(canvas, [50, 60], [70, 80]);
    expect(a()).toMatchObject({ x: 0, y: 0, width: 100, height: 80 });
  });

  it('keeps the aspect on a shift-drag, the other axis centered on where it was', () => {
    const { canvas, a } = mount();
    // 100 x 60 → width 150 drives height 90, grown about the old center y = 30.
    drag(canvas, [100, 30], [150, 30], { shiftKey: true });
    expect(a()).toMatchObject({ x: 0, width: 150, height: 90 });
    expect(a().y).toBeCloseTo(-15);
  });

  it('resizes a rotated node along its own axis, pinning the opposite edge', () => {
    // 100 x 60 at (0, 0), turned 90° about its center (50, 30): its local
    // right edge midpoint (100, 30) lands at world (50, 80), and the left
    // edge midpoint it pins at (50, -20).
    const { canvas, a } = mount({ rotation: Math.PI / 2 });
    drag(canvas, [50, 80], [55, 100]);
    const p = a();
    expect(p.width).toBeCloseTo(120);
    expect(p.height).toBeCloseTo(60);
    // The pinned midpoint stays put: center minus half the width along +y.
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    expect(cx).toBeCloseTo(50);
    expect(cy - p.width / 2).toBeCloseTo(-20);
  });

  it('grows a rotated node about the pinned edge midpoint on a shift-drag', () => {
    const { canvas, a } = mount({ rotation: Math.PI / 2 });
    drag(canvas, [50, 80], [50, 100], { shiftKey: true });
    const p = a();
    expect(p.width).toBeCloseTo(120);
    expect(p.height).toBeCloseTo(72);
    // Turned 90°, local +x is world +y: the left edge midpoint is the center
    // less half the width along y, and it must not drift sideways either.
    const cx = p.x + p.width / 2, cy = p.y + p.height / 2;
    expect(cx).toBeCloseTo(50);
    expect(cy - p.width / 2).toBeCloseTo(-20);
  });

  it('leaves a node too small for edge handles to the body under the pointer', () => {
    // 40 px is under the 48 px edge-handle floor at the default 8 px radius.
    const { canvas, a } = mount({ width: 100, height: 40 });
    drag(canvas, [103, 20], [133, 20]);
    expect(a()).toMatchObject({ width: 100, height: 40 });
  });

  it('can be switched off through the select tool resize options', () => {
    const { canvas, a } = mount({}, { selectTool: { resize: { edgeHandles: false } } });
    drag(canvas, [103, 30], [133, 30]);
    expect(a()).toMatchObject({ width: 100, height: 60 });
  });
});

describe('edge handles are one decision, keyed on the hit radius', () => {
  const VIEW = { x: 0, y: 0, scale: { x: 1, y: 1 } };

  /** A lone selected `side`-square node, with the hit radius and the painted
   *  handle size set apart, so a decision keyed on the wrong one shows. */
  function square(side: number, hitRadius: number, paintSize: number) {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const id = scene.add({
      kind: 'mark', data: { kind: 'rect' }, layer: 'main' as L,
      pose: { x: 0, y: 0, width: side, height: side, rotation: 0 },
    });
    const seen: { selection: SelectionApi | null; views: ViewRegistry | null } = { selection: null, views: null };
    function Grab() {
      seen.views = useOptionalViewRegistry();
      return null;
    }
    const result = render(
      <SceneCanvas
        scene={scene} width={300} height={300} features={['pick', 'move', 'resize']}
        selectTool={{ handleHitRadius: hitRadius }}
        layers={{ selectionOverlay: { handles: { size: paintSize } } }}
      >
        <SelectionProbe into={seen} /><Grab />
      </SceneCanvas>,
    );
    act(() => seen.selection!.set([id]));
    const surface = seen.views!.surface()!;
    // One outline, then a fill and a stroke per handle.
    const commands = surface.layers().find((l) => l.id === 'selection-overlay')!
      .draw({ getChromeState: () => surface.chromeState() }, VIEW, { width: 300, height: 300, dpr: 1 }).length;
    const painted = (commands - 1) / 2 === 8;
    drag(result.container.querySelector('canvas')!, [side, side / 2], [side + 10, side / 2]);
    const grabbed = (scene.get(id)!.pose as P).width === side + 10;
    result.unmount();
    return { painted, grabbed };
  }

  // Radius 4 puts the floor at 24 px; a size-keyed one would put it at 72.
  it.each([[20, false], [30, true]])('radius 4, size 12, a %i px square: edges %s', (side, edges) => {
    expect(square(side, 4, 12)).toEqual({ painted: edges, grabbed: edges });
  });

  // Radius 12 puts the floor at 72 px; a size-keyed one would put it at 24.
  it.each([[60, false], [80, true]])('radius 12, size 4, a %i px square: edges %s', (side, edges) => {
    expect(square(side, 12, 4)).toEqual({ painted: edges, grabbed: edges });
  });
});
