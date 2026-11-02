import '@weasel-js/theme/tokens.css';
import 'windease/styles.css';
import '../styles.less';
import '../lab/presentation.browser.test.less';
import { cleanup, waitFor } from '@testing-library/react';
import { luminanceContrast, relativeLuminance } from '@weasel-js/core';
import { renderWithIcons } from '@weasel-js/ui/testing/withIcons';
import { useEffect, useRef } from 'react';
import { WebGLRenderer } from 'three';
import { WebGPURenderer } from 'three/webgpu';
import { afterEach, beforeEach, describe, expect, it, type MockInstance, vi } from 'vitest';
import type { Instrument, OrbitCapability } from '../instrument/types';
import { Lab } from '../lab/Lab';
import type { LabMode } from '../state/types';

// The jsdom suite fires three's devtools announcement and fakes a WebGL context; this one builds real
// renderers and contexts, so it fails if three stops announcing or moves `domElement`, or if `enable` stops
// going through the context prototype.

type Kind = 'webgl' | 'webgpu';

/** A three.js view the way a consumer writes one: the renderer makes its own
 *  canvas, and the instrument appends it after the constructor returns. */
function ThreeScene({ kind }: { kind: Kind }) {
  const host = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const renderer = kind === 'webgl' ? new WebGLRenderer() : new WebGPURenderer();
    renderer.setSize(120, 80);
    host.current?.append(renderer.domElement);
    return () => {
      renderer.domElement.remove();
      renderer.dispose();
    };
  }, [kind]);
  return <div ref={host} />;
}

type Orbit = OrbitCapability<Record<string, never>, Record<string, never>> | false;

let made = 0;
/** A fresh instrument per test: the console warning fires once per instrument. */
function threeLab(kind: Kind, orbit?: Orbit): Instrument {
  return {
    name: `Three${++made}`,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => <ThreeScene kind={kind} />,
    ...(orbit !== undefined ? { orbit } : {}),
  } as Instrument;
}

const mount = (instrument: Instrument, mode: LabMode = 'dark') =>
  renderWithIcons(
    <div className="lk-present-frame">
      <Lab instruments={[instrument]} defaultInstrument={instrument.name} mode={mode} />
    </div>,
  );

type Rgba = [number, number, number, number];

/** Any CSS color as 0-255 channels, read back from a 2D canvas, since a
 *  `color-mix()` computes to a `color(srgb …)` string. */
function rgba(css: string): Rgba {
  const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
  ctx.fillStyle = css;
  ctx.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data;
  return [r ?? 0, g ?? 0, b ?? 0, (a ?? 0) / 255];
}

const over = (top: Rgba, under: Rgba): Rgba =>
  [...([0, 1, 2] as const).map((i) => top[i] * top[3] + under[i] * (1 - top[3])), 1] as Rgba;

const contrast = (a: Rgba, b: Rgba) =>
  luminanceContrast(
    relativeLuminance(a[0] / 255, a[1] / 255, a[2] / 255),
    relativeLuminance(b[0] / 255, b[1] / 255, b[2] / 255),
  );

let warn: MockInstance<typeof console.warn>;
beforeEach(() => {
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  cleanup();
  warn.mockRestore();
});

const cameraWarnings = () =>
  warn.mock.calls.filter((call) => String(call[0]).includes('draws a 3D view'));
const badge = () => document.querySelector<HTMLElement>('.lk-trial__no-camera');

