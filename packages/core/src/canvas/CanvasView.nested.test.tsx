/**
 * A view placed inside another: its rect is measured from the outer view's,
 * its camera derives from the outer view's, and input and painting descend to
 * it before the outer view.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import type { NodeId } from 'core/scene/types';
import type { View } from 'core/viewport/view';
import type { GroupDrawCommand } from '@weasel-js/renderer';
import type { SceneCanvasApi } from './canvasExtension';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

/** The panel covers canvas (100..300, 0..200) and looks at world (1000, 0). */
const PANEL = { x: 100, y: 0, w: 200, h: 200 };
const PANEL_VIEW: View = { x: 1000, y: 0, scale: { x: 1, y: 1 } };

/** The inset sits 50px into the panel — canvas (150, 50) — and looks 1000
 *  further on at twice the panel's zoom: world (2000, 0) at 2×. */
const INSET = { x: 50, y: 50, w: 100, h: 100 };
const insetCamera = (outer: View): View => ({
  x: outer.x + 1000, y: outer.y, scale: { x: outer.scale.x * 2, y: outer.scale.y * 2 },
});

/** Canvas (180, 80) is inset-local (30, 30), world (2015, 15) through the
 *  inset — on `inInset`. Through the panel alone it is world (1080, 80), on
 *  `inPanel`, and on the canvas's own camera world (180, 80), on `underAll`. */
const PRESS = { x: 180, y: 80 };

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
});

function makeScene() {
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  const rect = (x: number, y: number) => scene.add({
    kind: 'leaf', layer: 'main', pose: { x, y, width: 10, height: 10 }, data: { kind: 'rect' },
  });
  return { scene, inInset: rect(2010, 10), inPanel: rect(1075, 75), underAll: rect(175, 75) };
}

function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));
}

function press(el: Element, at: { x: number; y: number }, dx = 0) {
  act(() => {
    pointer(el, 'pointerdown', at.x, at.y);
    if (dx !== 0) {
      pointer(el, 'pointermove', at.x + dx / 2, at.y);
      pointer(el, 'pointermove', at.x + dx, at.y);
    }
    pointer(el, 'pointerup', at.x + dx, at.y);
  });
}

function mount(opts: { insetFirst?: boolean; inset?: typeof INSET; panelHides?: boolean } = {}) {
  const s = makeScene();
  const ref = createRef<SceneCanvasApi>();
  let registry: ViewRegistry | null = null;
  function Probe() {
    const r = useOptionalViewRegistry();
    useEffect(() => { registry = r; });
    return null;
  }
  const inset = <CanvasView key="inset" id="inset" parent="panel" bounds={opts.inset ?? INSET} view={insetCamera} />;
  const panel = (
    <CanvasView key="panel" id="panel" bounds={PANEL} defaultView={PANEL_VIEW}
      {...(opts.panelHides ? { layerVisibility: { 'scene:main': false } } : {})} />
  );
  const r = render(
    <SceneCanvas features={['draw']} ref={ref} scene={s.scene} layers={{}} width={400} height={300}>
      {opts.insetFirst ? [inset, panel] : [panel, inset]}
      <Probe />
    </SceneCanvas>,
  );
  return { ...s, canvas: r.container.querySelector('canvas')!, api: () => ref.current!, registry: () => registry! };
}

describe('a click inside a nested view', () => {
  it('selects what the nested view shows, not the view around it', () => {
    const h = mount();
    press(h.canvas, PRESS);
    expect(h.scene.getSelection()).toEqual([h.inInset]);
  });

  it('drags in the nested view’s world units: 40px at 2× is 20', () => {
    const h = mount();
    press(h.canvas, PRESS, 40);
    expect(h.scene.nodes.get(h.inInset as NodeId)!.pose).toMatchObject({ x: 2030, y: 10 });
  });

  it('lands in the nested view even when it mounted before the view around it', () => {
    const h = mount({ insetFirst: true });
    expect(h.registry().list().map((r) => r.id)).toEqual(['panel', 'inset']);
    press(h.canvas, PRESS);
    expect(h.scene.getSelection()).toEqual([h.inInset]);
  });

  it('leaves the view around it its own points', () => {
    const h = mount();
    expect(h.registry().resolver.at(null, 120, 20)).toMatchObject({ id: 'panel', world: { x: 1020, y: 20 } });
  });
});

describe('a nested view overhanging the view around it', () => {
  /** Panel-local (150, 0): canvas (250..350), of which only (250..300) is on the panel. */
  const OVERHANG = { x: 150, y: 0, w: 100, h: 100 };

  it('takes input only where the outer view shows it', () => {
    const h = mount({ inset: OVERHANG });
    expect(h.registry().resolver.at(null, 260, 20).id).toBe('inset');
    expect(h.registry().resolver.at(null, 320, 20).id).toBeNull();
  });

  it('paints clipped to the outer view, after it', () => {
    const h = mount({ inset: OVERHANG });
    const inset = h.registry().list().find((r) => r.id === 'inset')!;
    const outer: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
    const [group] = inset.layer.draw({}, outer, { width: 400, height: 300 });
    expect(group).toMatchObject({ kind: 'group', clip: { x: 0, y: 0, width: 50, height: 100 } });
    expect((group as GroupDrawCommand).transform![6]).toBe(250);
  });
});

describe('a nested view paints what the view around it paints', () => {
  it('passes over a scene layer the outer view hides', () => {
    const h = mount({ panelHides: true });
    const inset = h.registry().list().find((r) => r.id === 'inset')!;
    expect(inset.layerIsPainted('main')).toBe(false);
  });
});

describe('SceneCanvasApi.viewAt', () => {
  it('descends to the innermost view under a point', () => {
    const h = mount();
    expect(h.api().viewAt(PRESS)).toMatchObject({
      id: 'inset', view: { x: 2000, y: 0, scale: { x: 2, y: 2 } }, rect: { x: 150, y: 50, w: 100, h: 100 },
    });
  });

  it('passes over the view it is told to', () => {
    const h = mount();
    expect(h.api().viewAt(PRESS, { except: 'inset' })).toMatchObject({ id: 'panel', view: PANEL_VIEW });
  });

  it('answers with the canvas itself where no view is', () => {
    const h = mount();
    expect(h.api().viewAt({ x: 20, y: 20 })).toMatchObject({
      id: null, view: { x: 0, y: 0 }, rect: { x: 0, y: 0, w: 400, h: 300 },
    });
  });
});
