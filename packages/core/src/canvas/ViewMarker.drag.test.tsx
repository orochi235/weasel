/**
 * Dragging a view marker edits its source's aim: a PiP shows the root view's
 * aim, and dragging that outline pans the root camera — with no minimap code
 * anywhere in the surface.
 *
 * jsdom has no GL, and `setPointerCapture` is a stub here, so these assert
 * camera writes. A drag that leaves the PiP keeps routing to it because the
 * view resolver is sticky for the pressed pointer, not because of capture.
 */
import { describe, it, expect, vi, beforeAll, afterAll, beforeEach, type Mock } from 'vitest';
import { render, act } from '@testing-library/react';
import { createRef, useEffect, type ReactNode } from 'react';
import { SceneCanvas } from './SceneCanvas';
import { CanvasView } from './CanvasView';
import { ViewMarker } from './ViewMarker';
import { createScene } from 'core/scene/scene';
import { useSelection, type SelectionApi } from 'core/selection/useSelection';
import { useSceneAdapter } from './useSceneAdapter';
import { useSelectTool } from '../tools/builtin/select/useSelectTool';
import { useTools, type ToolsApi } from '../tools/overlayBinding';
import { WeaselProvider } from '../WeaselProvider';
import type { SceneCanvasProps } from './SceneCanvas/props';
import type { CanvasViewCamera, SceneCanvasApi } from './canvasExtension';
import type { View } from 'core/viewport/view';
import type { NodeId } from 'core/scene/types';
import type { ViewMarkerProps } from 'features/viewports/viewMarker';
import { createViewMarkerContribution } from 'features/viewports/viewMarkerDrag';

type D = { kind: 'rect' };
type P = { x: number; y: number; width: number; height: number };

const ROOT: View = { x: 0, y: 0, scale: { x: 1, y: 1 } };

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

function pointer(el: Element, type: string, x: number, y: number) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true, pointerId: 1, clientX: x, clientY: y,
    button: 0, buttons: type === 'pointerup' ? 0 : 1,
  }));
}

const last = (fn: Mock<(next: View) => void>): View => fn.mock.calls.at(-1)![0];

let scene: ReturnType<typeof createScene<D, 'main', P>>;
let onViewChange: Mock<(next: View) => void>;
let api: ReturnType<typeof createRef<SceneCanvasApi>>;
let pip: ReturnType<typeof createRef<CanvasViewCamera>>;
let canvas: HTMLCanvasElement;
let selection: SelectionApi | null;
let node: NodeId;

beforeEach(() => {
  scene = createScene<D, 'main', P>({ systemLayers: [{ id: 'main' }] });
  // Under the marker's press point in the PiP (world 200, 80): a select tool
  // that saw the press would select it.
  node = scene.add({ kind: 'mark', layer: 'main', pose: { x: 180, y: 60, width: 40, height: 40 }, data: { kind: 'rect' } });
  onViewChange = vi.fn<(next: View) => void>();
  api = createRef<SceneCanvasApi>();
  pip = createRef<CanvasViewCamera>();
  selection = null;
});

function Selected({ children }: { children: (s: SelectionApi) => ReactNode }) {
  const s = useSelection({ initial: [] });
  useEffect(() => { selection = s; });
  return <>{children(s)}</>;
}

const MARKER_DRAG_ENTRY = createViewMarkerContribution();

/** A consumer-assembled tool set: the select tool alone, handed in as a takeover. */
function Takeover({ s, markerDrag, children }: { s: SelectionApi; markerDrag?: boolean; children: (tools: ToolsApi) => ReactNode }) {
  const adapter = useSceneAdapter(scene, { selection: s });
  const select = useSelectTool(adapter, {});
  const tools = useTools({ active: 'select', registry: { select }, ...(markerDrag ? { ambient: [MARKER_DRAG_ENTRY] } : {}) });
  return <>{children(tools)}</>;
}

function mount(
  extra: Partial<SceneCanvasProps<D, 'main', P>> = {},
  opts: { rootAim?: Partial<ViewMarkerProps>; markers?: ReactNode; takeover?: boolean; markerDrag?: boolean } = {},
) {
  const surface = (s: SelectionApi, tools?: ToolsApi) => (
    <SceneCanvas scene={scene} layers={{}} width={400} height={300} view={ROOT} onViewChange={onViewChange} ref={api} selection={s} {...(tools ? { tools } : {})} {...extra}>
      <CanvasView id="pip" bounds={{ x: 250, y: 180, w: 140, h: 105 }} defaultView={{ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } }} cameraRef={pip} />
      <ViewMarker id="root-aim" source={null} target="pip" {...opts.rootAim} />
      {opts.markers}
    </SceneCanvas>
  );
  const r = render(
    <WeaselProvider>
      <Selected>
        {(s) => (opts.takeover ? <Takeover s={s} markerDrag={opts.markerDrag}>{(tools) => surface(s, tools)}</Takeover> : surface(s))}
      </Selected>
    </WeaselProvider>,
  );
  canvas = r.container.querySelector('canvas')!;
}

