import { describe, it, expect, vi, beforeAll } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { SLICE_CLOSE_HIT_PX, useSliceTool, VERTEX_RADIUS_PX } from './useSliceTool';
import { boundsOfPath } from '@weasel-js/geom';
import { KitSettingsProvider, type KitSettingsOverrides } from '@weasel-js/react';
import type { ReactNode } from 'react';
import { reportRouteConflicts, type Action, type ActionDeps, type InvocationCtx } from '@weasel-js/routing';
import type { RenderLayer } from 'core/layers/render';
import { createPointerStore } from '@weasel-js/routing/react';
import { SceneCanvas } from 'canvas/SceneCanvas';
import { useSliceDep } from 'canvas/deps/slice';
import { createScene } from 'core/scene/scene';

type Pt = { x: number; y: number };

function setup(opts: Parameters<typeof useSliceTool>[0] = {}, settings?: KitSettingsOverrides) {
  const { result } = renderHook(() => useSliceTool(opts), {
    ...(settings ? { wrapper: ({ children }: { children: ReactNode }) => <KitSettingsProvider value={settings}>{children}</KitSettingsProvider> } : {}),
  });
  const commit = vi.fn<(cut: ReadonlyArray<Pt>) => void>();
  const pointer = createPointerStore();
  const deps = {
    slice: { commit },
    view: { get: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }), set: () => {} },
    pointer,
  } as unknown as ActionDeps;

  const actionOf = (id: string): Action => {
    const a = (result.current.actions ?? []).find((x) => x.id === id);
    if (!a) throw new Error(`${id} not declared on the tool`);
    return a;
  };
  /** Run an immediate action the way the dispatcher does, `enabled` gate
   *  first. Returns whether it ran. */
  const fire = (id: string, params?: Record<string, unknown>): boolean => {
    const action = actionOf(id);
    if (action.enabled && action.enabled(deps) !== true) return false;
    const invoker = action.invoker;
    if (invoker?.timing !== 'immediate') throw new Error(`${id} is not immediate`);
    invoker.run(deps, params);
    return true;
  };
  const click = (x: number, y: number) => fire('slice.addPoint', { pressX: x, pressY: y });
  const layer = () => result.current.overlay as RenderLayer<unknown>;
  const paint = () => layer().draw(undefined, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 400, dpr: 1 });
  return { tool: () => result.current, actionOf, fire, click, commit, pointer, deps, layer, paint };
}

describe('useSliceTool — palette presentation', () => {
  it('declares the knife glyph, so a palette draws no placeholder', () => {
    const { tool } = setup();
    expect(tool().presentation?.icon).toBe('core:slice');
  });
});

describe('useSliceTool — vertex dots', () => {
  it('sizes them from targets.sliceVertexRadiusPx, else VERTEX_RADIUS_PX', () => {
    const width = (s: ReturnType<typeof setup>) => {
      s.click(10, 10);
      const dot = s.paint().find((c) => c.kind === 'path' && c.fill);
      return dot?.kind === 'path' ? boundsOfPath(dot.path).width : 0;
    };
    expect(width(setup())).toBe(2 * VERTEX_RADIUS_PX);
    expect(width(setup({}, { targets: { sliceVertexRadiusPx: 5 } }))).toBe(10);
  });
});

describe('useSliceTool — close reach', () => {
  /** Whether a click `d` px right of the first of three points closes the cut. */
  const closesAt = (d: number, opts: Parameters<typeof useSliceTool>[0] = {}, settings?: KitSettingsOverrides) => {
    const s = setup(opts, settings);
    s.click(0, 0);
    s.click(100, 0);
    s.click(100, 100);
    s.click(d, 0);
    return s.commit.mock.calls.length === 1;
  };

  it('closes within targets.sliceCloseHitPx, else SLICE_CLOSE_HIT_PX, and an option beats both', () => {
    expect([closesAt(SLICE_CLOSE_HIT_PX - 1), closesAt(SLICE_CLOSE_HIT_PX + 1)]).toEqual([true, false]);
    expect(closesAt(15, {}, { targets: { sliceCloseHitPx: 20 } })).toBe(true);
    expect(closesAt(15, { closeHitRadius: 4 }, { targets: { sliceCloseHitPx: 20 } })).toBe(false);
  });
});

