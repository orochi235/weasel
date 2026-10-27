/**
 * A trial learns that it draws 3D from `useOrbitView`, from a three.js
 * renderer drawing into its DOM, or from WebGL or WebGPU depth testing turned on for a
 * canvas there; drawing 3D through no `orbit` warns, and marks the title bar.
 */

import { act, waitFor } from '@testing-library/react';
import { createCamera } from '@weasel-js/kernel3d';
import { renderSettled } from '@weasel-js/react/testing/renderSettled';
import { withIcons } from '@weasel-js/ui/testing/withIcons';
import { useContext, useEffect, useRef } from 'react';
import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from 'vitest';
import { defineInstrument } from '../instrument/defineInstrument';
import type { Instrument, OrbitCapability } from '../instrument/types';
import { Lab } from '../lab/Lab';
import { LabContext, type LabContextValue } from '../lab/LabContext';
import { LabStoreContext } from '../state/context';
import type { LabStore } from '../state/store';
import { as3DView } from '../state/view';
import { useOrbitView } from './useOrbitView';
import type { TrialOrbit } from './useTrialOrbit';

/** jsdom has no WebGL: a context with only the calls the depth watch reads. Defined before any trial
 *  mounts, as a browser's is before labkit loads. */
const DEPTH_TEST = 0x0b71;
class FakeGl {
  constructor(readonly canvas: HTMLCanvasElement) {}
  enable(_cap: number): void {}
  disable(_cap: number): void {}
}

/** jsdom has no WebGPU either: a device and a canvas context with only the calls the watch reads. */
type DepthStencil = {
  format: string;
  depthCompare?: string;
  depthWriteEnabled?: boolean;
};
class FakeGpuDevice {
  createRenderPipeline(_descriptor: { depthStencil?: DepthStencil }): object {
    return {};
  }
  createRenderPipelineAsync(_descriptor: { depthStencil?: DepthStencil }): Promise<object> {
    return Promise.resolve({});
  }
}
class FakeGpuContext {
  constructor(readonly canvas: HTMLCanvasElement) {}
  configure(_config: { device: FakeGpuDevice }): void {}
}

beforeAll(() => {
  Object.assign(globalThis, {
    WebGL2RenderingContext: FakeGl,
    GPUDevice: FakeGpuDevice,
    GPUCanvasContext: FakeGpuContext,
  });
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  proto.setPointerCapture = vi.fn();
  proto.releasePointerCapture = vi.fn();
  proto.hasPointerCapture = vi.fn(() => true);
});

const seen: {
  lab: LabContextValue | null;
  store: LabStore | null;
  view: TrialOrbit | null;
} = {
  lab: null,
  store: null,
  view: null,
};

function Scene3d() {
  const view = useOrbitView();
  seen.view = view;
  return <div className="lk-test-scene3d" ref={view.viewportRef} />;
}

/**
 * What three.js's `WebGLRenderer` constructor does when the page defines
 * `__THREE_DEVTOOLS__`: announce itself, `domElement` and all. Emulated here,
 * since the suite has no WebGL; the event is three's contract.
 */
function observeRenderer(domElement: HTMLCanvasElement) {
  const hook = (globalThis as { __THREE_DEVTOOLS__?: EventTarget }).__THREE_DEVTOOLS__;
  hook?.dispatchEvent(new CustomEvent('observe', { detail: { domElement } }));
}

/** A three.js view the way a consumer writes one: its own canvas, its own
 *  renderer, no labkit hook. `append` creates the canvas the way three does
 *  when handed none, and puts it in the DOM after the constructor returns. */
function ThreeScene({ append = false }: { append?: boolean }) {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = host.current as HTMLDivElement;
    const canvas = append ? document.createElement('canvas') : (el.firstChild as HTMLCanvasElement);
    observeRenderer(canvas);
    if (append) el.append(canvas);
  }, [append]);
  return <div ref={host}>{append ? null : <canvas />}</div>;
}

