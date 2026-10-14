import { describe, it, expect, vi, beforeAll } from 'vitest';
import { isValidElement, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { reportRouteConflicts, resolveParams, type ActionsRegistry } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import type { DrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import { useSelection } from 'core/selection/useSelection';
import { MeasureIcon } from '../../../icons';
import { useMeasureTool } from './useMeasureTool';
import { createMeasurementStore, measureBetween } from './measurement';
import { MEASURE_ACTION_IDS } from './measureActions';

describe('useMeasureTool — the tool', () => {
  it('declares the ruler glyph and the M key', () => {
    const { result } = renderHook(() => useMeasureTool());
    const icon = result.current.presentation?.icon;
    expect(isValidElement(icon) && icon.type).toBe(MeasureIcon);
    expect(result.current.keybinding).toEqual({ key: 'M' });
  });

  it('hands the drag the latest angle step, without minting a new tool', () => {
    const { result, rerender } = renderHook(({ step }) => useMeasureTool({ angleStep: step }), {
      initialProps: { step: Math.PI / 4 },
    });
    const tool = result.current;
    const params = () => resolveParams(tool.bindings?.[0]?.opts?.params);
    expect(params()).toEqual({ angleStep: Math.PI / 4 });
    rerender({ step: Math.PI / 2 });
    expect(result.current).toBe(tool);
    expect(params()).toEqual({ angleStep: Math.PI / 2 });
  });

  it('reports no route conflicts', () => {
    const { result } = renderHook(() => useMeasureTool());
    expect(reportRouteConflicts({ registry: [result.current] }, () => {})).toEqual([]);
  });

  it('draws the measured line with a tick at each end, and nothing without one', () => {
    const store = createMeasurementStore();
    const { result } = renderHook(() => useMeasureTool({ store }));
    const layer = result.current.overlay as RenderLayer<unknown>;
    const paint = () => layer.draw(undefined, { x: 0, y: 0, scale: { x: 2, y: 2 } }, { width: 400, height: 400 }) as DrawCommand[];
    expect(paint()).toEqual([]);
    store.set(measureBetween({ x: 10, y: 10 }, { x: 50, y: 10 }));
    expect(paint()).toHaveLength(3);
  });

  it('drops the measurement when the tool is switched away', () => {
    const store = createMeasurementStore();
    const { result } = renderHook(() => useMeasureTool({ store }));
    store.set(measureBetween({ x: 0, y: 0 }, { x: 5, y: 5 }));
    act(() => { result.current.onDeactivate?.(); });
    expect(store.get()).toBeNull();
  });
});

describe('useMeasureTool — through <SceneCanvas>', () => {
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

  type Pose = { x: number; y: number; width: number; height: number };
  const store = createMeasurementStore();
  let registry: ActionsRegistry | null = null;
  let selectionApi: ReturnType<typeof useSelection>;
  let scene: ReturnType<typeof createScene<{ kind: string }, 'main', Pose>>;

  function Probe() {
    registry = useActionsRegistry();
    return null;
  }

  function Harness() {
    const measure = useMeasureTool({ store });
    const [s] = useState(() => {
      const made = createScene<{ kind: string }, 'main', Pose>({ systemLayers: [{ id: 'main' }] });
      made.add({ kind: 'leaf', layer: 'main', data: { kind: 'box' }, pose: { x: 300, y: 300, width: 20, height: 20 } });
      return made;
    });
    scene = s;
    const selection = useSelection({ mode: 'multi', scene: s });
    selectionApi = selection;
    return (
      <SceneCanvas features={['draw']} scene={s} selection={selection} layers={{}} width={400} height={400} tools={{ measure }}>
        <Probe />
      </SceneCanvas>
    );
  }

  const pointer = (canvas: Element, type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  it('measures a drag, moves the selection by it, and clears on Escape', () => {
    store.set(null);
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'm', code: 'KeyM' })); });
    act(() => {
      pointer(canvas, 'pointerdown', 20, 20);
      pointer(canvas, 'pointermove', 80, 100);
      pointer(canvas, 'pointerup', 80, 100);
    });
    expect(store.get()).toMatchObject({ dx: 60, dy: 80, distance: 100 });

    const id = [...scene.renderOrder()][0]!;
    act(() => { selectionApi.set([id]); });
    act(() => { registry!.trigger(MEASURE_ACTION_IDS.moveBy); });
    expect(scene.get(id)!.pose).toMatchObject({ x: 360, y: 380 });

    act(() => { key('Escape'); });
    expect(store.get()).toBeNull();
  });
});