const drag = (from: [number, number], to: [number, number]) => act(() => {
  pointer(canvas, 'pointerdown', ...from);
  pointer(canvas, 'pointermove', (from[0] + to[0]) / 2, (from[1] + to[1]) / 2);
  pointer(canvas, 'pointermove', ...to);
  pointer(canvas, 'pointerup', ...to);
});

describe('dragging a view marker', () => {
  it('pans the root camera when the marker is dragged in the PiP', () => {
    mount();
    drag([300, 200], [310, 210]);
    expect(last(onViewChange)).toMatchObject({ x: 40, y: 40, scale: { x: 1, y: 1 } });
    expect(pip.current!.getView()).toEqual({ x: 0, y: 0, scale: { x: 0.25, y: 0.25 } });
  });

  it('leaves the root alone for a drag in the PiP outside the marker', () => {
    mount();
    drag([370, 270], [380, 275]);
    expect(onViewChange).not.toHaveBeenCalled();
  });

  it('keeps following a drag that leaves the PiP', () => {
    mount();
    drag([300, 200], [100, 100]);
    expect(last(onViewChange)).toMatchObject({ x: -800, y: -400 });
  });

  it('wins over the select tool on a draw surface', () => {
    mount({ features: ['draw'] });
    drag([300, 200], [310, 210]);
    expect(last(onViewChange)).toMatchObject({ x: 40, y: 40 });
    expect(selection!.get()).toEqual([]);
    expect(scene.get(node)!.pose).toMatchObject({ x: 180, y: 60 });
  });

  it('reaches onViewChange clamped by viewBounds', () => {
    mount({ viewBounds: { x: 0, y: 0, width: 420, height: 320 } });
    drag([300, 200], [310, 210]);
    expect(last(onViewChange)).toMatchObject({ x: 20, y: 20 });
  });

  it('ends a camera glide in flight', () => {
    mount();
    act(() => api.current!.animateView({ x: 500, y: 0, scale: { x: 1, y: 1 } }));
    drag([300, 200], [310, 210]);
    expect(api.current!.isViewAnimating()).toBe(false);
  });

  it("marks a PiP's aim in the root view and drags the PiP's camera", () => {
    // The PiP shows world (0,0)–(560,420), outlined in the root at the same px.
    mount({}, { markers: <ViewMarker id="pip-aim" source="pip" target={null} /> });
    drag([20, 20], [30, 20]);
    expect(pip.current!.getView()).toMatchObject({ x: 10, y: 0 });
  });

  it('lets a press on a marker that is not interactive fall through to the view', () => {
    mount({ features: ['draw'] }, { rootAim: { interactive: false } });
    drag([300, 200], [310, 210]);
    expect(onViewChange).not.toHaveBeenCalled();
    expect(scene.get(node)!.pose).toMatchObject({ x: 220, y: 100 });
  });

  it('lets a press on a marker whose source has no writer fall through to the view', () => {
    const source = { aim: () => api.current!.aimOf(null) };
    mount({ features: ['draw'] }, { rootAim: { source } });
    drag([300, 200], [310, 210]);
    expect(onViewChange).not.toHaveBeenCalled();
    expect(scene.get(node)!.pose).toMatchObject({ x: 220, y: 100 });
  });
});

describe('a surface that installs no marker drag', () => {
  it('lets a press on a marker fall through to the view under actions={null}', () => {
    // `actions={null}` mutes the kit's move too, so the select tool's own pick is what answers.
    mount({ features: ['draw'], actions: null });
    drag([300, 200], [310, 210]);
    expect(onViewChange).not.toHaveBeenCalled();
    expect(selection!.get()).toEqual([node]);
  });

  it('lets a press on a marker fall through to the view under a tools takeover', () => {
    mount({ features: ['draw'] }, { takeover: true });
    drag([300, 200], [310, 210]);
    expect(onViewChange).not.toHaveBeenCalled();
    expect(scene.get(node)!.pose).toMatchObject({ x: 220, y: 100 });
  });

  it('drags the marker again under actions={null} given the entry in ambient', () => {
    mount({ features: ['draw'], actions: null, ambient: [createViewMarkerContribution()] });
    drag([300, 200], [310, 210]);
    expect(last(onViewChange)).toMatchObject({ x: 40, y: 40 });
  });

  it("drags the marker again under a tools takeover given the entry in the takeover's ambient", () => {
    mount({ features: ['draw'] }, { takeover: true, markerDrag: true });
    drag([300, 200], [310, 210]);
    expect(last(onViewChange)).toMatchObject({ x: 40, y: 40 });
    expect(scene.get(node)!.pose).toMatchObject({ x: 180, y: 60 });
  });
});
