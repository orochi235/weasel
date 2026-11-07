import type { WeaselRendererOptions } from '../../rendererTypes';
import { webglDevice, type WebGLDevice } from './WebGLDevice';

/** The device over the context `opts` names or opens, and what its loss and
 *  restore events fire on. */
export function openWebGL(opts: Pick<WeaselRendererOptions, 'gl' | 'canvas'>): {
  device: WebGLDevice; lossTarget: Partial<EventTarget> | null; lost?: Promise<unknown>;
} {
  if (!opts.gl && !opts.canvas) {
    throw new Error('WeaselRenderer requires either gl or canvas');
  }
  const gl = opts.gl ?? opts.canvas!.getContext('webgl2', { stencil: true });
  if (!gl) throw new Error('WeaselRenderer: WebGL2 not available');
  return { device: webglDevice(gl), lossTarget: (gl.canvas as Partial<EventTarget> | undefined) ?? null };
}
