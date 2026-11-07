/**
 * The parity suite's harness: one WebGL renderer and one WebGPU renderer of
 * the same size and density, each drawing the same commands to a canvas of
 * its own, read back as premultiplied RGBA bytes with rows top-down, and
 * compared channel by channel.
 *
 * WebGL runs on the machine's GPU and WebGPU on headless Chromium's
 * SwiftShader adapter, whose 4× sample patterns differ: a multisampled edge
 * pixel can come out a sample apart. So cases compare single-sampled canvases
 * (`antialias: false`) everywhere, and multisampled ones away from edges.
 */
import type { GlMat3 } from '@weasel-js/geom';
import { WeaselRenderer } from '../WeaselRenderer';
import type { DrawCommand } from '../DrawCommand';
import { requestRendererDevice } from '../gpu/webgpu/requestRendererDevice';
import { BufferUsage, MapMode } from '../gpu/webgpu/flags';
import { configureCanvas } from '../gpu/webgpu/openWebGPU';

/** How far one channel may differ between the backends. */
export const TOLERANCE = 2;

export interface ParitySize {
  readonly width: number;
  readonly height: number;
  readonly dpr: number;
  /** Multisample both canvases. Default false. */
  readonly antialias?: boolean;
}

export interface Backends {
  readonly gl: WeaselRenderer;
  readonly gpu: WeaselRenderer;
  readonly glContext: WebGL2RenderingContext;
  readonly canvas: HTMLCanvasElement;
  readonly device: GPUDevice;
  readonly width: number;
  readonly height: number;
}

/** What a comparison found: the largest channel difference, how many pixels
 *  differ past `TOLERANCE`, and the first few of those, WebGL then WebGPU. */
export interface Diff {
  readonly max: number;
  readonly over: number;
  readonly first: readonly string[];
}

let device: GPUDevice | null = null;
const errors: string[] = [];

/** The shared device, every uncaptured error it raises collected for `takeErrors`. */
export async function parityDevice(): Promise<GPUDevice> {
  if (device) return device;
  device = await requestRendererDevice();
  if (!device) throw new Error('no WebGPU device: the browser project launches Chromium with --enable-unsafe-webgpu');
  device.addEventListener('uncapturederror', (e) => errors.push(`uncaptured: ${(e as GPUUncapturedErrorEvent).error.message}`));
  return device;
}

/** The WebGPU errors raised since the last call. Not the browser's own
 *  copies out of a canvas that is not in the page, which headless Chromium
 *  attempts into a texture it cannot make. */
export function takeErrors(): string[] {
  return errors.splice(0).filter((e) => !e.includes('CopyTextureForBrowser'));
}

/** Run `fn` inside a validation scope, keeping its first error under `label`. */
export async function scoped<T>(gpu: GPUDevice, label: string, fn: () => T | Promise<T>): Promise<T> {
  gpu.pushErrorScope('validation');
  let out: T;
  try {
    out = await fn();
  } finally {
    const error = await gpu.popErrorScope();
    if (error) errors.push(`${label}: ${error.message}`);
  }
  return out;
}

const opened: Backends[] = [];

export async function openBackends({ width, height, dpr, antialias = false }: ParitySize): Promise<Backends> {
  const gpuDevice = await parityDevice();
  const glCanvas = document.createElement('canvas');
  glCanvas.width = Math.round(width * dpr);
  glCanvas.height = Math.round(height * dpr);
  const glContext = glCanvas.getContext('webgl2', { stencil: true, antialias, preserveDrawingBuffer: true })!;
  const canvas = document.createElement('canvas');
  const b = await scoped(gpuDevice, 'building the renderer', (): Backends => ({
    gl: new WeaselRenderer({ gl: glContext, width, height, dpr }),
    gpu: new WeaselRenderer({ gpu: { device: gpuDevice, canvas, antialias }, width, height, dpr }),
    glContext, canvas, device: gpuDevice, width: glCanvas.width, height: glCanvas.height,
  }));
  opened.push(b);
  return b;
}

export function closeBackends(): void {
  for (const b of opened.splice(0)) {
    b.gl.dispose();
    b.gpu.dispose();
  }
}

