/**
 * Coverage for `useSelectTool`'s clip-aware default `pickEvery`.
 *
 * The default `pickEvery` walks the scene hierarchy and excludes nodes
 * whose world position does not fall within an ancestor container's clip.
 * These tests verify:
 *
 * 1. A leaf outside an ancestor's clip is not selectable by click.
 * 2. A leaf inside an ancestor's clip is selectable.
 * 3. A container is selectable when the click is inside its clip.
 * 4. A container is NOT selectable when the click is outside its clip.
 * 5. A plain scene with no clips is unaffected (regression guard).
 *
 * ## jsdom coordinate note
 *
 * In jsdom the canvas element has no layout (`getBoundingClientRect` returns
 * all-zeros) and the WebGL context is unavailable, so Canvas's `canvasRef`
 * is never populated. The `clientToWorld` callback is therefore never called
 * — the dispatcher's ctx supplier defaults worldX/worldY to 0. All geometry
 * is arranged so that world (0, 0) gives the expected hit result.
 */
import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { Canvas } from 'canvas/Canvas';
import { sceneToAdapter } from 'canvas/sceneAdapter';
import { useScene } from 'core/scene/useScene';
import { useSelection } from 'core/selection/useSelection';
import { useTools } from '../useTools';
import { useSelectTool } from './useSelectTool';
import { rectPath } from 'features/paths/builder';
import { asNodeId } from 'core/scene/types';

interface Item { label: string }
type Pose = { x: number; y: number; width: number; height: number };

const C2W = (_c: HTMLCanvasElement, cx: number, cy: number): [number, number] => [cx, cy];

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