type Orbit = OrbitCapability<Record<string, never>, Record<string, never>> | false;

function solid(name: string, orbit?: Orbit, scene = <Scene3d />): Instrument {
  return defineInstrument<Record<string, never>, Record<string, never>>({
    name,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => scene,
    ...(orbit !== undefined ? { orbit } : {}),
  }) as Instrument;
}

function Capture() {
  seen.lab = useContext(LabContext);
  seen.store = useContext(LabStoreContext)?.store ?? null;
  return null;
}

async function mount(instrument: Instrument) {
  const out = await renderSettled(
    <Lab instruments={[instrument]} defaultInstrument={instrument.name}>
      <Capture />
    </Lab>,
    { wrapper: withIcons },
  );
  const view = () => as3DView(seen.store?.getState().trials[0]?.view);
  return { ...out, view };
}

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => warn.mockRestore());

const cameraWarnings = () =>
  warn.mock.calls.filter((call) => String(call[0]).includes('draws a 3D view'));
const badge = () => document.querySelector('.lk-trial__no-camera');

describe('useOrbitView', () => {
  it("hands a 3D view its trial's orbit camera, and says nothing", async () => {
    const { view } = await mount(solid('Orbited', { initialView: { distance: 20 } }));
    expect(seen.view?.camera).toEqual(createCamera({ distance: 20 }));
    expect(seen.view?.camera).toEqual(view());
    expect(cameraWarnings()).toEqual([]);
  });

  it('lands the camera gestures on the pane it is attached to', async () => {
    const { container, view } = await mount(solid('Paned', { initialView: { distance: 20 } }));
    const pane = container.querySelector('.lk-test-scene3d') as HTMLElement;
    await act(async () => {
      pane.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 200,
        }),
      );
    });
    expect(view()?.distance).toBeGreaterThan(20);
    expect(badge()).toBeNull();
  });

  it('warns once per instrument when its trials draw 3D with no orbit camera', async () => {
    const bare = solid('Bare');
    await mount(bare);
    await act(async () => seen.lab?.cloneTrial(seen.lab.trials[0]?.id ?? ''));
    expect(cameraWarnings()).toHaveLength(1);
    expect(String(cameraWarnings()[0]?.[0])).toMatch(
      /instrument "Bare" draws a 3D view \(useOrbitView\).* declares no `orbit`.*`orbit: \{ fixed: true \}`.*`orbit: false`/,
    );
    expect(seen.view?.camera).toBeNull();
    expect(badge()).not.toBeNull();
  });

  it('is inert outside a trial', async () => {
    await renderSettled(<Scene3d />);
    expect(seen.view?.camera).toBeNull();
    expect(() => seen.view?.home()).not.toThrow();
    expect(cameraWarnings()).toEqual([]);
  });
});

describe('a fixed orbit', () => {
  it('takes no gestures, keeps its camera readable, and says nothing', async () => {
    const { container, view } = await mount(
      solid('Still', { initialView: { distance: 20 }, fixed: true }),
    );
    const pane = container.querySelector('.lk-test-scene3d') as HTMLElement;
    await act(async () => {
      pane.dispatchEvent(
        new WheelEvent('wheel', {
          bubbles: true,
          cancelable: true,
          deltaY: 200,
        }),
      );
      pane.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
    });
    expect(view()?.distance).toBe(20);
    expect(seen.view?.camera?.distance).toBe(20);
    expect(cameraWarnings()).toEqual([]);
  });
});

