/**
 * `<CanvasView>` mounted inside `<SceneCanvas>`: a second camera over a rect of
 * the same surface, with input routed to it.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import type { View } from 'core/viewport/view';
import type { RenderLayer } from 'core/layers/render';
import { ViewRegistryProvider, useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { NodeId } from 'core/scene/types';
import type { Bounds } from 'core/viewport/fitViewToBounds';
import { createSelectionOverlayLayer } from 'features/selection/overlay';
import { ViewInputsProvider } from './viewInputs';
import { AUTO_POSE_DESCRIPTOR } from 'interactions/actions/resize/autoPoseDescriptor';
import { DeviceProfileProvider } from 'core/device/useDeviceProfile';
import type { DeviceProfile } from 'core/device/types';

type D = { kind: 'rect' };
type L = 'main';
type P = { x: number; y: number; width: number; height: number };

/** The panel occupies x ∈ [100, 200) of a 300×200 canvas at the client origin. */
const PANEL = { x: 100, y: 0, w: 100, h: 100 };

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

function mount(opts: {
  onViewChange?: (v: View) => void;
  onPanelViewChange?: (v: View) => void;
} = {}) {
  const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
  const r = render(
    <SceneCanvas
      scene={scene}
      layers={{}}
      width={300}
      height={200}
      {...(opts.onViewChange ? { onViewChange: opts.onViewChange } : {})}
    >
      <CanvasView
        id="panel"
        bounds={PANEL}
        {...(opts.onPanelViewChange ? { onViewChange: opts.onPanelViewChange } : {})}
      />
    </SceneCanvas>,
  );
  return { canvas: r.container.querySelector('canvas')!, ...r };
}

/** Plain wheel pans whichever view the cursor is over — an ambient binding,
 *  so no tool has to be active for it to win. */
function wheelAt(el: Element, clientX: number) {
  act(() => {
    el.dispatchEvent(new WheelEvent('wheel', {
      bubbles: true, cancelable: true, clientX, clientY: 10, deltaX: 0, deltaY: 20,
    }));
  });
}

/** One pointer event on the canvas, at `clientX` on the y = 10 line. */
function pointer(el: Element, type: string, pointerId: number, clientX: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId, clientX, clientY: 10,
  }));
}

describe('<CanvasView>', () => {
  it('pans its own camera for input inside its rect', () => {
    const outer = vi.fn();
    const panel = vi.fn();
    const { canvas } = mount({ onViewChange: outer, onPanelViewChange: panel });

    wheelAt(canvas, 150);

    expect(panel.mock.calls.at(-1)?.[0]).toMatchObject({ y: 20 });
    expect(outer).not.toHaveBeenCalled();
  });

  it('leaves input outside its rect on the canvas camera', () => {
    const outer = vi.fn();
    const panel = vi.fn();
    const { canvas } = mount({ onViewChange: outer, onPanelViewChange: panel });

    wheelAt(canvas, 50);

    expect(outer.mock.calls.at(-1)?.[0]).toMatchObject({ y: 20 });
    expect(panel).not.toHaveBeenCalled();
  });

  it('zooms its own camera for a pinch inside its rect', () => {
    const outer = vi.fn();
    const panel = vi.fn();
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={300}
        height={200}
        viewport={{ pinchZoom: true }}
        onViewChange={outer}
        views={[{ id: 'panel', bounds: PANEL, onViewChange: panel }]}
      />,
    );
    const canvas = container.querySelector('canvas')!;

    // Two fingers straddling client x = 150, then spread from 20px to 30px.
    act(() => {
      pointer(canvas, 'pointerdown', 1, 140);
      pointer(canvas, 'pointerdown', 2, 160);
      pointer(canvas, 'pointermove', 2, 170);
    });

    expect(panel.mock.calls.at(-1)?.[0]).toMatchObject({ scale: { x: 1.5, y: 1.5 } });
    expect(outer).not.toHaveBeenCalled();
  });

  it('stops routing to a view that unmounts', () => {
    const outer = vi.fn();
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container, rerender } = render(
      <SceneCanvas scene={scene} layers={{}} width={300} height={200} onViewChange={outer}>
        <CanvasView id="panel" bounds={PANEL} />
      </SceneCanvas>,
    );
    rerender(
      <SceneCanvas scene={scene} layers={{}} width={300} height={200} onViewChange={outer} />,
    );

    wheelAt(container.querySelector('canvas')!, 150);

    expect(outer).toHaveBeenCalled();
  });
});

/** Drives the registry directly: a fake surface, one view, and the viewport
 *  node that view contributed. */