describe('a real three.js renderer in a trial with no `orbit`', () => {
  it.each<Kind>(['webgl', 'webgpu'])('%s: warns, and marks the title bar', async (kind) => {
    const instrument = threeLab(kind);
    mount(instrument);
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toContain(
      `"${instrument.name}" draws a 3D view (a three.js renderer)`,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it.each<'light' | 'dark'>(['light', 'dark'])(
    '%s: shows the badge whole, inside the title bar, at a readable contrast',
    async (mode) => {
      mount(threeLab('webgl'), mode);
      await waitFor(() => expect(badge()).not.toBeNull());
      const mark = badge() as HTMLElement;
      const bar = mark.closest('.lk-trial__titlebar') as HTMLElement;
      const box = mark.getBoundingClientRect();
      const barBox = bar.getBoundingClientRect();
      expect(mark.textContent).toBe('no camera');
      expect(mark.scrollWidth).toBeLessThanOrEqual(mark.clientWidth);
      expect(box.left).toBeGreaterThanOrEqual(barBox.left);
      expect(box.right).toBeLessThanOrEqual(barBox.right);
      expect(box.top).toBeGreaterThanOrEqual(barBox.top);
      expect(box.bottom).toBeLessThanOrEqual(barBox.bottom);
      const ground = over(
        rgba(getComputedStyle(mark).backgroundColor),
        rgba(getComputedStyle(bar).backgroundColor),
      );
      expect(contrast(rgba(getComputedStyle(mark).color), ground)).toBeGreaterThanOrEqual(4.5);
    },
  );
});

describe('a real three.js renderer under a declared `orbit`', () => {
  it.each<[string, Orbit]>([
    ['orbit: false', false],
    ['orbit: { fixed: true }', { fixed: true }],
  ])('%s: says nothing', async (_, orbit) => {
    mount(threeLab('webgl', orbit));
    // The watcher retries for a second while a canvas joins the DOM.
    await new Promise((r) => setTimeout(r, 1300));
    expect(cameraWarnings()).toEqual([]);
    expect(badge()).toBeNull();
  });
});

/** A hand-written WebGL view on a real context, with depth testing on or off. */
function RawGl({ depth }: { depth: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const gl = ref.current?.getContext('webgl2', { stencil: true });
    if (!gl) return;
    if (depth) gl.enable(gl.DEPTH_TEST);
    else gl.disable(gl.DEPTH_TEST);
  }, [depth]);
  return <canvas ref={ref} width={120} height={80} />;
}

function rawLab(depth: boolean): Instrument {
  return {
    name: `Raw${++made}`,
    defaultConfig: () => ({}),
    initialState: () => ({}),
    render: () => <RawGl depth={depth} />,
  } as Instrument;
}

describe('raw WebGL in a trial with no `orbit`', () => {
  it('warns once it turns on depth testing, and marks the title bar', async () => {
    const instrument = rawLab(true);
    mount(instrument);
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toContain(
      `"${instrument.name}" draws a 3D view (WebGL with depth testing)`,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it('says nothing of a context with depth testing off', async () => {
    mount(rawLab(false));
    await new Promise((r) => setTimeout(r, 300));
    expect(cameraWarnings()).toEqual([]);
    expect(badge()).toBeNull();
  });
});

/** The slice of WebGPU this suite calls; the repo carries no WebGPU types. */
type GpuDevice = {
  createShaderModule(d: { code: string }): unknown;
  createRenderPipeline(d: object): unknown;
};
type Gpu = {
  requestAdapter(): Promise<{ requestDevice(): Promise<GpuDevice> } | null>;
  getPreferredCanvasFormat(): string;
};

const SHADER = `
@vertex fn vs() -> @builtin(position) vec4f { return vec4f(0.0, 0.0, 0.0, 1.0); }
@fragment fn fs() -> @location(0) vec4f { return vec4f(1.0); }`;

const DEPTH = { format: 'depth24plus', depthCompare: 'less', depthWriteEnabled: true };

/** A hand-written WebGPU view on a real device, building one pipeline with or without a depth test. */
function RawGpu({ depth, gpu }: { depth: boolean; gpu: Gpu }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    void (async () => {
      const device = await (await gpu.requestAdapter())?.requestDevice();
      const canvas = ref.current;
      if (!device || !canvas) return;
      const format = gpu.getPreferredCanvasFormat();
      const ctx = canvas.getContext('webgpu') as { configure(c: object): void } | null;
      ctx?.configure({ device, format });
      const module = device.createShaderModule({ code: SHADER });
      device.createRenderPipeline({
        layout: 'auto',
        vertex: { module, entryPoint: 'vs' },
        fragment: { module, entryPoint: 'fs', targets: [{ format }] },
        ...(depth ? { depthStencil: DEPTH } : {}),
      });
    })();
  }, [depth, gpu]);
  return <canvas ref={ref} width={120} height={80} />;
}

const gpu = (navigator as { gpu?: Gpu }).gpu;
// Headless Chromium on a fleet node may have no WebGPU, or no adapter behind it.
const adapter = await gpu?.requestAdapter().catch(() => null);

describe.skipIf(!gpu || !adapter)('raw WebGPU in a trial with no `orbit`', () => {
  const gpuLab = (depth: boolean): Instrument =>
    ({
      name: `RawGpu${++made}`,
      defaultConfig: () => ({}),
      initialState: () => ({}),
      render: () => <RawGpu depth={depth} gpu={gpu as Gpu} />,
    }) as Instrument;

  it('warns once it builds a depth-tested pipeline, and marks the title bar', async () => {
    const instrument = gpuLab(true);
    mount(instrument);
    await waitFor(() => expect(cameraWarnings()).toHaveLength(1));
    expect(String(cameraWarnings()[0]?.[0])).toContain(
      `"${instrument.name}" draws a 3D view (WebGPU with depth testing)`,
    );
    await waitFor(() => expect(badge()).not.toBeNull());
  });

  it('says nothing of a pipeline with no depth test', async () => {
    mount(gpuLab(false));
    await new Promise((r) => setTimeout(r, 300));
    expect(cameraWarnings()).toEqual([]);
    expect(badge()).toBeNull();
  });
});
