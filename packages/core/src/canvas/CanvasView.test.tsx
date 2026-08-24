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

  it('overlays a selection of its own onto the dep registry', () => {
    const reg = registrationFor(<CanvasView id="panel" bounds={PANEL} />);
    const own = reg.target.deps!().selection!;

    expect(own.get()).toEqual([]);
    act(() => { own.set(['a']); });
    expect(reg.target.deps!().selection!.get()).toEqual(['a']);
  });

  it('overlays a supplied selection instead of owning one', () => {
    let api!: SelectionApi;
    function Supplied() {
      api = useSelection({ initial: ['seed'] });
      return <CanvasView id="panel" bounds={PANEL} selection={api} />;
    }
    const reg = registrationFor(<Supplied />);

    expect(reg.target.deps!().selection).toBe(api);
    expect(reg.target.deps!().selection!.get()).toEqual(['seed']);
  });
});