describe('useSliceTool — click-by-click cut', () => {
  it('commits the placed points on Enter', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(50, 60);
    expect(s.fire('slice.finish')).toBe(true);
    expect(s.commit).toHaveBeenCalledWith([{ x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 60 }]);
  });

  it('commits on a double click without the point its second click placed', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(50, 11);
    s.fire('slice.finish', { viaDoubleClick: true });
    expect(s.commit).toHaveBeenCalledWith([{ x: 10, y: 10 }, { x: 50, y: 10 }]);
  });

  it('closes into a loop and commits when a click lands on the first point', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(50, 50);
    s.click(13, 12);
    expect(s.commit).toHaveBeenCalledWith([
      { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 50 }, { x: 10, y: 10 },
    ]);
    expect(s.fire('slice.finish')).toBe(false);
  });

  it('does not close on the first point before three are placed', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(11, 10);
    expect(s.commit).not.toHaveBeenCalled();
  });

  it('takes back the last point on Backspace, and ends the cut with the first', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(50, 60);
    expect(s.fire('slice.dropPoint')).toBe(true);
    s.fire('slice.finish');
    expect(s.commit).toHaveBeenCalledWith([{ x: 10, y: 10 }, { x: 50, y: 10 }]);

    s.click(1, 1);
    s.fire('slice.dropPoint');
    expect(s.fire('slice.dropPoint')).toBe(false);
  });

  it('discards the points on Escape without cutting', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    expect(s.fire('slice.cancel')).toBe(true);
    expect(s.commit).not.toHaveBeenCalled();
    expect(s.fire('slice.finish')).toBe(false);
  });

  it('declines Enter, Escape and Backspace with nothing placed, so they fall through', () => {
    const s = setup();
    expect(s.fire('slice.finish')).toBe(false);
    expect(s.fire('slice.cancel')).toBe(false);
    expect(s.fire('slice.dropPoint')).toBe(false);
  });

  it('commits nothing for a single point', () => {
    const s = setup();
    s.click(10, 10);
    s.fire('slice.finish');
    expect(s.commit).not.toHaveBeenCalled();
  });

  it('discards the points when the tool is switched away', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    act(() => { s.tool().onDeactivate?.(); });
    expect(s.fire('slice.finish')).toBe(false);
  });

  it('places a point where a drag is released while a cut is pending, and declines otherwise', () => {
    const s = setup();
    const drag = s.actionOf('slice.dragPoint');
    expect(drag.enabled!(s.deps)).not.toBe(true);

    s.click(10, 10);
    expect(drag.enabled!(s.deps)).toBe(true);
    const invoker = drag.invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('slice.dragPoint is not ongoing');
    const ctx = (world: Pt): InvocationCtx => ({
      world, screen: world, deps: s.deps,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      drag: { start: { x: 10, y: 10 }, current: world, delta: { x: 0, y: 0 } },
    } as InvocationCtx);
    const handle = invoker.start(ctx({ x: 20, y: 20 }));
    handle.onEnd?.(ctx({ x: 70, y: 30 }), 'commit');
    s.fire('slice.finish');
    expect(s.commit).toHaveBeenCalledWith([{ x: 10, y: 10 }, { x: 70, y: 30 }]);
  });

  it('closes the loop on a drag released at the first point, with the end context carrying no deps', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.click(50, 60);
    const invoker = s.actionOf('slice.dragPoint').invoker;
    if (invoker?.timing !== 'ongoing') throw new Error('slice.dragPoint is not ongoing');
    const ctx = (world: Pt, deps: ActionDeps): InvocationCtx => ({
      world, screen: world, deps,
      modifiers: { alt: false, ctrl: false, meta: false, shift: false },
      drag: { start: { x: 50, y: 60 }, current: world, delta: { x: 0, y: 0 } },
    } as InvocationCtx);
    const handle = invoker.start(ctx({ x: 50, y: 60 }, s.deps));
    // The dispatcher builds every end context with empty deps.
    handle.onEnd?.(ctx({ x: 11, y: 11 }, {} as ActionDeps), 'commit');
    expect(s.commit).toHaveBeenCalledWith([
      { x: 10, y: 10 }, { x: 50, y: 10 }, { x: 50, y: 60 }, { x: 10, y: 10 },
    ]);
  });

  it('owns the drag cut too, so a consumer need not register sliceAction', () => {
    const s = setup();
    expect(s.actionOf('slice').invoker?.timing).toBe('ongoing');
  });
});

describe('useSliceTool — pending-cut preview', () => {
  it('paints nothing until a point is placed', () => {
    const s = setup();
    expect(s.paint()).toEqual([]);
  });

  it('paints the placed points and a run trailing to the pointer', () => {
    const s = setup();
    s.click(10, 10);
    s.click(50, 10);
    s.pointer.set({ world: { x: 50, y: 80 }, viewId: null });
    const cmds = s.paint() as Array<{ kind: string; path: { coords?: Float32Array }; stroke?: unknown }>;
    const run = cmds.find((c) => c.stroke)!;
    expect(Array.from(run.path.coords!)).toEqual([10, 10, 50, 10, 50, 80]);
    expect(cmds.filter((c) => !c.stroke)).toHaveLength(2);
  });

  it('notifies its subscribers when points change and when the pointer moves', () => {
    const s = setup();
    const heard = vi.fn();
    const off = s.layer().subscribe!(heard);
    s.click(10, 10);
    expect(heard).toHaveBeenCalledTimes(1);
    s.pointer.set({ world: { x: 30, y: 30 }, viewId: null });
    expect(heard).toHaveBeenCalledTimes(2);
    s.fire('slice.cancel');
    heard.mockClear();
    s.pointer.set({ world: { x: 40, y: 40 }, viewId: null });
    expect(heard).not.toHaveBeenCalled();
    off();
  });
});