function Harness({ layers, onReady }: {
  layers: readonly RenderLayer<unknown>[];
  onReady: (r: ViewRegistry) => void;
}) {
  const registry = useOptionalViewRegistry()!;
  useEffect(() => {
    registry.attachSurface({
      origin: () => ({ left: 0, top: 0 }),
      view: () => ({ x: 0, y: 0, scale: { x: 1, y: 1 } }),
      dims: () => ({ width: 300, height: 200 }),
      layers: () => layers,
      requestRedraw: () => {},
      hitTestExtras: () => null,
      chromeState: () => ({
        selection: [], multiActive: false, boundsOf: () => null, unionBounds: null,
        modifiers: { alt: false, shift: false, meta: false, ctrl: false },
      }),
    });
    onReady(registry);
  }, [registry, layers, onReady]);
  return null;
}

const OUTER: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 300, height: 200 };

describe('<CanvasView> draw contribution', () => {
  it('paints the surface stack through its own camera, clipped to its rect', () => {
    const drawn: View[] = [];
    const source: RenderLayer<unknown> = {
      id: 'probe',
      label: 'probe',
      draw: (_data, view) => { drawn.push(view); return []; },
    };
    let registry!: ViewRegistry;
    render(
      <ViewRegistryProvider>
        <Harness layers={[source]} onReady={(r) => { registry = r; }} />
        <CanvasView id="panel" bounds={PANEL} defaultView={{ x: 5, y: 7, scale: { x: 2, y: 2 } }} />
      </ViewRegistryProvider>,
    );

    const reg = registry.list();
    expect(reg.map((r) => r.id)).toEqual(['panel']);
    const cmds = reg[0]!.layer.draw({}, OUTER, DIMS);

    expect(drawn).toEqual([{ x: 5, y: 7, scale: { x: 2, y: 2 } }]);
    expect(cmds[0]).toMatchObject({
      kind: 'group',
      clip: { kind: 'rect', x: 0, y: 0, width: PANEL.w, height: PANEL.h },
    });
  });

  it('narrows the stack when `layers` is given', () => {
    const seen: string[] = [];
    const layer = (id: string): RenderLayer<unknown> => ({
      id, label: id, draw: () => { seen.push(id); return []; },
    });
    let registry!: ViewRegistry;
    render(
      <ViewRegistryProvider>
        <Harness layers={[layer('a'), layer('b')]} onReady={(r) => { registry = r; }} />
        <CanvasView id="panel" bounds={PANEL} layers={(s) => s.filter((l) => l.id === 'b')} />
      </ViewRegistryProvider>,
    );

    registry.list()[0]!.layer.draw({}, OUTER, DIMS);
    expect(seen).toEqual(['b']);
  });

  it('hands its source layers its own chrome and the surface half unchanged', () => {
    let seen: Record<string, unknown> | undefined;
    const probe: RenderLayer<unknown> = {
      id: 'probe',
      label: 'probe',
      draw: (data) => { seen = data as Record<string, unknown>; return []; },
    };
    let registry!: ViewRegistry;
    let panel!: SelectionApi;
    function Panel() {
      panel = useSelection({ initial: ['mine' as NodeId] });
      return <CanvasView id="panel" bounds={PANEL} selection={panel} />;
    }
    render(
      <ViewRegistryProvider>
        <Harness layers={[probe]} onReady={(r) => { registry = r; }} />
        <Panel />
      </ViewRegistryProvider>,
    );

    const surfaceEnvelope = {
      getDebug: () => null,
      getChromeState: () => ({ selection: ['theirs'] }),
    };
    registry.list()[0]!.layer.draw(surfaceEnvelope, OUTER, DIMS);

    const chrome = (seen as { getChromeState(): { selection: readonly NodeId[] } }).getChromeState();
    expect(chrome.selection).toEqual(['mine']);
    expect((seen as { getDebug(): unknown }).getDebug()).toBe(null);
  });

  // Chrome-caps rules are the surface's; the context they resolve against is
  // the asking view's, so a rule keyed on selection answers differently in a
  // panel that owns one.
  it('resolves its chrome-caps predicate against its own selection', () => {
    let seen: Record<string, unknown> | undefined;
    const probe: RenderLayer<unknown> = {
      id: 'probe',
      label: 'probe',
      draw: (data) => { seen = data as Record<string, unknown>; return []; },
    };
    let registry!: ViewRegistry;
    const inputs = {
      adapter: undefined,
      geometry: AUTO_POSE_DESCRIPTOR as never,
      boundsOf: undefined,
      tools: undefined,
      selectionApi: { current: ['theirs' as NodeId] } as unknown as SelectionApi,
      chromeCaps: {
        ruleCtx: (i: { selection: readonly NodeId[] }) => i as never,
        // "visible iff this view has something selected" — a rule keyed on
        // exactly the state that differs between views.
        isVisible: (i: { selection: readonly NodeId[] }) =>
          (_id: string) => i.selection.length > 0,
      },
    };
    function Panel() {
      const panel = useSelection({ initial: [] });
      return <CanvasView id="panel" bounds={PANEL} selection={panel} />;
    }
    render(
      <ViewRegistryProvider>
        <ViewInputsProvider value={inputs as never}>
          <Harness layers={[probe]} onReady={(r) => { registry = r; }} />
          <Panel />
        </ViewInputsProvider>
      </ViewRegistryProvider>,
    );

    registry.list()[0]!.layer.draw({}, OUTER, DIMS);
    // The surface has one id selected and the panel has none, so the surface's
    // answer would be `true` and the panel's is `false`.
    expect(inputs.chromeCaps.isVisible({ selection: inputs.selectionApi.current } as never)('x'))
      .toBe(true);
    expect((seen as { getIsVisible(): (id: string) => boolean }).getIsVisible()('x')).toBe(false);
  });
});