describe('a three.js renderer in a trial', () => {
  it('counts as a 3D view: no orbit warns and marks the title bar', async () => {
    await mount(solid('Threeish', undefined, <ThreeScene />));
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toMatch(
      /"Threeish" draws a 3D view \(a three\.js renderer\)/,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it('is found when its canvas joins the trial after the constructor', async () => {
    await mount(solid('Appended', undefined, <ThreeScene append />));
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
  });

  it('says nothing under an orbit, or under `orbit: false`', async () => {
    await mount(solid('Owned', false, <ThreeScene />));
    await mount(solid('Labkits', {}, <ThreeScene />));
    await new Promise((r) => setTimeout(r, 300));
    expect(cameraWarnings()).toEqual([]);
    expect(badge()).toBeNull();
  });

  it('is ignored outside any trial', async () => {
    await renderSettled(<ThreeScene />);
    await new Promise((r) => setTimeout(r, 300));
    expect(cameraWarnings()).toEqual([]);
  });
});

/** A hand-written WebGL view: its own canvas and context, no labkit hook. `depth` turns depth testing on, as a
 *  3D view does; without it the canvas is drawn the way weasel's 2D renderer draws one, depth testing off. */
function RawGl({ depth }: { depth: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const gl = new FakeGl(ref.current as HTMLCanvasElement);
    if (depth) gl.enable(DEPTH_TEST);
    else gl.disable(DEPTH_TEST);
  }, [depth]);
  return <canvas ref={ref} />;
}

describe('raw WebGL in a trial', () => {
  it('counts as a 3D view once it turns on depth testing', async () => {
    await mount(solid('RawDepth', undefined, <RawGl depth />));
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toMatch(
      /"RawDepth" draws a 3D view \(WebGL with depth testing\)/,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it('says nothing of a canvas drawn without depth testing, or under a declared orbit', async () => {
    await mount(solid('RawFlat', undefined, <RawGl depth={false} />));
    await mount(solid('RawOwned', false, <RawGl depth />));
    await new Promise((r) => setTimeout(r, 50));
    expect(cameraWarnings()).toEqual([]);
  });
});

/** A hand-written WebGPU view. `pipelineFirst` builds the pipeline before configuring the canvas, so the
 *  watch has to tie them together in either order. */
function RawGpu({
  depthStencil,
  pipelineFirst = false,
  async = false,
}: {
  depthStencil?: DepthStencil;
  pipelineFirst?: boolean;
  async?: boolean;
}) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const device = new FakeGpuDevice();
    const ctx = new FakeGpuContext(ref.current as HTMLCanvasElement);
    const build = () =>
      async
        ? void device.createRenderPipelineAsync({ depthStencil })
        : device.createRenderPipeline({ depthStencil });
    if (pipelineFirst) build();
    ctx.configure({ device });
    if (!pipelineFirst) build();
  }, [depthStencil, pipelineFirst, async]);
  return <canvas ref={ref} />;
}

let gpuLabs = 0;
const DEPTH: DepthStencil = {
  format: 'depth24plus',
  depthCompare: 'less',
  depthWriteEnabled: true,
};

describe('raw WebGPU in a trial', () => {
  it.each<[string, { pipelineFirst?: boolean; async?: boolean }]>([
    ['configured, then a depth pipeline', {}],
    ['a depth pipeline, then configured', { pipelineFirst: true }],
    ['an async depth pipeline', { async: true }],
  ])('counts as a 3D view: %s', async (_, order) => {
    const name = `Gpu${++gpuLabs}`;
    await mount(solid(name, undefined, <RawGpu depthStencil={DEPTH} {...order} />));
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toContain(
      `"${name}" draws a 3D view (WebGPU with depth testing)`,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it('says nothing of a pipeline that tests no depth, or under a declared orbit', async () => {
    await mount(solid('GpuFlat', undefined, <RawGpu />));
    await mount(solid('GpuStencil', undefined, <RawGpu depthStencil={{ format: 'stencil8' }} />));
    await mount(
      solid(
        'GpuAlways',
        undefined,
        <RawGpu
          depthStencil={{
            format: 'depth24plus-stencil8',
            depthCompare: 'always',
          }}
        />,
      ),
    );
    await mount(solid('GpuOwned', false, <RawGpu depthStencil={DEPTH} />));
    await new Promise((r) => setTimeout(r, 50));
    expect(cameraWarnings()).toEqual([]);
  });
});
