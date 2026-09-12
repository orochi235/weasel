/**
 * The lab's central claim, under test: core's dispatcher drives a 3D viewport
 * unchanged, because `clientToWorld` is the only place 2D-ness enters.
 *
 * Pattern from `packages/core/src/tools/integration.test.tsx` — providers, the
 * real `useGestureDispatcher`, synthesized pointer events.
 *
 * There is no GL here and jsdom measures every element as zero, so the viewport
 * size is supplied rather than measured. That is the point of the seam: the deps
 * take their camera and size from a thunk, and nothing about the dispatcher path
 * knows the difference.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, act } from '@testing-library/react';
import { useRef, useMemo, useCallback } from 'react';
import {
  ActionsProvider,
  ActiveToolContextProvider,
  DepRegistryProvider,
  useAction,
  useActionsRegistry,
  useActiveToolContext,
  useDepSource,
  useGestureDispatcher,
  type NodeId,
  type Tool,
} from '@weasel-js/core';
import { createCamera } from './camera3d';
import { createNodeAtPoint, type Viewport3d } from './deps3d';
import { createSolidScene, type SolidScene } from './scene3d';
import { orbitAction, useOrbitTool } from './tools3d';
import './depSchemaAugmentation';

const WIDTH = 800;
const HEIGHT = 600;

function fire(el: Element, type: string, init: PointerEventInit = {}) {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, pointerId: 1, ...init }));
}

interface Harness {
  scene: SolidScene;
  picks: Array<{ x: number; y: number }>;
  viewport: Viewport3d;
  camera: { current: ReturnType<typeof createCamera> };
}

function mount(harness: Harness, toolId: string) {
  function App() {
    const paneRef = useRef<HTMLDivElement | null>(null);
    const actions = useActionsRegistry();
    const activeTool = useActiveToolContext();
    useDepSource('activeTool', () => activeTool);

    const nodeAtPoint = useMemo(() => {
      const pick = createNodeAtPoint(harness.scene, () => ({
        ...harness.viewport,
        camera: harness.camera.current,
      }));
      return (point: { x: number; y: number }, exclude?: Iterable<NodeId>) => {
        harness.picks.push({ x: point.x, y: point.y });
        return pick(point, exclude);
      };
    }, []);

    useDepSource('nodeAtPoint', () => nodeAtPoint);
    useDepSource('camera3d', () => ({
      get: () => harness.camera.current,
      set: (next) => {
        harness.camera.current = next;
      },
      size: () => ({ width: WIDTH, height: HEIGHT }),
    }));

    useAction(orbitAction);
    const orbit = useOrbitTool();
    const toolsById = useMemo(() => new Map<string, Tool>([['orbit', orbit as Tool]]), [orbit]);

    // Identity: the pane is at the origin in jsdom, and the lab's whole point is
    // that the dispatcher's "world" point is the screen point.
    const clientToWorld = useCallback((x: number, y: number) => ({ x, y }), []);

    useGestureDispatcher({
      canvasRef: paneRef,
      actions: actions!,
      toolsById,
      clientToWorld,
    });

    return <div data-testid="pane" ref={paneRef} style={{ width: WIDTH, height: HEIGHT }} />;
  }

  return render(
    <DepRegistryProvider>
      <ActionsProvider>
        <ActiveToolContextProvider initialActive={toolId}>
          <App />
        </ActiveToolContextProvider>
      </ActionsProvider>
    </DepRegistryProvider>,
  );
}

function harnessOf(): Harness {
  return {
    scene: createSolidScene(),
    picks: [],
    viewport: { camera: createCamera({}), width: WIDTH, height: HEIGHT },
    camera: { current: createCamera({ distance: 14, pitch: 0.45, target: [0, 0.5, 0] }) },
  };
}

describe('the dispatcher over a 3D viewport', () => {
  it('hands the action the screen point, with no view transform applied', () => {
    const seen: Array<{ world: { x: number; y: number }; screen: { x: number; y: number } }> = [];
    const start = vi
      .spyOn(orbitAction.invoker as { start: (ctx: never) => unknown }, 'start')
      .mockImplementation((ctx: never) => {
        const c = ctx as unknown as {
          world: { x: number; y: number };
          screen: { x: number; y: number };
        };
        seen.push({ world: { ...c.world }, screen: { ...c.screen } });
        return {};
      });

    const harness = harnessOf();
    const { getByTestId } = mount(harness, 'orbit');
    const pane = getByTestId('pane');

    act(() => {
      fire(pane, 'pointerdown', { clientX: 401, clientY: 299 });
      fire(pane, 'pointermove', { clientX: 455, clientY: 310 });
      fire(pane, 'pointerup', { clientX: 455, clientY: 310 });
    });

    expect(seen).toHaveLength(1);
    // The drag opens at the press point, carried through untouched. A 2D host
    // would have divided by the view scale and offset by the pan.
    expect(seen[0].world).toEqual({ x: 401, y: 299 });
    start.mockRestore();
  });

  it('routes a drag through the orbit tool to the camera dep', () => {
    const harness = harnessOf();
    const before = { ...harness.camera.current };
    const { getByTestId } = mount(harness, 'orbit');
    const pane = getByTestId('pane');

    act(() => {
      fire(pane, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(pane, 'pointermove', { clientX: 260, clientY: 100 });
      fire(pane, 'pointerup', { clientX: 260, clientY: 100 });
    });

    expect(harness.camera.current.yaw).not.toBeCloseTo(before.yaw, 6);
    expect(harness.camera.current.distance).toBe(before.distance);
  });

  it('leaves the camera alone when the drag never moves', () => {
    const harness = harnessOf();
    const before = { ...harness.camera.current };
    const { getByTestId } = mount(harness, 'orbit');
    const pane = getByTestId('pane');

    act(() => {
      fire(pane, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(pane, 'pointerup', { clientX: 100, clientY: 100 });
    });

    expect(harness.camera.current.yaw).toBeCloseTo(before.yaw, 6);
  });

  it('reaches the orbit action through the registry, not by being called directly', () => {
    const start = vi.spyOn(
      orbitAction.invoker as { start: (...args: never[]) => unknown },
      'start',
    );
    const harness = harnessOf();
    const { getByTestId } = mount(harness, 'orbit');
    const pane = getByTestId('pane');

    act(() => {
      fire(pane, 'pointerdown', { clientX: 100, clientY: 100 });
      fire(pane, 'pointermove', { clientX: 200, clientY: 160 });
      fire(pane, 'pointerup', { clientX: 200, clientY: 160 });
    });

    expect(start).toHaveBeenCalled();
    start.mockRestore();
  });
});
