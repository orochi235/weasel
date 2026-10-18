/**
 * A layer one view hides is gone from that view only — not painted there, and
 * not something a click, a marquee or Cmd+A can reach there — while another
 * view of the same scene paints and picks it as usual.
 *
 * Paint is read off the command list the renderer is handed; `WeaselRenderer`
 * is replaced by a recorder so `<Canvas>` gets past its WebGL bail-out.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { act } from '@testing-library/react';
import { giveKeys, renderWithKeys as render } from '@weasel-js/react/testing/giveKeys';
import { useEffect, useRef, type ReactNode } from 'react';
import { createScene } from 'core/scene/scene';
import { asNodeId, type Node, type Scene } from 'core/scene/types';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import type { DrawCommand, GroupDrawCommand } from '@weasel-js/renderer';
import type { RenderLayer } from 'core/layers/render';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { SceneCanvas } from './SceneCanvas';
import type { SceneCanvasApi } from './canvasExtension';
import type { CanvasHelpers } from './useViewHelpers';

const painted = vi.hoisted(() => new Map<unknown, readonly unknown[]>());

vi.mock('@weasel-js/renderer', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@weasel-js/renderer')>()),
  WeaselRenderer: class {
    private readonly target: unknown;
    constructor(opts: { canvas?: unknown }) { this.target = opts.canvas; }
    render(commands: readonly unknown[]): void { painted.set(this.target, commands); }
    resize(): void {}
    setTarget(): void {}
    dispose(): void {}
    registerProgram(): void {}
  },
}));

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  const gl = { enable: () => {} };
  proto.getContext = function getContext(kind: string) { return kind === 'webgl2' ? gl : null; };
  proto.setPointerCapture = () => {};
  proto.releasePointerCapture = () => {};
});

beforeEach(() => { painted.clear(); });

type D = { color: string };
type L = 'base' | 'fx';
type P = { x: number; y: number; width: number; height: number };

const BASE = '#0000ff';
const FX = '#ff0000';

function makeScene(): Scene<D, L, P> {
  const s = createScene<D, L, P>({ systemLayers: [{ id: 'base' }] });
  s.addLayer({ id: 'fx', name: 'Effects' });
  s.add({ kind: 'leaf', id: asNodeId('a'), layer: 'base', data: { color: BASE }, pose: { x: 0, y: 20, width: 50, height: 50 } });
  s.add({ kind: 'leaf', id: asNodeId('b'), layer: 'fx', data: { color: FX }, pose: { x: 100, y: 20, width: 50, height: 50 } });
  return s;
}

const LAYERS = {
  scene: {
    drawOne: (n: Node<D, L, P>, p: P): DrawCommand[] => [{
      kind: 'path',
      path: { kind: 'rect', x: p.x, y: p.y, width: p.width, height: p.height },
      fill: { paint: { color: n.data.color } },
    }],
  },
};

const HIDE_FX = { 'scene:fx': false };

function colorsIn(cmds: readonly unknown[] | undefined): string[] {
  const out: string[] = [];
  const walk = (list: readonly unknown[]): void => {
    for (const c of list as DrawCommand[]) {
      if (c.kind === 'group') walk((c as GroupDrawCommand).children ?? []);
      else {
        const color = (c as { fill?: { paint?: { color?: string } } }).fill?.paint?.color;
        if (color) out.push(color);
      }
    }
  };
  walk(cmds ?? []);
  return out;
}

const nextFrame = () => act(async () => {
  await new Promise<void>((r) => requestAnimationFrame(() => r()));
});

function pointer(el: Element, type: string, x: number, y: number): void {
  el.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, button: 0 }));
}

function click(el: Element, x: number, y: number): void {
  act(() => { pointer(el, 'pointerdown', x, y); pointer(el, 'pointerup', x, y); });
}

function marquee(el: Element, from: [number, number], to: [number, number]): void {
  act(() => { pointer(el, 'pointerdown', from[0], from[1]); });
  act(() => { pointer(el, 'pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2); });
  act(() => { pointer(el, 'pointermove', to[0], to[1]); });
  act(() => { pointer(el, 'pointerup', to[0], to[1]); });
}

describe('<SceneCanvas layerVisibility> hides a layer in that view only', () => {
  const selections: Record<'hidden' | 'shown', SelectionApi | null> = { hidden: null, shown: null };

  function Pair({ scene }: { scene: Scene<D, L, P> }): ReactNode {
    const hidden = useSelection({ mode: 'multi' });
    const shown = useSelection({ mode: 'multi' });
    selections.hidden = hidden;
    selections.shown = shown;
    return (
      <>
        <div data-view="hidden">
          <SceneCanvas features={['draw']} scene={scene} selection={hidden} width={300} height={200}
            layers={LAYERS} layerVisibility={HIDE_FX} />
        </div>
        <div data-view="shown">
          <SceneCanvas features={['draw']} scene={scene} selection={shown} width={300} height={200}
            layers={LAYERS} />
        </div>
      </>
    );
  }

  function mount() {
    const scene = makeScene();
    const { container } = render(<Pair scene={scene} />);
    const canvasOf = (v: string) => container.querySelector(`[data-view="${v}"] canvas`)!;
    return { hidden: canvasOf('hidden'), shown: canvasOf('shown') };
  }

  it('does not paint the layer in the view that hides it; the other view does', async () => {
    const { hidden, shown } = mount();
    await nextFrame();

    expect(colorsIn(painted.get(hidden))).toEqual([BASE]);
    expect(colorsIn(painted.get(shown))).toEqual([BASE, FX]);
  });

  it('a click on the hidden node selects nothing there, and selects it in the other view', () => {
    const { hidden, shown } = mount();

    click(hidden, 125, 45);
    expect(selections.hidden!.current).toEqual([]);

    click(shown, 125, 45);
    expect(selections.shown!.current).toEqual(['b']);
  });

  it('a marquee over both nodes takes only the painted one in the hiding view', () => {
    const { hidden, shown } = mount();

    marquee(hidden, [-10, 5], [170, 90]);
    expect(selections.hidden!.current).toEqual(['a']);

    marquee(shown, [-10, 5], [170, 90]);
    expect([...selections.shown!.current].sort()).toEqual(['a', 'b']);
  });

  it('select-all leaves the hidden layer out in the view that hides it', () => {
    const { hidden, shown } = mount();
    const selectAll = (): void => {
      act(() => {
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'a', ctrlKey: true, bubbles: true }));
      });
    };

    // A key goes to the canvas last pressed in, so each is asked in turn.
    giveKeys(hidden);
    selectAll();
    expect(selections.hidden!.current).toEqual(['a']);

    giveKeys(shown);
    selectAll();
    expect(selections.shown!.current).toEqual(['a', 'b']);
  });

  it('never shows a layer the scene itself hides', async () => {
    const scene = makeScene();
    scene.setLayerVisible('fx', false);
    const { container } = render(
      <SceneCanvas features={['draw']} scene={scene} width={300} height={200} layers={LAYERS}
        layerVisibility={{ 'scene:fx': true }} />,
    );
    await nextFrame();
    expect(colorsIn(painted.get(container.querySelector('canvas')))).toEqual([BASE]);
  });
});

describe('<CanvasView layerVisibility> hides a layer in that view only', () => {
  const onlyScene = (s: readonly RenderLayer<unknown>[]) => s.filter((l) => l.id.startsWith('scene:'));

  it('the panel neither paints nor picks the layer it hides; the surface does both', async () => {
    let registry!: ViewRegistry;
    function Probe(): null {
      const r = useOptionalViewRegistry();
      useEffect(() => { registry = r!; });
      return null;
    }
    let selection!: SelectionApi;
    function Host(): ReactNode {
      selection = useSelection({ mode: 'multi' });
      return (
        <SceneCanvas features={['draw']} scene={makeScene()} selection={selection} width={800} height={800} layers={LAYERS}
          views={[{
            id: 'panel', bounds: { x: 500, y: 500, w: 200, h: 200 },
            layers: onlyScene, layerVisibility: HIDE_FX,
          }]}>
          <Probe />
        </SceneCanvas>
      );
    }
    const { container } = render(<Host />);
    await nextFrame();

    const panel = registry.list().find((r) => r.id === 'panel')!;
    const outer = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    expect(colorsIn(panel.layer.draw({}, outer, { width: 800, height: 800 }))).toEqual([BASE]);
    expect(panel.target.classifyTarget!({ x: 125, y: 45 })).toEqual({ body: 'empty' });
    expect(panel.target.classifyTarget!({ x: 25, y: 45 }).body).toBe('unselected-body');

    const canvas = container.querySelector('canvas')!;
    expect(colorsIn(painted.get(canvas))).toContain(FX);
    click(canvas, 125, 45);
    expect(selection.current).toEqual(['b']);
  });
});

describe('the chrome state a layer draws with answers for its own view', () => {
  /** What each view's chrome state said about `fx`, keyed by view id. */
  function probe() {
    const said = new Map<string | null, boolean>();
    const layer: RenderLayer<unknown> = {
      id: 'probe',
      label: 'Probe',
      draw: (data) => {
        const { viewId, getChromeState } = data as CanvasHelpers<unknown>;
        said.set(viewId, getChromeState().layerIsPainted?.('fx') ?? true);
        return [];
      },
    };
    return { said, layer };
  }

  it('says a layer the surface hides is not painted there', async () => {
    const { said, layer } = probe();
    function Host(): ReactNode {
      const ref = useRef<SceneCanvasApi>(null);
      useEffect(() => ref.current?.registerLayer(layer), []);
      return <SceneCanvas ref={ref} features={['draw']} scene={makeScene()} width={300} height={200}
        layers={LAYERS} layerVisibility={HIDE_FX} />;
    }
    render(<Host />);
    await nextFrame();
    expect(said.get(null)).toBe(false);
  });

  it('says a layer one panel hides is not painted in that panel, and is on the surface', async () => {
    const { said, layer } = probe();
    let registry!: ViewRegistry;
    // A slot layer: the surface paints registered layers over its views, not in them.
    function Host(): ReactNode {
      return (
        <SceneCanvas features={['draw']} scene={makeScene()} width={800} height={800}
          layers={{ ...LAYERS, probe: { layer } }}
          views={[{ id: 'panel', bounds: { x: 500, y: 500, w: 200, h: 200 }, layerVisibility: HIDE_FX }]}>
          <RegistryOut set={(found) => { registry = found; }} />
        </SceneCanvas>
      );
    }
    render(<Host />);
    await nextFrame();
    const panel = registry.list().find((v) => v.id === 'panel')!;
    panel.layer.draw({}, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 800, height: 800 });
    expect(said.get('panel')).toBe(false);
    expect(said.get(null)).toBe(true);
  });
});

