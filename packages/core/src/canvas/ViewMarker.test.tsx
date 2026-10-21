/**
 * A `<ViewMarker>` on a surface: drawn in its target view's frame, after that
 * view's own layers, whether declared as an element or by a contribution.
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, type RefObject } from 'react';
import type { DrawCommand } from '@weasel-js/renderer';
import { SceneCanvas } from './SceneCanvas';
import { useOptionalViewRegistry, type ViewRegistry } from './viewRegistry';
import { ViewMarker } from './ViewMarker';
import { createScene } from 'core/scene/scene';
import { mergeContributions, type SurfaceContribution } from './surfaceContribution';
import type { CanvasViewHandle, SceneCanvasApi } from './canvasExtension';
import type { CanvasViewProps } from './canvasViewProps';
import type { View } from 'core/viewport/view';
import type { ViewMarkerProps } from 'features/viewports/viewMarker';
import { rectAim } from 'features/viewports/aim';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };
const DIMS = { width: 400, height: 300 };
const PIP: CanvasViewProps = {
  id: 'pip', bounds: { x: 250, y: 180, w: 140, h: 105 }, defaultView: { x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }, paint: false,
};
const INNER: CanvasViewProps = {
  id: 'inner', parent: 'pip', bounds: { x: 10, y: 10, w: 40, h: 30 }, defaultView: { x: 0, y: 0, scale: { x: 0.1, y: 0.1 } }, paint: false,
};
const MARKER: ViewMarkerProps = { id: 'm', source: null, target: 'pip' };
const MARKER_PATH = { kind: 'path', stroke: { width: 1, dash: [2, 3] } };

const widthDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientWidth');
const heightDesc = Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'clientHeight');

beforeAll(() => {
  const proto = HTMLCanvasElement.prototype as unknown as Record<string, unknown>;
  proto.getContext = vi.fn(() => null);
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  Object.defineProperty(HTMLElement.prototype, 'clientWidth', { configurable: true, get: () => 400 });
  Object.defineProperty(HTMLElement.prototype, 'clientHeight', { configurable: true, get: () => 300 });
});
afterAll(() => {
  if (widthDesc) Object.defineProperty(HTMLElement.prototype, 'clientWidth', widthDesc);
  if (heightDesc) Object.defineProperty(HTMLElement.prototype, 'clientHeight', heightDesc);
});

function mount(opts: { marker?: boolean; ambient?: SurfaceContribution[] }): RefObject<SceneCanvasApi | null> {
  const api = createRef<SceneCanvasApi>();
  const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  render(
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} ref={api} ambient={opts.ambient ?? []}>
      {opts.marker ? <ViewMarker {...MARKER} /> : null}
    </SceneCanvas>,
  );
  return api;
}

function add(api: RefObject<SceneCanvasApi | null>, props: CanvasViewProps): CanvasViewHandle {
  let handle: CanvasViewHandle | undefined;
  act(() => { handle = api.current!.addView(props); });
  return handle!;
}

function lastDrawn(handle: CanvasViewHandle): DrawCommand | undefined {
  const [group] = handle.draw({}, ROOT, DIMS);
  return group?.kind === 'group' ? group.children.at(-1) : undefined;
}

function flat(cmds: readonly DrawCommand[]): DrawCommand[] {
  return cmds.flatMap((c) => (c.kind === 'group' ? [c, ...flat(c.children)] : [c]));
}

describe('<ViewMarker>', () => {
  it("paints in its target view, after the view's own layers", () => {
    const api = mount({ marker: true });
    expect(lastDrawn(add(api, PIP))).toMatchObject(MARKER_PATH);
  });

  it('does not paint in a view nested in its target', () => {
    const api = mount({ marker: true });
    add(api, PIP);
    const inner = add(api, INNER);
    const drawn = flat(inner.draw({}, ROOT, DIMS));
    expect(drawn.length).toBeGreaterThan(0);
    expect(drawn.filter((c) => c.kind === 'path' && c.stroke?.dash !== undefined)).toEqual([]);
  });

  it('mounts before its target view', () => {
    const api = mount({ marker: true });
    expect(api.current!.aimOf('pip')).toBeNull();
    expect(lastDrawn(add(api, PIP))).toMatchObject(MARKER_PATH);
  });

  it("is installed by a contribution's markers", () => {
    const api = mount({ ambient: [{ id: 'c', eligibility: { always: true }, markers: [MARKER] }] });
    expect(lastDrawn(add(api, PIP))).toMatchObject(MARKER_PATH);
  });

  it('rejects a duplicate marker id', () => {
    const m = MARKER;
    expect(() => mergeContributions(
      [{ id: 'a', eligibility: { always: true }, markers: [m] }],
      [{ id: 'b', eligibility: { always: true }, markers: [m] }],
    )).toThrow(/marker "m"/);
  });

  // A press routes to a marker by id, so the second of two live markers sharing one is skipped.
  it('skips a marker whose id is already live on the surface, keeping the first', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      let registry: ViewRegistry | null = null;
      function Probe() {
        registry = useOptionalViewRegistry();
        return null;
      }
      const elsewhere = { aim: () => rectAim(null, { x: 450, y: 330, width: 100, height: 80 }), setAim: vi.fn() };
      const api = createRef<SceneCanvasApi>();
      const scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
      const surface = (second: boolean) => (
        <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} ref={api}>
          <Probe />
          <ViewMarker {...MARKER} style={{ stroke: '#ff0000' }} />
          {second ? <ViewMarker {...MARKER} source={elsewhere} style={{ stroke: '#00ff00' }} /> : null}
        </SceneCanvas>
      );
      const r = render(surface(true));
      expect(error).toHaveBeenCalledWith(expect.stringContaining('marker "m" is already on this surface'));
      const pip = add(api, PIP);
      const strokes = () => flat(pip.draw({}, ROOT, DIMS))
        .flatMap((c) => (c.kind === 'path' && c.stroke?.dash ? [c.stroke.paint] : []));
      expect(strokes()).toEqual([{ kind: 'solid', color: '#ff0000' }]);
      expect(registry!.markerAt('pip', { x: 200, y: 150 })).not.toBeNull();
      expect(registry!.markerAt('pip', { x: 500, y: 370 })).toBeNull();

      r.rerender(surface(false));
      expect(strokes()).toEqual([{ kind: 'solid', color: '#ff0000' }]);
    } finally {
      error.mockRestore();
    }
  });
});
