/**
 * Which GPU API a canvas paints with. A canvas holds one kind of context for
 * its whole life, so the choice is made once, when its first renderer is built.
 */
import { programSourceRegistry, requestRendererDevice, type RendererBackend } from '@weasel-js/renderer';
import { createEmitter } from '@weasel-js/registry';

/**
 * `'webgl2'`, `'webgpu'`, or `'auto'`: WebGPU where a device is available and
 * every program registered so far has WGSL, WebGL 2 otherwise. A canvas that
 * asks for `'webgpu'` where there is no device paints nothing. A tile of a
 * shared canvas (`CanvasPaintOptions.tile`) always paints with WebGL 2: each
 * WebGPU renderer keeps a buffer of its own and presents all of it, which
 * would erase its co-tenants.
 */
export type CanvasBackend = RendererBackend | 'auto';

/** What a canvas paints with, or why it cannot yet. */
export type BackendChoice =
  | { kind: 'webgl2' }
  | { kind: 'webgpu'; device: GPUDevice; fallback: boolean }
  | { kind: 'wait'; ready: Promise<unknown> }
  | { kind: 'refuse'; reason: string };

type DeviceState =
  | { status: 'pending'; ready: Promise<unknown> }
  | { status: 'ready'; device: GPUDevice }
  | { status: 'none' };

let deviceState: DeviceState | null = null;

const deviceLosses = createEmitter();

/** Run `fn` when the device renderers paint with is lost. Returns an unsubscribe. One reaction on
 *  the device serves every subscriber, since a reaction holds what it closes over while the device lives. */
export const subscribeDeviceLost = deviceLosses.subscribe;

function rendererDevice(): DeviceState {
  if (deviceState) return deviceState;
  const ready = requestRendererDevice().then(
    (device) => {
      deviceState = device ? { status: 'ready', device } : { status: 'none' };
      void device?.lost.then(() => {
        if (deviceState?.status === 'ready' && deviceState.device === device) deviceState = null;
        deviceLosses.emit();
      });
    },
    () => { deviceState = { status: 'none' }; },
  );
  const pending: DeviceState = { status: 'pending', ready };
  deviceState = pending;
  return pending;
}

/** The kind each canvas took when its first renderer was built. */
const CHOSEN: WeakMap<HTMLCanvasElement, RendererBackend> = new WeakMap();

/** Record that `canvas` paints with `backend` from now on. */
export function rememberBackend(canvas: HTMLCanvasElement, backend: RendererBackend): void {
  CHOSEN.set(canvas, backend);
}

/** What `canvas` paints with, or undefined before its first renderer is built. */
export function canvasPaintsWith(canvas: HTMLCanvasElement): RendererBackend | undefined {
  return CHOSEN.get(canvas);
}

/** Whether every program registered so far carries WGSL. */
export function everyProgramHasWgsl(): boolean {
  return programSourceRegistry.entries().every((e) => e.value.wgsl !== undefined);
}

/** What `canvas` paints with when it asks for `asked`. */
export function chooseBackend(canvas: HTMLCanvasElement, asked: CanvasBackend, shared: boolean): BackendChoice {
  const chosen = CHOSEN.get(canvas);
  const want = chosen ?? (shared ? 'webgl2' : asked);
  if (want === 'webgl2') return { kind: 'webgl2' };
  const state = rendererDevice();
  if (state.status === 'pending') return { kind: 'wait', ready: state.ready };
  if (state.status === 'none') {
    return want === 'auto' ? { kind: 'webgl2' } : { kind: 'refuse', reason: 'WebGPU is unavailable here' };
  }
  if (want === 'auto' && !everyProgramHasWgsl()) return { kind: 'webgl2' };
  return { kind: 'webgpu', device: state.device, fallback: want === 'auto' };
}