describe('useSelectTool default pickEvery — clip-aware', () => {
  it('does not pick a leaf whose AABB is outside an ancestor container clip', () => {
    // bed: container at (0,0,100,100) with clip at (25,25,50,50).
    // corner: leaf at (5,5,10,10) — inside bed's AABB but outside its clip.
    // Effective world click is (0,0) in jsdom — outside the clip (25..75).
    // Neither bed (clip excludes origin) nor corner (ancestor clip excludes origin)
    // should be selected.
    let lastSel: readonly string[] = [];

    function Harness() {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('bed'),
            kind: 'container',
            layer: 'default',
            pose: { x: 0, y: 0, width: 100, height: 100 },
            data: { label: 'bed' },
            clipFromPose: () => rectPath(25, 25, 50, 50),
          },
          {
            id: asNodeId('corner'),
            parent: asNodeId('bed'),
            kind: 'leaf',
            layer: 'default',
            pose: { x: 5, y: 5, width: 10, height: 10 },
            data: { label: 'corner' },
          },
        ],
      });
      const sel = useSelection({ mode: 'single' });
      lastSel = sel.current;
      const adapter = sceneToAdapter(scene, { selection: sel });
      const selectTool = useSelectTool(adapter as never, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    const { container, rerender } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};

    // Any clientX/Y maps to world (0,0) in jsdom — outside the clip.
    fireEvent.pointerDown(canvas, { clientX: 10, clientY: 10, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 10, clientY: 10, pointerId: 1 });

    rerender(<Harness />);
    expect(lastSel).toEqual([]);
  });

  it('picks a leaf whose AABB is inside an ancestor container clip', () => {
    // bed: container at (0,0,100,100) with clip = full container AABB so that
    // the jsdom effective click at (0,0) is inside the clip.
    // inner: leaf at (0,0,10,10) — inside both the container and its clip.
    // pickTopMostHit drops ancestor bed → inner is selected.
    let lastSel: readonly string[] = [];

    function Harness() {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('bed'),
            kind: 'container',
            layer: 'default',
            pose: { x: 0, y: 0, width: 100, height: 100 },
            data: { label: 'bed' },
            // Clip = full container AABB; the jsdom effective click at (0,0) is inside.
            clipFromPose: (pose) => rectPath(pose.x, pose.y, pose.width, pose.height),
          },
          {
            id: asNodeId('inner'),
            parent: asNodeId('bed'),
            kind: 'leaf',
            layer: 'default',
            pose: { x: 0, y: 0, width: 10, height: 10 },
            data: { label: 'inner' },
          },
        ],
      });
      const sel = useSelection({ mode: 'single' });
      lastSel = sel.current;
      const adapter = sceneToAdapter(scene, { selection: sel });
      const selectTool = useSelectTool(adapter as never, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    const { container, rerender } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};

    // World click (0,0): inside inner's AABB and inside bed's clip.
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5, pointerId: 1 });

    rerender(<Harness />);
    expect(lastSel).toContain(asNodeId('inner'));
  });

  it('container with a clip is selectable when the click is inside the clip', () => {
    // bed: container at (0,0,100,100) with clip = full AABB. No children.
    // World (0,0) is inside both AABB and clip → bed is selected.
    let lastSel: readonly string[] = [];

    function Harness() {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('bed'),
            kind: 'container',
            layer: 'default',
            pose: { x: 0, y: 0, width: 100, height: 100 },
            data: { label: 'bed' },
            clipFromPose: (pose) => rectPath(pose.x, pose.y, pose.width, pose.height),
          },
        ],
      });
      const sel = useSelection({ mode: 'single' });
      lastSel = sel.current;
      const adapter = sceneToAdapter(scene, { selection: sel });
      const selectTool = useSelectTool(adapter as never, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    const { container, rerender } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};

    // World click (0,0): inside bed's AABB and clip.
    fireEvent.pointerDown(canvas, { clientX: 50, clientY: 50, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 50, clientY: 50, pointerId: 1 });

    rerender(<Harness />);
    expect(lastSel).toContain(asNodeId('bed'));
  });

  it('container with a clip is NOT selectable when the click is outside its clip', () => {
    // bed: container at (0,0,100,100) with clip at (25,25,50,50).
    // World (0,0) is inside AABB but outside clip → bed is not selected.
    let lastSel: readonly string[] = [];

    function Harness() {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('bed'),
            kind: 'container',
            layer: 'default',
            pose: { x: 0, y: 0, width: 100, height: 100 },
            data: { label: 'bed' },
            clipFromPose: () => rectPath(25, 25, 50, 50),
          },
        ],
      });
      const sel = useSelection({ mode: 'single' });
      lastSel = sel.current;
      const adapter = sceneToAdapter(scene, { selection: sel });
      const selectTool = useSelectTool(adapter as never, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    const { container, rerender } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};

    // World click (0,0): outside clip (25,25,50,50).
    fireEvent.pointerDown(canvas, { clientX: 5, clientY: 5, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 5, clientY: 5, pointerId: 1 });

    rerender(<Harness />);
    expect(lastSel).toEqual([]);
  });

  it('plain scene without clips is unaffected (regression guard)', () => {
    // Two leaves at non-overlapping positions. World (0,0) hits A but not B.
    let lastSel: readonly string[] = [];

    function Harness() {
      const scene = useScene<Item, 'default', Pose>({
        systemLayers: [{ id: 'default' }],
        initial: [
          {
            id: asNodeId('A'),
            kind: 'leaf',
            layer: 'default',
            pose: { x: 0, y: 0, width: 50, height: 50 },
            data: { label: 'A' },
          },
          {
            id: asNodeId('B'),
            kind: 'leaf',
            layer: 'default',
            pose: { x: 60, y: 60, width: 50, height: 50 },
            data: { label: 'B' },
          },
        ],
      });
      const sel = useSelection({ mode: 'single' });
      lastSel = sel.current;
      const adapter = sceneToAdapter(scene, { selection: sel });
      const selectTool = useSelectTool(adapter as never, {});
      const tools = useTools({ active: 'select', registry: { select: selectTool } });
      return (
        <Canvas
          width={200}
          height={200}
          layers={{}}
          adapter={adapter as never}
          selection={sel}
          tools={tools}
          clientToWorld={C2W}
        />
      );
    }

    const { container, rerender } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    canvas.setPointerCapture = () => {};
    canvas.releasePointerCapture = () => {};

    // World click (0,0): hits A (0,0,50,50), misses B (60,60,50,50).
    fireEvent.pointerDown(canvas, { clientX: 25, clientY: 25, pointerId: 1 });
    fireEvent.pointerUp(canvas, { clientX: 25, clientY: 25, pointerId: 1 });

    rerender(<Harness />);
    expect(lastSel).toContain(asNodeId('A'));
    expect(lastSel).not.toContain(asNodeId('B'));
  });
});
