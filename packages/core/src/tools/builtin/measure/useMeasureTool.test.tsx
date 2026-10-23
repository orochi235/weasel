import { describe, it, expect, vi, beforeAll } from 'vitest';
import { useMemo, useState } from 'react';
import { renderHook, act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { reportRouteConflicts, resolveParams, type ActionsRegistry } from '@weasel-js/routing';
import { useActionsRegistry } from '@weasel-js/routing/react';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { createScene } from 'core/scene/scene';
import type { NodeId, Scene } from 'core/scene/types';
import { useSelection } from 'core/selection/useSelection';
import { useMeasureTool } from './useMeasureTool';
import { createMeasurements, measureIds } from 'features/measure/measurements';
import { measureEndsOf } from 'features/measure/measurement';
import { measurementsContribution } from 'features/measure/measureContribution';
import { measureEndSource } from 'features/measure/measureHit';
import { MEASURE_ACTION_IDS } from 'features/measure/actionIds';

const ms0 = () => createMeasurements({ layer: 'notes' });

describe('useMeasureTool — the tool', () => {
  it('declares the ruler glyph and the M key', () => {
    const { result } = renderHook(() => useMeasureTool({ measurements: ms0() }));
    expect(result.current.presentation?.icon).toBe('core:measure');
    expect(result.current.keybinding).toEqual({ key: 'M' });
  });

  it('hands the drag the latest angle step, without minting a new tool', () => {
    const ms = ms0();
    const { result, rerender } = renderHook(({ step }) => useMeasureTool({ measurements: ms, angleStep: step }), {
      initialProps: { step: Math.PI / 4 },
    });
    const tool = result.current;
    const drag = tool.bindings?.find((b) => b.actionId === MEASURE_ACTION_IDS.measure);
    expect(resolveParams(drag?.opts?.params)).toEqual({ angleStep: Math.PI / 4 });
    rerender({ step: Math.PI / 2 });
    expect(result.current).toBe(tool);
    expect(resolveParams(drag?.opts?.params)).toEqual({ angleStep: Math.PI / 2 });
  });

  it('reports no route conflicts', () => {
    const { result } = renderHook(() => useMeasureTool({ measurements: ms0() }));
    expect(reportRouteConflicts({ registry: [result.current] }, () => {})).toEqual([]);
  });

  it('says while it is active, and drops a drawing in progress when it is not', () => {
    const ms = ms0();
    const { result } = renderHook(() => useMeasureTool({ measurements: ms }));
    act(() => { result.current.onActivate?.(); });
    expect(ms.measuring.get()).toBe(true);
    act(() => { result.current.onDeactivate?.(); });
    expect(ms.measuring.get()).toBe(false);
  });
});

describe('measurements through <SceneCanvas>', () => {
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
  type S = Scene<{ kind?: string }, 'main' | 'notes', Pose>;
  let registry: ActionsRegistry | null = null;
  let selectionApi: ReturnType<typeof useSelection>;
  let scene: S;
  let ms: ReturnType<typeof createMeasurements>;

  function Probe() {
    registry = useActionsRegistry();
    return null;
  }

  function Harness() {
    const [m] = useState(ms0);
    ms = m;
    const measure = useMeasureTool({ measurements: m });
    const [s] = useState(() => {
      const made = createScene<{ kind?: string }, 'main' | 'notes', Pose>({
        systemLayers: [{ id: 'main' }, { id: 'notes', annotation: true }],
      });
      made.add({ kind: 'mark', layer: 'main', data: { kind: 'box' }, pose: { x: 300, y: 300, width: 20, height: 20 } });
      return made;
    });
    scene = s;
    const selection = useSelection({ mode: 'multi', scene: s });
    selectionApi = selection;
    const ambient = useMemo(() => [measurementsContribution(s as never, m)], [s, m]);
    const snap = useMemo(() => ({ sources: [measureEndSource()] }), []);
    return (
      <SceneCanvas
        features={['draw']} scene={s} selection={selection} layers={{}} width={400} height={400}
        tools={{ measure }} ambient={ambient} snap={snap}
      >
        <Probe />
      </SceneCanvas>
    );
  }

  const pointer = (canvas: Element, type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  const drag = (canvas: Element, from: [number, number], to: [number, number]) => act(() => {
    pointer(canvas, 'pointerdown', ...from);
    pointer(canvas, 'pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
    pointer(canvas, 'pointermove', ...to);
    pointer(canvas, 'pointerup', ...to);
  });
  const click = (canvas: Element, x: number, y: number) => act(() => {
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
  });
  const press = (k: string, code: string) => act(() => {
    document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: k, code }));
  });
  const key = (k: string) => act(() => { window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true })); });
  const ids = () => measureIds(scene as never, ms);
  const box = () => [...scene.renderOrder()].find((id) => scene.get(id)!.layer === 'main')!;

  function mountWithTwo() {
    const { container } = render(<Harness />);
    const canvas = container.querySelector('canvas')!;
    press('m', 'KeyM');
    drag(canvas, [20, 20], [80, 100]);
    drag(canvas, [20, 200], [120, 200]);
    return canvas;
  }

  it('keeps the measurements, and the pick, when the tool changes', () => {
    mountWithTwo();
    expect(ids()).toHaveLength(2);
    const picked = ms.picked.get();
    press('v', 'KeyV');
    expect(ids()).toHaveLength(2);
    expect(ms.picked.get()).toBe(picked);
  });

  it('leaves the pick alone on Escape under the select tool', () => {
    mountWithTwo();
    const picked = ms.picked.get();
    press('v', 'KeyV');
    key('Escape');
    expect(ms.picked.get()).toBe(picked);
  });

  it('drops the pick on Escape under the measure tool', () => {
    mountWithTwo();
    key('Escape');
    expect(ms.picked.get()).toBeNull();
  });

  it('picks a measurement clicked under the select tool, keeping the selection, and moves the selection by it', () => {
    const canvas = mountWithTwo();
    const [first] = ids();
    press('v', 'KeyV');
    act(() => { selectionApi.set([box() as NodeId]); });
    click(canvas, 50, 60);
    expect(ms.picked.get()).toBe(first);
    expect(selectionApi.get()).toEqual([box()]);
    act(() => { registry!.trigger(MEASURE_ACTION_IDS.moveBy); });
    expect(scene.get(box())!.pose).toMatchObject({ x: 360, y: 380 });
  });

  it('measures from an existing end, which its snap source offers', () => {
    const canvas = mountWithTwo();
    drag(canvas, [82, 98], [200, 98]);
    const newest = ids().at(-1)!;
    expect(measureEndsOf(scene.get(newest))?.start).toEqual({ x: 80, y: 100 });
  });
});