function RegistryOut({ set }: { set: (r: ViewRegistry) => void }): null {
  const r = useOptionalViewRegistry();
  useEffect(() => { if (r) set(r); });
  return null;
}

describe('selection chrome stays off a layer a panel hides', () => {
  /** `b`, on `fx`, selected on the surface; the panel hides `fx` or not. */
  async function panelWith(layerVisibility: Record<string, boolean> | undefined) {
    let registry!: ViewRegistry;
    function Host(): ReactNode {
      const selection = useSelection({ mode: 'multi', initial: [asNodeId('b')] });
      return (
        <SceneCanvas features={['draw']} scene={makeScene()} selection={selection} width={800} height={800}
          layers={LAYERS}
          views={[{
            id: 'panel', bounds: { x: 0, y: 0, w: 400, h: 400 },
            ...(layerVisibility ? { layerVisibility } : {}),
          }]}>
          <RegistryOut set={(found) => { registry = found; }} />
        </SceneCanvas>
      );
    }
    render(<Host />);
    await nextFrame();
    const panel = registry.list().find((v) => v.id === 'panel')!;
    const drawn = panel.layer.draw({}, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 800, height: 800 });
    return { panel, drawn: JSON.stringify(drawn) };
  }

  it('draws no outline or handles for it there', async () => {
    const hiding = await panelWith(HIDE_FX);
    const bare = await panelWith({ 'scene:fx': false, 'selection-overlay': false });
    expect(hiding.drawn).toBe(bare.drawn);
  });

  it('offers no handle to grab on it there', async () => {
    const shown = await panelWith(undefined);
    const hiding = await panelWith(HIDE_FX);
    // `b`'s bottom-right corner handle.
    expect(shown.panel.target.affordanceAt!({ x: 150, y: 70 })).not.toBeNull();
    expect(hiding.panel.target.affordanceAt!({ x: 150, y: 70 })).toBeNull();
  });
});