describe('SceneCanvas views prop', () => {
  it('declares the same view a child would', () => {
    const outer = vi.fn();
    const panel = vi.fn();
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    const { container } = render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={300}
        height={200}
        onViewChange={outer}
        views={[{ id: 'panel', bounds: PANEL, onViewChange: panel }]}
      />,
    );

    wheelAt(container.querySelector('canvas')!, 150);

    expect(panel.mock.calls.at(-1)?.[0]).toMatchObject({ y: 20 });
    expect(outer).not.toHaveBeenCalled();
  });

  it('paints a later entry over an earlier one, and a child over both', () => {
    const scene = createScene<D, L, P>({ systemLayers: [{ id: 'main' }] });
    let registry!: ViewRegistry;
    function Peek() {
      const r = useOptionalViewRegistry()!;
      useEffect(() => { registry = r; }, [r]);
      return null;
    }
    render(
      <SceneCanvas
        scene={scene}
        layers={{}}
        width={300}
        height={200}
        views={[{ id: 'under', bounds: PANEL }, { id: 'over', bounds: PANEL }]}
      >
        <CanvasView id="child" bounds={PANEL} />
        <Peek />
      </SceneCanvas>,
    );

    expect(registry.list().map((r) => r.id)).toEqual(['under', 'over', 'child']);
  });
});

describe('<CanvasView> chrome', () => {
  const POSES: Record<string, Bounds> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 40, y: 0, width: 10, height: 10 },
  };

  /** The `ChromeState` a surface puts on the draw envelope. */
  const surfaceEnvelope = (selection: readonly string[]) => ({
    getChromeState: () => ({
      selection: selection as readonly NodeId[],
      multiActive: false,
      boundsOf: (id: string) => POSES[id] ?? null,
      unionBounds: null,
      modifiers: { alt: false, shift: false, meta: false, ctrl: false },
    }),
  });

  it('outlines the view\'s selection where the surface outlines its own', () => {
    const overlay = createSelectionOverlayLayer<Bounds>({
      getPose: (id) => POSES[id] ?? null,
      handles: false,
      outline: { paint: { fill: 'solid', color: '#fff' }, width: 1, pad: 0 },
    });
    let registry!: ViewRegistry;
    function Panel() {
      const selection = useSelection({ initial: ['b' as NodeId] });
      return <CanvasView id="panel" bounds={PANEL} selection={selection} />;
    }
    render(
      <ViewRegistryProvider>
        <Harness layers={[overlay]} onReady={(r) => { registry = r; }} />
        <Panel />
      </ViewRegistryProvider>,
    );

    const surfaceCmds = overlay.draw(surfaceEnvelope(['a']), OUTER, DIMS);
    const viewCmds = registry.list()[0]!.layer.draw(surfaceEnvelope(['a']), OUTER, DIMS);
    const inner = (viewCmds[0] as { children: unknown[] }).children;

    expect((surfaceCmds[0] as { path: { x: number } }).path.x).toBeCloseTo(POSES.a!.x, 5);
    expect((inner[0] as { path: { x: number } }).path.x).toBeCloseTo(POSES.b!.x, 5);
  });
});