describe('useSliceTool — through <SceneCanvas>', () => {
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

  function SliceDep({ commit }: { commit: (cut: ReadonlyArray<Pt>) => void }) {
    useSliceDep({ commit });
    return null;
  }

  function Harness({ commit }: { commit: (cut: ReadonlyArray<Pt>) => void }) {
    const slice = useSliceTool();
    const scene = createScene<{ kind: string }, 'main', { x: number; y: number; width: number; height: number }>({
      systemLayers: [{ id: 'main' }],
    });
    return (
      <SceneCanvas features={['draw']} scene={scene} layers={{}} width={400} height={400} tools={{ slice }}>
        <SliceDep commit={commit} />
      </SceneCanvas>
    );
  }

  const pointer = (canvas: Element, type: string, x: number, y: number) =>
    canvas.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 }));
  const click = (canvas: Element, x: number, y: number) => {
    pointer(canvas, 'pointerdown', x, y);
    pointer(canvas, 'pointerup', x, y);
  };
  const key = (k: string) => window.dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

  function mount() {
    const commit = vi.fn<(cut: ReadonlyArray<Pt>) => void>();
    const { container } = render(<Harness commit={commit} />);
    act(() => { document.dispatchEvent(new KeyboardEvent('keydown', { bubbles: true, key: 'k', code: 'KeyK' })); });
    return { commit, canvas: container.querySelector('canvas')! };
  }

  it('cuts along clicked points when Enter is pressed, less one taken back', () => {
    const { commit, canvas } = mount();
    act(() => { click(canvas, 20, 20); });
    act(() => { click(canvas, 200, 20); });
    act(() => { click(canvas, 200, 200); });
    act(() => { key('Backspace'); });
    act(() => { key('Enter'); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual([{ x: 20, y: 20 }, { x: 200, y: 20 }]);
  });

  it('cuts on a double click, which places the last point once', () => {
    const { commit, canvas } = mount();
    act(() => { click(canvas, 20, 20); });
    act(() => { click(canvas, 200, 20); });
    act(() => { click(canvas, 200, 200); click(canvas, 200, 200); });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual([{ x: 20, y: 20 }, { x: 200, y: 20 }, { x: 200, y: 200 }]);
  });

  it('still cuts straight along a drag with no points placed', () => {
    const { commit, canvas } = mount();
    act(() => {
      pointer(canvas, 'pointerdown', 20, 20);
      pointer(canvas, 'pointermove', 200, 120);
      pointer(canvas, 'pointerup', 200, 120);
    });
    expect(commit).toHaveBeenCalledTimes(1);
    expect(commit.mock.calls[0][0]).toEqual([{ x: 20, y: 20 }, { x: 200, y: 120 }]);
  });

  it('places a point where a drag ends while a cut is pending, rather than cutting', () => {
    const { commit, canvas } = mount();
    act(() => { click(canvas, 20, 20); });
    act(() => {
      pointer(canvas, 'pointerdown', 100, 100);
      pointer(canvas, 'pointermove', 200, 150);
      pointer(canvas, 'pointerup', 200, 150);
    });
    expect(commit).not.toHaveBeenCalled();
    act(() => { key('Enter'); });
    expect(commit.mock.calls[0][0]).toEqual([{ x: 20, y: 20 }, { x: 200, y: 150 }]);
  });

  it('discards clicked points on Escape and stays on the tool', () => {
    const { commit, canvas } = mount();
    act(() => { click(canvas, 20, 20); });
    act(() => { key('Escape'); });
    act(() => { click(canvas, 100, 20); });
    act(() => { click(canvas, 300, 20); });
    act(() => { key('Enter'); });
    expect(commit.mock.calls[0][0]).toEqual([{ x: 100, y: 20 }, { x: 300, y: 20 }]);
  });
});

describe('useSliceTool and the route-conflict check', () => {
  it('reports nothing for the point drag declared ahead of the cutting drag', () => {
    const { result } = renderHook(() => useSliceTool());
    expect(reportRouteConflicts({ registry: [result.current] }, () => {})).toEqual([]);
  });
});