function readGl(b: Backends): Uint8Array {
  const gl = b.glContext;
  const { width, height } = b;
  const px = new Uint8Array(width * height * 4);
  gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, px);
  const out = new Uint8Array(px.length);
  const row = width * 4;
  for (let y = 0; y < height; y++) out.set(px.subarray((height - 1 - y) * row, (height - y) * row), y * row);
  return out;
}

/** The canvas texture, read before the task ends and it is shown. */
function readGpu(b: Backends): Promise<Uint8Array> {
  const context = b.canvas.getContext('webgpu') as GPUCanvasContext;
  const texture = context.getCurrentTexture();
  const { width, height } = b;
  const stride = Math.ceil((width * 4) / 256) * 256;
  const buffer = b.device.createBuffer({ size: stride * height, usage: BufferUsage.COPY_DST | BufferUsage.MAP_READ });
  const encoder = b.device.createCommandEncoder();
  encoder.copyTextureToBuffer({ texture }, { buffer, bytesPerRow: stride }, [width, height]);
  b.device.queue.submit([encoder.finish()]);
  return buffer.mapAsync(MapMode.READ).then(() => {
    const mapped = new Uint8Array(buffer.getMappedRange());
    const out = new Uint8Array(width * height * 4);
    for (let y = 0; y < height; y++) out.set(mapped.subarray(y * stride, y * stride + width * 4), y * width * 4);
    buffer.unmap();
    buffer.destroy();
    return out;
  });
}

/** Whether pixel `p` of `a` matches all eight of its neighbors: away from any edge. */
function interior(a: Uint8Array, p: number, width: number, height: number): boolean {
  const x = p % width;
  const y = Math.floor(p / width);
  if (x === 0 || y === 0 || x === width - 1 || y === height - 1) return false;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const q = ((y + dy) * width + x + dx) * 4;
      for (let c = 0; c < 4; c++) if (a[q + c] !== a[p * 4 + c]) return false;
    }
  }
  return true;
}

/** Compare every pixel, or with `interiorOnly` those whose WebGL neighbors all match them. */
export function diff(a: Uint8Array, b: Uint8Array, width: number, interiorOnly = false): Diff {
  let max = 0;
  let over = 0;
  const first: string[] = [];
  const height = a.length / 4 / width;
  for (let i = 0; i < a.length; i += 4) {
    const p = i / 4;
    if (interiorOnly && !interior(a, p, width, height)) continue;
    let d = 0;
    for (let c = 0; c < 4; c++) d = Math.max(d, Math.abs(a[i + c] - b[i + c]));
    max = Math.max(max, d);
    if (d <= TOLERANCE) continue;
    over++;
    if (first.length < 8) first.push(`${p % width},${Math.floor(p / width)}: ${a.subarray(i, i + 4).join(' ')} / ${b.subarray(i, i + 4).join(' ')}`);
  }
  return { max, over, first };
}

/** Render `commands` on both backends and compare what each canvas holds. */
export async function renderBoth(b: Backends, commands: DrawCommand[], view?: GlMat3, interiorOnly = false): Promise<Diff> {
  b.gl.render(commands, view);
  const gl = readGl(b);
  const gpu = await scoped(b.device, 'the frame', () => {
    // Headless Chromium hands an off-screen canvas an invalid texture on every
    // frame after its first until the context is configured again; the
    // renderer draws into a buffer of its own, which that leaves alone.
    configureCanvas(b.canvas.getContext('webgpu') as GPUCanvasContext, b.device);
    b.gpu.render(commands, view);
    return readGpu(b);
  });
  return diff(gl, gpu, b.width, interiorOnly);
}

/** The line a failure prints, and every case logs, so a run's log is the parity table. */
export function report(name: string, d: Diff, gpuErrors: readonly string[] = takeErrors()): string {
  const line = `parity ${name}: max ${d.max}, ${d.over} pixel(s) past ${TOLERANCE}`
    + (d.first.length ? `; first ${d.first.join('; ')}` : '')
    + (gpuErrors.length ? `; WebGPU errors: ${[...new Set(gpuErrors)].slice(0, 4).join(' | ')}` : '');
  console.warn(line);
  return line;
}