describe('<CanvasView> hit-testing', () => {
  /** `b` sits at world x ∈ [40, 50), which the panel paints at client
   *  x ∈ [140, 150) — its camera is the identity and its rect starts at 100. */
  const POSES: Record<string, Bounds> = {
    a: { x: 0, y: 0, width: 10, height: 10 },
    b: { x: 40, y: 0, width: 10, height: 10 },
    // Big enough that the fine (8px) and coarse (14px) corner radii do not
    // overlap, so one point can distinguish them.
    c: { x: 20, y: 20, width: 40, height: 40 },
  };
  /** Stands in for the surface's selection, which a view shares by default. */
  const SURFACE_SELECTION = {
    current: [] as readonly NodeId[],
    get: () => [] as NodeId[],
    set: () => {},
    add: () => {}, remove: () => {}, toggle: () => {}, clear: () => {},
    contains: () => false,
    applyClick: () => {},
    adapterMethods: { getSelection: () => [] as NodeId[], setSelection: () => {} },
  };

  const INPUTS = {
    adapter: undefined,
    geometry: AUTO_POSE_DESCRIPTOR,
    boundsOf: (id: string) => POSES[id] ?? null,
    tools: undefined,
    pickBest: (wx: number, wy: number) => {
      for (const [id, b] of Object.entries(POSES)) {
        if (wx >= b.x && wx < b.x + b.width && wy >= b.y && wy < b.y + b.height) return id;
      }
      return null;
    },
    selectionApi: SURFACE_SELECTION,
  };

  function panelTarget(selected: readonly string[], device?: Partial<DeviceProfile>) {
    let registry!: ViewRegistry;
    function Panel() {
      const selection = useSelection({ initial: selected as readonly NodeId[] });
      return <CanvasView id="panel" bounds={PANEL} selection={selection} />;
    }
    render(
      <ViewRegistryProvider>
        <ViewInputsProvider value={INPUTS}>
          <DeviceProfileProvider {...(device ? { value: device } : {})}>
            <Harness layers={[]} onReady={(r) => { registry = r; }} />
            <Panel />
          </DeviceProfileProvider>
        </ViewInputsProvider>
      </ViewRegistryProvider>,
    );
    return registry.list()[0]!.target;
  }

  it('answers a resize handle for what this view has selected', () => {
    const hit = panelTarget(['b']).affordanceAt!({ x: 140, y: 0 });
    expect(hit?.kind).toBe('handle:top-left');
  });

  it('answers nothing where the surface selected but this view did not', () => {
    expect(panelTarget(['a']).affordanceAt!({ x: 140, y: 0 })).toBeNull();
  });

  it('classifies a body under the point in this view\'s coordinates', () => {
    expect(panelTarget(['b']).classifyTarget!({ x: 145, y: 5 }))
      .toMatchObject({ body: 'selected-body' });
  });

  // World (31, 22) is 11.2px from c's top-left corner — outside the 8px fine
  // radius, inside the 14px coarse one.
  const NEAR_CORNER = { x: 131, y: 22 };

  it('misses a corner handle 11px away under a fine pointer', () => {
    expect(panelTarget(['c'], { coarsePointer: false }).affordanceAt!(NEAR_CORNER)).toBeNull();
  });

  it('widens the corner hit radius under a coarse pointer', () => {
    const hit = panelTarget(['c'], { coarsePointer: true }).affordanceAt!(NEAR_CORNER);
    expect(hit?.kind).toBe('handle:top-left');
  });
});

describe('<CanvasView> selection', () => {
  /** The registration a view contributed, driven without a real surface. */
  function registrationFor(node: React.ReactNode) {
    let registry!: ViewRegistry;
    render(
      <ViewRegistryProvider>
        <Harness layers={[]} onReady={(r) => { registry = r; }} />
        {node}
      </ViewRegistryProvider>,
    );
    return registry.list()[0]!;
  }

  it('shares the surface selection unless asked for its own', () => {
    const reg = registrationFor(<CanvasView id="panel" bounds={PANEL} />);

    expect(reg.target.deps!().selection).toBeUndefined();
  });

  it('overlays a selection of its own when selectionOptions asks for one', () => {
    const reg = registrationFor(
      <CanvasView id="panel" bounds={PANEL} selectionOptions={{ mode: 'multi' }} />,
    );
    const own = reg.target.deps!().selection!;

    expect(own.get()).toEqual([]);
    act(() => { own.set(['a' as NodeId]); });
    expect(reg.target.deps!().selection!.get()).toEqual(['a']);
  });

  it('overlays a supplied selection instead of owning one', () => {
    let api!: SelectionApi;
    function Supplied() {
      api = useSelection({ initial: ['seed' as NodeId] });
      return <CanvasView id="panel" bounds={PANEL} selection={api} />;
    }
    const reg = registrationFor(<Supplied />);

    expect(reg.target.deps!().selection).toBe(api);
    expect(reg.target.deps!().selection!.get()).toEqual(['seed']);
  });
});
