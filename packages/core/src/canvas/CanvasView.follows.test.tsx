/**
 * A view that `follows` another paints the layers that view paints — as a nested view does its parent's — while
 * keeping its own rect and camera, measured on the surface.
 */
import { describe, it, expect, vi, beforeAll } from 'vitest';
import { act, render } from '@testing-library/react';
import { useEffect } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { createScene } from 'core/scene/scene';
import { IDENTITY_POSE_COMPOSITION } from 'core/scene/composeFrame';
import type { View } from 'core/viewport/view';
import type { NodeId } from 'core/scene/types';
import type { RenderLayer } from 'core/layers/render';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
});

const PANEL = { x: 100, y: 0, w: 200, h: 200 };
const LENS = { x: 10, y: 220, w: 60, h: 60 };
const LENS_VIEW: View = { x: 500, y: 500, scale: { x: 3, y: 3 } };

function mount(follows: () => string | null, lensHides = false) {
  const scene = createScene<unknown, 'main' | 'notes', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }, { id: 'notes' }] });
  let registry: ViewRegistry | null = null;
  function Probe() {
    const r = useOptionalViewRegistry();
    useEffect(() => { registry = r; });
    return null;
  }
  render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300}>
      <CanvasView id="panel" bounds={PANEL} defaultView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
        layerVisibility={{ 'scene:main': false }} />
      <CanvasView id="lens" bounds={LENS} view={() => LENS_VIEW} follows={follows}
        {...(lensHides ? { layerVisibility: { 'scene:notes': false } } : {})} />
      <CanvasView id="loop-a" bounds={LENS} view={() => LENS_VIEW} follows={() => 'loop-b'} />
      <CanvasView id="loop-b" bounds={LENS} view={() => LENS_VIEW} follows={() => 'loop-a'} />
      <Probe />
    </SceneCanvas>,
  );
  const reg = (id: string) => registry!.get(id)!;
  const drawn = (id: string) => reg(id).drawnLayers().map((l) => l.id);
  return { reg, drawn };
}

describe('<CanvasView follows>', () => {
  it('paints and picks only what the followed view paints', () => {
    const h = mount(() => 'panel');
    expect(h.reg('lens').layerIsPainted('main')).toBe(false);
    expect(h.reg('lens').layerIsPainted('notes')).toBe(true);
    expect(h.drawn('lens')).toEqual(h.drawn('panel'));
  });

  it('narrows what it follows by its own layer visibility', () => {
    const h = mount(() => 'panel', true);
    expect(h.reg('lens').layerIsPainted('notes')).toBe(false);
    expect(h.drawn('lens')).not.toContain('scene:notes');
  });

  it("reads the view to follow at each ask, and paints the surface's layers when it names none", () => {
    let target: string | null = 'panel';
    const h = mount(() => target);
    expect(h.reg('lens').layerIsPainted('main')).toBe(false);
    target = null;
    expect(h.reg('lens').layerIsPainted('main')).toBe(true);
    target = 'nowhere';
    expect(h.reg('lens').layerIsPainted('main')).toBe(true);
  });

  it('keeps its own rect and camera, measured on the surface', () => {
    const h = mount(() => 'panel');
    const r = h.reg('lens').layer.resolvable({ x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300 });
    expect(r.rect).toEqual(LENS);
    expect(r.view).toEqual(LENS_VIEW);
  });

  it('two views following each other paint what the surface paints rather than recurse', () => {
    const h = mount(() => null);
    expect(h.reg('loop-a').layerIsPainted('main')).toBe(true);
    expect(h.drawn('loop-a').length).toBeGreaterThan(0);
  });

  it('acts on and draws the selection of the view it follows, while that view owns one', () => {
    const scene = createScene<unknown, 'main', unknown>({ composition: IDENTITY_POSE_COMPOSITION, systemLayers: [{ id: 'main' }] });
    let registry: ViewRegistry | null = null;
    function Probe() {
      const r = useOptionalViewRegistry();
      useEffect(() => { registry = r; });
      return null;
    }
    let seen: unknown = null;
    const probe: RenderLayer<unknown> = { id: 'probe', label: 'probe', draw: (data) => { seen = data; return []; } };
    let target: string | null = 'owner';
    render(
      <SceneCanvas scene={scene} layers={{ probe: { layer: probe } }} width={400} height={300}>
        <CanvasView id="owner" bounds={PANEL} defaultView={{ x: 0, y: 0, scale: { x: 1, y: 1 } }}
          selectionOptions={{ initial: ['p' as NodeId] }} />
        <CanvasView id="lens" bounds={LENS} view={() => LENS_VIEW} follows={() => target} />
        <Probe />
      </SceneCanvas>,
    );
    act(() => { scene.setSelection(['s' as NodeId]); });
    const lens = registry!.get('lens')!;
    const chromeSelection = () => {
      lens.layer.draw({}, { x: 0, y: 0, scale: { x: 1, y: 1 } }, { width: 400, height: 300, dpr: 1 });
      return (seen as { getChromeState(): { selection: readonly NodeId[] } }).getChromeState().selection;
    };

    const panelSelection = registry!.get('owner')!.target.deps!().selection!;
    expect(lens.target.deps!().selection).toBe(panelSelection);
    expect(chromeSelection()).toEqual(['p']);
    act(() => { panelSelection.set(['q' as NodeId]); });
    expect(chromeSelection()).toEqual(['q']);

    target = null;
    expect(lens.target.deps!().selection).toBeUndefined();
    expect(chromeSelection()).toEqual(['s']);
  });
});
