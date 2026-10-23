/**
 * In draw's path-edit mode, with the bar's Lengthen toggle on, dragging an open
 * path's end anchor lengthens the path from that end. Escape, the toggle, or
 * leaving path edit returns the drag to moving the anchor.
 */
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { act, cleanup } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import {
  ActionsProvider, DepRegistryProvider, SceneCanvas, asNodeId, createScene, pathFromD, pathInWorld,
  useActionsRegistry, type PolygonPath,
} from '@weasel-js/core';
import { lengthenPreset } from '@weasel-js/path-tools';
import { useMemo } from 'react';
import { DEFAULT_MODES } from '@weasel-js/modes';
import { createModeMachine } from './machine';
import { modePathEdit } from './pathEditHost';

beforeAll(() => {
  (HTMLCanvasElement.prototype as unknown as { getContext: () => null }).getContext = () => null;
});
afterEach(() => cleanup());

const A = asNodeId('a');
const FEATURES = ['draw', lengthenPreset] as const;
type Pose = { x: number; y: number; width: number; height: number };

function setup() {
  const history = {
    beginJournal: vi.fn(() => ({ applyBatch: vi.fn(), commit: vi.fn(), cancel: vi.fn(), suspend: vi.fn() })),
    resumeJournal: vi.fn(),
    entries: () => ({ undo: [], redo: [] }),
  };
  const machine = createModeMachine({ modes: DEFAULT_MODES, history: history as never });
  const scene = createScene<{ path: PolygonPath }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
  scene.add({
    id: A, kind: 'mark', layer: 'main',
    data: { path: pathFromD('M 0 0 L 20 0 L 20 20') as PolygonPath },
    pose: { x: 10, y: 10, width: 20, height: 20 },
  });
  scene.setSelection([A]);
  const grabbed: { trigger?: (id: string) => void } = {};
  function Harness() {
    const actions = useActionsRegistry();
    grabbed.trigger = (id) => { actions?.trigger(id); };
    const pathEdit = useMemo(() => modePathEdit(machine, () => true), []);
    return (
      <SceneCanvas features={FEATURES} scene={scene} layers={{}} width={128} height={128}
        modes={machine.registry} pathEdit={pathEdit} />
    );
  }
  const { container } = render(<DepRegistryProvider><ActionsProvider><Harness /></ActionsProvider></DepRegistryProvider>);
  act(() => grabbed.trigger!('enterPathEdit'));
  const canvas = container.querySelector('canvas')!;
  const trigger = (id: string) => act(() => grabbed.trigger!(id));
  const escape = () => act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  });
  return { scene, canvas, machine, trigger, escape };
}

// jsdom's canvas rect is all zeros and the view is identity, so client coords are world coords.
function drag(canvas: HTMLCanvasElement, from: [number, number], to: [number, number]) {
  const at = (type: string, [x, y]: [number, number]) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  act(() => {
    at('pointerdown', from);
    at('pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]);
    at('pointermove', to);
    at('pointerup', to);
  });
}

function worldCoords(scene: ReturnType<typeof setup>['scene']): number[] {
  const node = scene.get(A)!;
  return Array.from((pathInWorld(node.data.path, node.pose as never) as PolygonPath).coords);
}

const MOVED = [10, 10, 30, 10, 34, 60];
const LENGTHENED = [10, 10, 30, 10, 30, 60];

describe('lengthening a path from its end in path edit', () => {
  it('lengthens the path along its end while the Lengthen toggle is on', () => {
    const { scene, canvas, trigger } = setup();
    trigger('pathEditTool.lengthen');
    // The end anchor is at world (30, 30), heading +y.
    drag(canvas, [30, 30], [34, 60]);
    expect(worldCoords(scene)).toEqual(LENGTHENED);
  });

  it("shows Lengthen's cursor over an open end while the toggle is on", () => {
    const { canvas, trigger } = setup();
    const hover = (x: number, y: number) => {
      act(() => { canvas.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerId: 1 })); });
      return canvas.style.cursor;
    };
    const plain = hover(30, 30);
    trigger('pathEditTool.lengthen');
    hover(60, 60);
    const over = hover(30, 30);
    expect(over).not.toBe(plain);
    expect(over).toMatch(/crosshair/);
    expect(hover(20, 10)).not.toBe(over);
  });

  it('moves the anchor with the toggle off', () => {
    const { scene, canvas } = setup();
    drag(canvas, [30, 30], [34, 60]);
    expect(worldCoords(scene)).toEqual(MOVED);
  });

  it('goes back to moving anchors on Escape, staying in path edit', () => {
    const { scene, canvas, trigger, escape, machine } = setup();
    trigger('pathEditTool.lengthen');
    escape();
    expect(machine.registry.current().id).toBe('path-edit');
    drag(canvas, [30, 30], [34, 60]);
    expect(worldCoords(scene)).toEqual(MOVED);
  });

  it('goes back to moving anchors when toggled off, or after leaving path edit', () => {
    const first = setup();
    first.trigger('pathEditTool.lengthen');
    first.trigger('pathEditTool.lengthen');
    drag(first.canvas, [30, 30], [34, 60]);
    expect(worldCoords(first.scene)).toEqual(MOVED);
    cleanup();

    const second = setup();
    second.trigger('pathEditTool.lengthen');
    act(() => second.machine.exitMode());
    second.trigger('enterPathEdit');
    drag(second.canvas, [30, 30], [34, 60]);
    expect(worldCoords(second.scene)).toEqual(MOVED);
  });
});
